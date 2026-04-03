use std::fs;
use std::path::PathBuf;
use std::process::{Command, Child};
use std::sync::Mutex;
use tauri::Manager;

// Bridge server child process — 앱 종료 시 자동으로 kill
struct BridgeProcess(Mutex<Option<Child>>);

impl Drop for BridgeProcess {
    fn drop(&mut self) {
        if let Some(ref mut child) = *self.0.lock().unwrap() {
            println!("[tauri] Stopping bridge server...");
            let _ = child.kill();
        }
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

    let node_cmd = if cfg!(debug_assertions) { "npx" } else { "node" };
    let mut args: Vec<String> = Vec::new();
    if cfg!(debug_assertions) {
        args.push("tsx".to_string());
    }
    args.push(server_script.to_string_lossy().to_string());

    println!("[tauri] Starting bridge server: {} {:?}", node_cmd, args);
    println!("[tauri] CWD: {}", project_root.display());

    let child = Command::new(node_cmd)
        .args(&args)
        .current_dir(&project_root)
        .env("NODE_TLS_REJECT_UNAUTHORIZED", "0")
        .env("RPC_PROVIDER", std::env::var("RPC_PROVIDER").unwrap_or_default())
        .env("RPC_MODEL", std::env::var("RPC_MODEL").unwrap_or_default())
        .spawn()
        .map_err(|e| eprintln!("[tauri] Failed to start bridge server: {}", e))
        .ok()?;

    println!("[tauri] Bridge server started (pid: {})", child.id());
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
