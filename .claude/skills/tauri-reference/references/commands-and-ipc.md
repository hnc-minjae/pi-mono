# Tauri v2 커맨드 & IPC 레퍼런스

> 출처: https://v2.tauri.app/develop/calling-rust/ , https://v2.tauri.app/develop/calling-frontend/

## 목차
1. [커맨드 기초](#커맨드-기초)
2. [파라미터 전달](#파라미터-전달)
3. [반환 타입](#반환-타입)
4. [에러 핸들링](#에러-핸들링)
5. [비동기 커맨드](#비동기-커맨드)
6. [컨텍스트 접근](#컨텍스트-접근)
7. [채널 (스트리밍)](#채널)
8. [이벤트 시스템](#이벤트-시스템)
9. [Raw Request 접근](#raw-request-접근)

---

## 커맨드 기초

### 정의 (Rust)
```rust
#[tauri::command]
fn my_command() {
    println!("I was invoked from JavaScript!");
}
```

**제약사항:**
- 커맨드 이름은 고유해야 함
- `lib.rs`의 함수는 `pub`으로 선언 불가 (글루 코드 생성 제한)

### 등록 (lib.rs)
```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![my_command])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
```

### 호출 (JavaScript)
```javascript
import { invoke } from '@tauri-apps/api/core';
await invoke('my_command');
```

### 모듈 분리
```rust
// src-tauri/src/commands.rs
#[tauri::command]
pub fn my_command() {
    println!("I was invoked from JavaScript!");
}

// src-tauri/src/lib.rs
mod commands;
// ...
.invoke_handler(tauri::generate_handler![commands::my_command])
```

### 다중 커맨드 등록
```rust
.invoke_handler(tauri::generate_handler![cmd_a, cmd_b, cmd_c])
```

## 파라미터 전달

커맨드 인자는 `serde::Deserialize`를 구현해야 한다.

```rust
#[tauri::command]
fn greet(invoke_message: String) {
    println!("Message: {}", invoke_message);
}
```

JS에서는 **camelCase** JSON 객체로 전달:
```javascript
await invoke('greet', { invokeMessage: 'Hello!' });
```

snake_case를 사용하려면:
```rust
#[tauri::command(rename_all = "snake_case")]
fn greet(invoke_message: String) {}
```
```javascript
await invoke('greet', { invoke_message: 'Hello!' });
```

## 반환 타입

`serde::Serialize`를 구현하는 타입 반환 가능:
```rust
#[tauri::command]
fn greet() -> String {
    "Hello from Rust!".into()
}
```
```javascript
const message = await invoke('greet');
```

### Array Buffer 최적화 (대용량 데이터)

JSON 직렬화를 바이패스하여 바이너리 데이터를 효율적으로 전달:
```rust
use tauri::ipc::Response;

#[tauri::command]
fn read_file() -> Response {
    let data = std::fs::read("/path/to/file").unwrap();
    tauri::ipc::Response::new(data)
}
```

## 에러 핸들링

### 기본 패턴 (Result<T, String>)
```rust
#[tauri::command]
fn login(user: String, password: String) -> Result<String, String> {
    if user == "tauri" && password == "tauri" {
        Ok("logged_in".to_string())
    } else {
        Err("invalid credentials".to_string())
    }
}
```
```javascript
invoke('login', { user: 'tauri', password: 'wrong' })
    .then((msg) => console.log(msg))
    .catch((err) => console.error(err));
```

### 커스텀 에러 타입 (thiserror + serde)
```rust
#[derive(Debug, thiserror::Error)]
enum Error {
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

impl serde::Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where S: serde::ser::Serializer {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

#[tauri::command]
fn read_file() -> Result<(), Error> {
    std::fs::File::open("nonexistent")?;
    Ok(())
}
```

### 태그된 에러 (프론트엔드에서 에러 종류 구분)
```rust
#[derive(Debug, thiserror::Error)]
enum Error {
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error("failed to parse: {0}")]
    Utf8(#[from] std::str::Utf8Error),
}

#[derive(serde::Serialize)]
#[serde(tag = "kind", content = "message")]
#[serde(rename_all = "camelCase")]
enum ErrorKind {
    Io(String),
    Utf8(String),
}

impl serde::Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where S: serde::ser::Serializer {
        let error_message = self.to_string();
        let error_kind = match self {
            Self::Io(_) => ErrorKind::Io(error_message),
            Self::Utf8(_) => ErrorKind::Utf8(error_message),
        };
        error_kind.serialize(serializer)
    }
}
```

## 비동기 커맨드

`async fn`으로 선언. 주의: `&str`, `State<'_, T>` 같은 빌려온 타입은 async에서 직접 사용 불가.

**방법 1 — owned 타입으로 변환:**
```rust
#[tauri::command]
async fn my_command(value: String) -> String {
    some_async_function().await;
    value
}
```

**방법 2 — Result로 감싸기:**
```rust
#[tauri::command]
async fn my_command(value: &str) -> Result<String, ()> {
    some_async_function().await;
    Ok(format!("{}", value))
}
```

## 컨텍스트 접근

### WebviewWindow
```rust
#[tauri::command]
async fn my_command(webview_window: tauri::WebviewWindow) {
    println!("Window: {}", webview_window.label());
}
```

### AppHandle
```rust
#[tauri::command]
async fn my_command(app: tauri::AppHandle) {
    let app_dir = app.path().app_data_dir();
}
```

### Managed State
```rust
struct MyState(String);

#[tauri::command]
fn my_command(state: tauri::State<MyState>) {
    println!("{}", state.0);
}

// lib.rs에서 등록
tauri::Builder::default()
    .manage(MyState("value".into()))
    .invoke_handler(tauri::generate_handler![my_command])
```

## 채널

대용량 데이터 스트리밍에 사용. 이벤트보다 높은 처리량.

### Rust 측 (송신)
```rust
use tauri::ipc::Channel;
use serde::Serialize;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
enum DownloadEvent<'a> {
    #[serde(rename_all = "camelCase")]
    Started { url: &'a str, download_id: usize, content_length: usize },
    #[serde(rename_all = "camelCase")]
    Progress { download_id: usize, chunk_length: usize },
    #[serde(rename_all = "camelCase")]
    Finished { download_id: usize },
}

#[tauri::command]
fn download(app: tauri::AppHandle, url: String, on_event: Channel<DownloadEvent>) {
    on_event.send(DownloadEvent::Started {
        url: &url, download_id: 1, content_length: 1000,
    }).unwrap();
    // ... progress, finished
}
```

### JavaScript 측 (수신)
```javascript
import { invoke, Channel } from '@tauri-apps/api/core';

const onEvent = new Channel();
onEvent.onmessage = (message) => {
    console.log(`event: ${message.event}`);
};
await invoke('download', { url: 'https://...', onEvent });
```

## 이벤트 시스템

소량 데이터 스트리밍이나 multi-producer multi-consumer 패턴에 적합.

### Rust → 프론트엔드 (글로벌 이벤트)
```rust
use tauri::{AppHandle, Emitter};

#[tauri::command]
fn download(app: AppHandle, url: String) {
    app.emit("download-started", &url).unwrap();
    app.emit("download-progress", 50).unwrap();
    app.emit("download-finished", &url).unwrap();
}
```

### Rust → 특정 윈도우
```rust
use tauri::{AppHandle, Emitter};
app.emit_to("login", "login-result", result).unwrap();
```

### Rust → 필터링된 윈도우
```rust
use tauri::{AppHandle, Emitter, EventTarget};
app.emit_filter("open-file", path, |target| match target {
    EventTarget::WebviewWindow { label } => label == "main" || label == "editor",
    _ => false,
}).unwrap();
```

### JS에서 글로벌 이벤트 수신
```javascript
import { listen } from '@tauri-apps/api/event';
const unlisten = await listen('download-started', (event) => {
    console.log(event.payload);
});
// 정리: unlisten();
```

### JS에서 윈도우 이벤트 수신
```javascript
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
const appWebview = getCurrentWebviewWindow();
appWebview.listen('logged-in', (event) => {
    localStorage.setItem('token', event.payload);
});
```

### JS → Rust 이벤트 발신
```javascript
import { emit, emitTo } from '@tauri-apps/api/event';
emit('file-selected', '/path/to/file');              // 글로벌
emitTo('settings', 'update-requested', { key: 'x' }); // 특정 윈도우
```

### Rust에서 이벤트 수신
```rust
use tauri::Listener;
app.listen("download-started", |event| {
    println!("payload: {}", event.payload());
});
// once: app.once("ready", |event| { ... });
// unlisten: let id = app.listen(...); app.unlisten(id);
```

### 이벤트 페이로드 (직렬화 가능 구조체)
```rust
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadStarted<'a> {
    url: &'a str,
    download_id: usize,
    content_length: usize,
}

app.emit("download-started", DownloadStarted { url: &url, download_id: 1, content_length: 1000 }).unwrap();
```

### JS eval (Rust에서 직접 JS 실행)
```rust
use tauri::Manager;
let webview = app.get_webview_window("main").unwrap();
webview.eval("console.log('hello from Rust')")?;
```

## Raw Request 접근

전체 요청 객체 (body, headers)에 접근:
```rust
#[tauri::command]
fn upload(request: tauri::ipc::Request) -> Result<(), Error> {
    let tauri::ipc::InvokeBody::Raw(data) = request.body() else {
        return Err(Error::RequestBodyMustBeRaw);
    };
    let auth = request.headers().get("Authorization");
    Ok(())
}
```
```javascript
const data = new Uint8Array([1, 2, 3]);
await __TAURI__.core.invoke('upload', data, {
    headers: { Authorization: 'apikey' },
});
```
