# Tauri v2 공식 플러그인 레퍼런스

> 출처: https://v2.tauri.app/plugin/

## 목차
1. [플러그인 설치 공통](#플러그인-설치-공통)
2. [File System (fs)](#file-system)
3. [HTTP Client (http)](#http-client)
4. [Dialog](#dialog)
5. [Store](#store)
6. [Shell](#shell)
7. [Notification](#notification)
8. [Updater](#updater)
9. [Deep Linking](#deep-linking)
10. [전체 플러그인 목록](#전체-플러그인-목록)

---

## 플러그인 설치 공통

모든 플러그인은 동일한 패턴으로 설치한다:

```bash
# 자동 설치 (권장) — Cargo.toml, lib.rs, package.json 모두 업데이트
npm run tauri add <plugin-name>
```

수동 설치 시:
1. `cargo add tauri-plugin-<name>` (Rust)
2. `lib.rs`에서 `.plugin(tauri_plugin_<name>::init())` 등록
3. `npm install @tauri-apps/plugin-<name>` (JavaScript)
4. `src-tauri/capabilities/default.json`에 권한 추가

## File System

파일 시스템 읽기/쓰기/감시 기능.

### 설치
```bash
npm run tauri add fs
```

### JavaScript API
```javascript
import { readTextFile, writeTextFile, readDir, exists, mkdir, remove } from '@tauri-apps/plugin-fs';
import { BaseDirectory } from '@tauri-apps/api/path';

// 파일 읽기
const content = await readTextFile('config.json', { baseDir: BaseDirectory.AppData });

// 파일 쓰기
await writeTextFile('config.json', JSON.stringify(data), { baseDir: BaseDirectory.AppData });

// 디렉토리 읽기
const entries = await readDir('', { baseDir: BaseDirectory.AppData });

// 디렉토리 생성
await mkdir('my-folder', { baseDir: BaseDirectory.AppData, recursive: true });

// 존재 여부
const fileExists = await exists('config.json', { baseDir: BaseDirectory.AppData });

// 삭제 (디렉토리는 recursive: true)
await remove('old-file.txt', { baseDir: BaseDirectory.AppData });
```

### 파일 감시 (watch feature 필요)
```javascript
import { watch, watchImmediate } from '@tauri-apps/plugin-fs';

const stop = await watch('path/to/dir', (event) => {
    console.log('변경:', event);
}, { baseDir: BaseDirectory.AppData, delayMs: 500 });
// stop() 으로 해제
```

### 권한 설정
```json
{
  "permissions": [
    "fs:default",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    {
      "identifier": "fs:scope",
      "allow": ["$APPDATA/**", "$RESOURCE/**"],
      "deny": ["$APPDATA/secrets/**"]
    }
  ]
}
```

### 보안 특성
- 경로 탐색(path traversal) 방지 — 상위 디렉토리 접근자 차단
- base directory 또는 path API로 생성한 경로만 허용
- deny scope는 항상 allow scope를 오버라이드

### 플랫폼 주의사항
- **Windows**: MSI/NSIS 앱이 관리자 모드면 `$RESOURCES` 접근에 권한 상승 필요
- **Linux/macOS**: `$RESOURCES` 폴더에 쓰기 불가
- **모바일**: 기본적으로 앱 폴더만 접근 가능
- **Android**: 리소스는 APK 에셋으로 저장됨 (`asset://localhost/`)

## HTTP Client

HTTP 요청 기능 (`reqwest` 래퍼).

### 설치
```bash
npm run tauri add http
```

### JavaScript API
```javascript
import { fetch } from '@tauri-apps/plugin-http';

const response = await fetch('https://api.example.com/data', {
    method: 'GET',
    headers: { 'Authorization': 'Bearer token' },
});
console.log(response.status);
const data = await response.json();
```

### Rust API
```rust
use tauri_plugin_http::reqwest;
let res = reqwest::get("https://api.example.com/data").await?;
```

### 권한 설정 (URL scope 필수)
```json
{
  "permissions": [
    {
      "identifier": "http:default",
      "allow": [{ "url": "https://*.example.com" }],
      "deny": [{ "url": "https://internal.example.com" }]
    }
  ]
}
```

### unsafe-headers feature
```toml
# Cargo.toml — 일반적으로 차단되는 헤더 허용
tauri-plugin-http = { version = "2", features = ["unsafe-headers"] }
```

## Dialog

네이티브 시스템 다이얼로그 (파일 선택, 메시지, 확인).

### 설치
```bash
npm run tauri add dialog
```

### JavaScript API
```javascript
import { open, save, ask, confirm, message } from '@tauri-apps/plugin-dialog';

// 파일 선택
const file = await open({ multiple: false, directory: false,
    filters: [{ name: 'Images', extensions: ['png', 'jpg'] }]
});

// 저장 다이얼로그
const savePath = await save({
    filters: [{ name: 'Text', extensions: ['txt'] }]
});

// 확인 다이얼로그
const yes = await ask('정말 삭제하시겠습니까?', { title: 'MyApp', kind: 'warning' });

// 메시지
await message('작업이 완료되었습니다.', { title: 'MyApp' });
```

### Rust API
```rust
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

// 파일 선택
let file_path = app.dialog().file().blocking_pick_file();

// 저장
let save_path = app.dialog().file()
    .add_filter("Images", &["png", "jpg"])
    .blocking_save_file();

// 확인
let answer = app.dialog()
    .message("정말 삭제하시겠습니까?")
    .buttons(MessageDialogButtons::OkCancelCustom("Yes", "No"))
    .blocking_show();

// 에러 메시지
app.dialog()
    .message("파일을 찾을 수 없습니다.")
    .kind(MessageDialogKind::Error)
    .blocking_show();
```

### 반환 형식
- **데스크톱**: 파일 시스템 경로
- **iOS**: `file://<path>` URI
- **Android**: Content URI (fs 플러그인과 호환)

## Store

영구 키-값 저장소.

### 설치
```bash
npm run tauri add store
```

### JavaScript API
```javascript
import { load } from '@tauri-apps/plugin-store';

const store = await load('store.json', { autoSave: false });

await store.set('theme', 'dark');
const theme = await store.get('theme');
await store.save(); // autoSave: false일 때 수동 저장

// LazyStore (필요할 때 로드)
import { LazyStore } from '@tauri-apps/plugin-store';
const lazyStore = new LazyStore('settings.json');
```

### Rust API
```rust
use tauri_plugin_store::StoreExt;
use serde_json::json;

let store = app.store("store.json")?;
store.set("theme", json!("dark"));
let value = store.get("theme");
store.close_resource(); // 리소스 해제
```

## Shell

시스템 셸 접근, 자식 프로세스 실행.

### 설치
```bash
npm run tauri add shell
```

### JavaScript API
```javascript
import { Command } from '@tauri-apps/plugin-shell';

// 커맨드 실행
const output = await Command.create('exec-sh', ['-c', "echo 'Hello'"]).execute();
console.log(output.stdout);

// URL 열기
import { open } from '@tauri-apps/plugin-shell';
await open('https://tauri.app');
```

### Rust API
```rust
use tauri_plugin_shell::ShellExt;

let output = tauri::async_runtime::block_on(async move {
    app.shell().command("echo").args(["Hello"]).output().await.unwrap()
});
```

### 사이드카 실행
```rust
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

let (mut rx, mut child) = app.shell().sidecar("my-sidecar").unwrap().spawn()?;
tauri::async_runtime::spawn(async move {
    while let Some(event) = rx.recv().await {
        if let CommandEvent::Stdout(line) = event {
            println!("{}", String::from_utf8_lossy(&line));
        }
    }
});
```

### 권한 설정 (커맨드 실행 시 세밀한 제어 필요)
```json
{
  "permissions": [
    "shell:allow-open",
    {
      "identifier": "shell:allow-execute",
      "allow": [{
        "name": "exec-sh",
        "cmd": "sh",
        "args": ["-c", { "validator": "\\S+" }],
        "sidecar": false
      }]
    }
  ]
}
```

### 기본 권한
`shell:default` — http(s)://, tel:, mailto: 링크 열기만 허용

## Notification

네이티브 알림.

### JavaScript API
```javascript
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

let granted = await isPermissionGranted();
if (!granted) {
    const permission = await requestPermission();
    granted = permission === 'granted';
}
if (granted) {
    sendNotification({ title: 'MyApp', body: '작업 완료!' });
}
```

### Rust API
```rust
use tauri_plugin_notification::NotificationExt;
app.notification().builder()
    .title("MyApp").body("작업 완료!")
    .show().unwrap();
```

### 채널 (Android 중심)
```javascript
import { createChannel, Importance } from '@tauri-apps/plugin-notification';
await createChannel({
    id: 'messages', name: 'Messages',
    importance: Importance.High, vibration: true,
});
sendNotification({ title: 'New', body: 'Message', channelId: 'messages' });
```

## Updater

자동 앱 업데이트 (데스크톱 전용).

### 설정 (tauri.conf.json)
```json
{
  "bundle": { "createUpdaterArtifacts": true },
  "plugins": {
    "updater": {
      "pubkey": "YOUR_PUBLIC_KEY",
      "endpoints": ["https://releases.myapp.com/{{target}}/{{arch}}/{{current_version}}"]
    }
  }
}
```

### 키 생성
```bash
npm run tauri signer generate -- -w ~/.tauri/myapp.key
```

### 빌드 시 환경변수
```bash
export TAURI_SIGNING_PRIVATE_KEY="path/or/content"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
```

### JavaScript API
```javascript
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

const update = await check();
if (update) {
    await update.downloadAndInstall((event) => {
        switch (event.event) {
            case 'Started': console.log(`크기: ${event.data.contentLength}`); break;
            case 'Progress': console.log(`진행: ${event.data.chunkLength}`); break;
            case 'Finished': console.log('완료'); break;
        }
    });
    await relaunch();
}
```

### 업데이트 서버 응답 형식
```json
{
  "version": "2.0.0",
  "notes": "릴리스 노트",
  "pub_date": "2024-01-01T00:00:00Z",
  "platforms": {
    "linux-x86_64": { "url": "https://...", "signature": "sig_content" }
  }
}
```
- 업데이트 없음: HTTP 204 No Content
- 업데이트 있음: HTTP 200 + JSON 메타데이터

### 엔드포인트 변수
- `{{current_version}}`: 현재 앱 버전
- `{{target}}`: OS (linux, windows, darwin)
- `{{arch}}`: 아키텍처 (x86_64, aarch64, armv7)

## Deep Linking

커스텀 URL 스킴 처리.

### 설정 (tauri.conf.json)
```json
{
  "plugins": {
    "deep-link": {
      "desktop": { "schemes": ["my-app"] },
      "mobile": [{ "scheme": ["https"], "host": "myapp.com", "pathPrefix": ["/open"] }]
    }
  }
}
```

### JavaScript API
```javascript
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link';

const startUrls = await getCurrent(); // 앱 시작 시 딥링크
await onOpenUrl((urls) => console.log('deep link:', urls));
```

### 데스크톱에서 single-instance와 함께 사용 권장
```rust
#[cfg(desktop)]
builder = builder.plugin(tauri_plugin_single_instance::init(|_app, argv, _cwd| {
    println!("deep link: {:?}", argv);
}));
```

## 전체 플러그인 목록

| 플러그인 | npm 패키지 | 설명 |
|---------|-----------|------|
| autostart | `@tauri-apps/plugin-autostart` | 시스템 시작 시 앱 자동 실행 |
| barcode-scanner | `@tauri-apps/plugin-barcode-scanner` | 바코드/QR 스캔 (모바일) |
| biometric | `@tauri-apps/plugin-biometric` | 생체인증 (모바일) |
| cli | `@tauri-apps/plugin-cli` | CLI 인자 파싱 |
| clipboard-manager | `@tauri-apps/plugin-clipboard-manager` | 클립보드 읽기/쓰기 |
| deep-link | `@tauri-apps/plugin-deep-link` | 커스텀 URL 스킴 |
| dialog | `@tauri-apps/plugin-dialog` | 네이티브 다이얼로그 |
| fs | `@tauri-apps/plugin-fs` | 파일 시스템 |
| geolocation | `@tauri-apps/plugin-geolocation` | 위치 정보 (모바일) |
| global-shortcut | `@tauri-apps/plugin-global-shortcut` | 전역 키보드 단축키 |
| haptics | `@tauri-apps/plugin-haptics` | 진동 피드백 (모바일) |
| http | `@tauri-apps/plugin-http` | HTTP 요청 |
| localhost | `@tauri-apps/plugin-localhost` | 로컬호스트 서버 |
| log | `@tauri-apps/plugin-log` | 로깅 |
| nfc | `@tauri-apps/plugin-nfc` | NFC (모바일) |
| notification | `@tauri-apps/plugin-notification` | 네이티브 알림 |
| opener | `@tauri-apps/plugin-opener` | URL/파일 열기 |
| os | `@tauri-apps/plugin-os` | OS 정보 |
| persisted-scope | `@tauri-apps/plugin-persisted-scope` | 지속적 scope |
| positioner | `@tauri-apps/plugin-positioner` | 윈도우 위치 관리 |
| process | `@tauri-apps/plugin-process` | 프로세스 관리 (exit, relaunch) |
| shell | `@tauri-apps/plugin-shell` | 셸/프로세스 실행 |
| single-instance | `@tauri-apps/plugin-single-instance` | 단일 인스턴스 |
| sql | `@tauri-apps/plugin-sql` | SQLite/MySQL/PostgreSQL |
| store | `@tauri-apps/plugin-store` | 키-값 영구 저장소 |
| stronghold | `@tauri-apps/plugin-stronghold` | 암호화 저장소 |
| updater | `@tauri-apps/plugin-updater` | 자동 업데이트 |
| upload | `@tauri-apps/plugin-upload` | 파일 업로드 |
| websocket | `@tauri-apps/plugin-websocket` | WebSocket 클라이언트 |
| window-state | `@tauri-apps/plugin-window-state` | 윈도우 상태 복원 |
