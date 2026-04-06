use std::fs;
use std::path::PathBuf;
use std::process::{Command, Child};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::Manager;

/// Bridge 서버 자식 프로세스 래퍼.
/// 커널 레벨 정리(prctl / Job Object)가 주 메커니즘이며,
/// RunEvent::Exit와 Drop은 fallback으로 동작한다.
struct BridgeProcess(Mutex<Option<Child>>);

impl BridgeProcess {
    fn stop(&self) {
        if let Some(ref mut child) = *self.0.lock().unwrap() {
            let pid = child.id();
            println!("[tauri] Stopping bridge server (pid: {})...", pid);

            // 정상 종료 시도
            #[cfg(unix)]
            unsafe { libc::kill(pid as i32, libc::SIGTERM); }

            #[cfg(windows)]
            {
                // TerminateProcess는 확실하지만, 먼저 정상 종료를 시도할 수 없으므로
                // CTRL_BREAK_EVENT를 보내 Node.js가 graceful shutdown할 기회를 준다
                unsafe {
                    windows_sys::Win32::System::Console::GenerateConsoleCtrlEvent(
                        windows_sys::Win32::System::Console::CTRL_BREAK_EVENT,
                        pid,
                    );
                }
            }

            // 최대 3초 대기
            for _ in 0..30 {
                match child.try_wait() {
                    Ok(Some(_)) => {
                        println!("[tauri] Bridge server stopped gracefully");
                        return;
                    }
                    _ => thread::sleep(Duration::from_millis(100)),
                }
            }

            println!("[tauri] Bridge server did not exit in time, forcing kill");
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

impl Drop for BridgeProcess {
    fn drop(&mut self) {
        self.stop();
    }
}

// Windows: Job Object로 자식 프로세스 자동 정리
#[cfg(windows)]
fn attach_child_to_job(child: &Child) {
    use windows_sys::Win32::System::JobObjects::*;
    use windows_sys::Win32::Foundation::*;

    unsafe {
        let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if job == 0 { return; }

        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

        SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const _,
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        );

        // child.id()는 프로세스 ID. 핸들을 얻어야 함
        let handle = windows_sys::Win32::System::Threading::OpenProcess(
            PROCESS_SET_QUOTA | PROCESS_TERMINATE,
            0,
            child.id(),
        );
        if handle != 0 {
            AssignProcessToJobObject(job, handle);
            CloseHandle(handle);
        }

        // Job 핸들은 의도적으로 닫지 않음 — 프로세스 수명 동안 유지되어야
        // 앱 종료 시 핸들이 자동으로 닫히면서 자식 프로세스도 종료됨
        std::mem::forget(job);
    }
}

#[tauri::command]
fn read_file_text(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn read_file_binary(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn write_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    let path = PathBuf::from(&path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    fs::write(&path, &contents).map_err(|e| format!("Failed to write file: {}", e))
}

fn start_bridge_server(app: &tauri::App) -> Option<Child> {
    let resource_dir = app.path().resource_dir().ok()?;

    let project_root = if cfg!(debug_assertions) {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()? // desktop/
            .parent()? // packages/
            .parent()? // project root
            .to_path_buf()
    } else {
        resource_dir.clone()
    };

    let server_script = if cfg!(debug_assertions) {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()?
            .join("server")
            .join("start.ts")
    } else {
        resource_dir.join("server").join("start.js")
    };

    let mut cmd = Command::new("node");

    if cfg!(debug_assertions) {
        // npx tsx 대신 node를 직접 실행하여 프로세스 체인을 단순화
        let tsx_preflight = project_root.join("node_modules/tsx/dist/preflight.cjs");
        let tsx_loader = project_root.join("node_modules/tsx/dist/loader.mjs");
        cmd.arg("--require").arg(&tsx_preflight)
           .arg("--import").arg(format!("file://{}", tsx_loader.to_string_lossy()));
    }

    cmd.arg(&server_script)
       .current_dir(&project_root)
       .env("NODE_TLS_REJECT_UNAUTHORIZED", "0")
       .env("RPC_PROVIDER", std::env::var("RPC_PROVIDER").unwrap_or_default())
       .env("RPC_MODEL", std::env::var("RPC_MODEL").unwrap_or_default());

    // Linux: 부모 프로세스 종료 시 커널이 자동으로 SIGTERM 전달
    #[cfg(target_os = "linux")]
    {
        use std::os::unix::process::CommandExt;
        unsafe {
            cmd.pre_exec(|| {
                libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGTERM);
                Ok(())
            });
        }
    }

    println!("[tauri] Starting bridge server: {:?}", cmd);

    let child = cmd.spawn()
        .map_err(|e| eprintln!("[tauri] Failed to start bridge server: {}", e))
        .ok()?;

    println!("[tauri] Bridge server started (pid: {})", child.id());

    // Windows: Job Object에 자식 프로세스 등록
    #[cfg(windows)]
    attach_child_to_job(&child);

    Some(child)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(BridgeProcess(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            read_file_text,
            read_file_binary,
            write_file,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            // Bridge 서버 시작
            let child = start_bridge_server(app);
            let bridge = app.state::<BridgeProcess>();
            *bridge.0.lock().unwrap() = child;

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // RunEvent::Exit — 전 플랫폼 fallback 정리
            if let tauri::RunEvent::Exit = event {
                let bridge = app_handle.state::<BridgeProcess>();
                bridge.stop();
            }
        });
}
