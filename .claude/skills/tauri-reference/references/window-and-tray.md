# Tauri v2 윈도우 & 시스템 트레이 레퍼런스

> 출처: https://v2.tauri.app/learn/window-customization/ , https://v2.tauri.app/learn/system-tray/ , https://v2.tauri.app/develop/state-management/ , https://v2.tauri.app/develop/resources/ , https://v2.tauri.app/develop/sidecar/

## 목차
1. [윈도우 커스터마이징](#윈도우-커스터마이징)
2. [시스템 트레이](#시스템-트레이)
3. [상태 관리](#상태-관리)
4. [리소스 임베딩](#리소스-임베딩)
5. [사이드카 (외부 바이너리)](#사이드카)

---

## 윈도우 커스터마이징

3가지 방법으로 윈도우를 커스터마이징할 수 있다:
- `tauri.conf.json` 설정
- JavaScript Window API
- Rust Window API

### 커스텀 타이틀바

1. 네이티브 데코레이션 비활성화:
```json
{
  "app": {
    "windows": [{ "decorations": false }]
  }
}
```

2. 필요 권한:
```json
{
  "permissions": [
    "core:window:default",
    "core:window:allow-start-dragging"
  ]
}
```

3. 드래그 영역 설정:
```html
<!-- data-tauri-drag-region 속성으로 드래그 가능 영역 지정 -->
<div data-tauri-drag-region class="titlebar">
    <button id="minimize">_</button>
    <button id="maximize">□</button>
    <button id="close">×</button>
</div>
```

4. 컨트롤 버튼 핸들러:
```javascript
import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();
document.getElementById('minimize').addEventListener('click', () => appWindow.minimize());
document.getElementById('maximize').addEventListener('click', () => appWindow.toggleMaximize());
document.getElementById('close').addEventListener('click', () => appWindow.close());
```

### 투명 윈도우
```json
{
  "app": {
    "windows": [{ "transparent": true }]
  }
}
```

### macOS 투명 타이틀바 (Rust)
```rust
use tauri::WebviewWindowBuilder;
// TitleBarStyle::Transparent로 투명 타이틀바 + 네이티브 컨트롤 유지
```

## 시스템 트레이

### Cargo.toml feature 활성화
```toml
tauri = { version = "2.0.0", features = ["tray-icon"] }
```

### Rust에서 트레이 생성
```rust
use tauri::tray::TrayIconBuilder;
use tauri::menu::{Menu, MenuItem};

tauri::Builder::default()
    .setup(|app| {
        let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
        let menu = Menu::with_items(app, &[&quit])?;

        let tray = TrayIconBuilder::new()
            .icon(app.default_window_icon().unwrap().clone())
            .menu(&menu)
            .menu_on_left_click(true)
            .on_menu_event(|app, event| match event.id.as_ref() {
                "quit" => app.exit(0),
                _ => {}
            })
            .build(app)?;
        Ok(())
    })
```

### JavaScript에서 트레이 생성
```javascript
import { TrayIcon } from '@tauri-apps/api/tray';
import { Menu } from '@tauri-apps/api/menu';
import { defaultWindowIcon } from '@tauri-apps/api/app';

const menu = await Menu.new({
    items: [{
        id: 'quit',
        text: 'Quit',
        action: () => console.log('quit')
    }]
});

const tray = await TrayIcon.new({
    icon: await defaultWindowIcon(),
    menu,
    menuOnLeftClick: true,
});
```

### 트레이 이벤트 (Rust)
```rust
use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};

TrayIconBuilder::new()
    .on_tray_icon_event(|tray, event| match event {
        TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } => {
            let app = tray.app_handle();
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        _ => {}
    })
```

### 트레이 이벤트 (JavaScript)
```javascript
const tray = await TrayIcon.new({
    action: (event) => {
        switch (event.type) {
            case 'Click': console.log(`${event.button} click`); break;
            case 'DoubleClick': console.log('double click'); break;
        }
    }
});
```

> 기본적으로 메뉴는 좌클릭/우클릭 모두에서 나타남. `menuOnLeftClick(false)`로 좌클릭 메뉴 비활성화 가능.

## 상태 관리

Tauri는 `Manager` API로 앱 상태를 추적한다.

### 상태 초기화
```rust
use std::sync::Mutex;

#[derive(Default)]
struct AppState {
    counter: u32,
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(Mutex::new(AppState::default()));
            Ok(())
        })
        .run(tauri::generate_context!())
        .unwrap()
}
```

### 커맨드에서 접근
```rust
#[tauri::command]
fn increase_counter(state: tauri::State<'_, Mutex<AppState>>) -> u32 {
    let mut state = state.lock().unwrap();
    state.counter += 1;
    state.counter
}
```

### async 커맨드에서 접근 (tokio Mutex)
```rust
#[tauri::command]
async fn increase_counter(state: tauri::State<'_, tokio::sync::Mutex<AppState>>) -> Result<u32, ()> {
    let mut state = state.lock().await;
    state.counter += 1;
    Ok(state.counter)
}
```

### Manager 트레이트로 접근 (커맨드 외부)
```rust
use tauri::Manager;
let state = app_handle.state::<Mutex<AppState>>();
let mut state = state.lock().unwrap();
state.counter += 1;
```

### 핵심 규칙
- 변경 가능 상태는 `Mutex`로 감싸야 함 (스레드 안전)
- `Arc` 불필요 — Tauri가 내부적으로 처리
- 표준 라이브러리 `Mutex`가 대부분 충분 (async Mutex는 await 포인트를 걸쳐야 할 때만)
- **타입 불일치 시 런타임 패닉** — `State<'_, AppState>`와 `State<'_, Mutex<AppState>>` 혼용 주의

### 타입 안전 팁
```rust
// 타입 별칭으로 실수 방지
#[derive(Default)]
struct AppStateInner { counter: u32 }
type AppState = Mutex<AppStateInner>;
```

## 리소스 임베딩

프론트엔드 배포에 포함되지 않는 추가 파일을 번들링.

### 설정 (tauri.conf.json)

**배열 표기:**
```json
{
  "bundle": {
    "resources": ["./resources/**/*", "lang/"]
  }
}
```

**객체 표기 (경로 매핑):**
```json
{
  "bundle": {
    "resources": {
      "resources/config.json": "config/config.json",
      "assets/": "static/"
    }
  }
}
```

### Rust에서 접근
```rust
use tauri::path::BaseDirectory;

let path = app.path().resolve("lang/de.json", BaseDirectory::Resource)?;
let content = std::fs::read_to_string(&path)?;
```

### JavaScript에서 접근
```javascript
import { resolveResource } from '@tauri-apps/api/path';
import { readTextFile } from '@tauri-apps/plugin-fs';

const path = await resolveResource('lang/de.json');
const content = await readTextFile(path);
```

### 권한
```json
{ "permissions": ["fs:allow-read-text-file", "fs:allow-resource-read-recursive"] }
```

### Android 주의
리소스는 APK 에셋으로 저장 (`asset://localhost/`). `app.fs().read_to_string()` 사용 권장.

## 사이드카

외부 바이너리를 앱과 함께 번들링.

### 설정
```json
{
  "bundle": {
    "externalBin": ["binaries/my-sidecar"]
  }
}
```

### 플랫폼별 바이너리 이름
`-$TARGET_TRIPLE` 접미사 필요:
```
binaries/my-sidecar-x86_64-unknown-linux-gnu
binaries/my-sidecar-aarch64-apple-darwin
binaries/my-sidecar-x86_64-pc-windows-msvc.exe
```

타겟 트리플 확인:
```bash
rustc --print host-tuple
```

### Rust에서 실행
```rust
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

let (mut rx, mut child) = app.shell().sidecar("my-sidecar").unwrap().spawn()?;
// sidecar()에는 파일명만 전달, 전체 경로 아님
```

### JavaScript에서 실행
```javascript
import { Command } from '@tauri-apps/plugin-shell';
const output = await Command.sidecar('binaries/my-sidecar').execute();
```

### 인자 전달 권한
```json
{
  "identifier": "shell:allow-execute",
  "allow": [{
    "name": "binaries/my-sidecar",
    "sidecar": true,
    "args": ["arg1", "-a", { "validator": "\\S+" }]
  }]
}
```
