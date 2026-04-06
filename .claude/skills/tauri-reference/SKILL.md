---
name: tauri-reference
description: Tauri v2 데스크톱/모바일 앱 개발 기술 레퍼런스. Tauri 프로젝트에서 코드를 작성하거나 수정할 때 반드시 참조한다. tauri.conf.json 설정, Rust 커맨드 정의, JS↔Rust IPC, 이벤트 시스템, 플러그인 사용법, 보안 권한(capabilities/permissions/scopes), 윈도우 커스터마이징, 시스템 트레이, CLI 명령어 등 Tauri v2 개발 전반을 다룬다. @tauri-apps import, #[tauri::command], tauri.conf.json, capabilities/, permissions/ 키워드가 보이면 이 스킬을 사용한다.
---

# Tauri v2 Development Reference

이 스킬은 Tauri v2 기반 데스크톱/모바일 앱 개발에 필요한 핵심 기술 레퍼런스를 제공한다.
수집된 문서는 https://v2.tauri.app 공식 문서 기반이며, 개발 시 필요한 패턴과 API를 즉시 참조할 수 있도록 구성되어 있다.

## 레퍼런스 구조

필요한 토픽에 해당하는 reference 파일을 Read하여 참조한다.

| 토픽 | 파일 | 참조 시점 |
|------|------|-----------|
| 아키텍처 & 핵심 개념 | `references/architecture-and-concepts.md` | 프로세스 모델, IPC 구조 이해가 필요할 때 |
| 커맨드 & IPC | `references/commands-and-ipc.md` | Rust 커맨드 정의, JS에서 호출, 이벤트, 채널 |
| 설정 파일 | `references/configuration.md` | tauri.conf.json, Cargo.toml, 플랫폼별 설정 |
| 보안 & 권한 | `references/security-and-permissions.md` | capabilities, permissions, scopes 설정 |
| 플러그인 | `references/plugins.md` | 공식 플러그인 설치/사용법 (fs, http, dialog, store 등) |
| 윈도우 & 트레이 | `references/window-and-tray.md` | 윈도우 커스터마이징, 시스템 트레이, 상태 관리 |
| CLI | `references/cli.md` | tauri dev/build/add 등 CLI 커맨드 |

## 빠른 참조 가이드

### 프로젝트 구조
```
my-tauri-app/
├── src/                    # 프론트엔드 소스
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs          # 앱 진입점, 커맨드 등록
│   │   └── commands.rs     # 커맨드 모듈 (선택)
│   ├── capabilities/       # 보안 capability 파일
│   ├── permissions/        # 커스텀 permission 파일
│   ├── icons/              # 앱 아이콘
│   ├── Cargo.toml          # Rust 의존성
│   └── tauri.conf.json     # Tauri 설정
├── package.json
└── ...
```

### 핵심 패턴 요약

**Rust 커맨드 정의 → JS 호출:**
```rust
#[tauri::command]
fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}

// lib.rs에서 등록
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![greet])
```
```javascript
import { invoke } from '@tauri-apps/api/core';
const result = await invoke('greet', { name: 'World' });
```

**Rust → 프론트엔드 이벤트:**
```rust
use tauri::Emitter;
app.emit("event-name", payload).unwrap();
```
```javascript
import { listen } from '@tauri-apps/api/event';
await listen('event-name', (event) => { /* ... */ });
```

**플러그인 추가:**
```bash
npm run tauri add <plugin-name>   # 자동 설치
```

**권한 설정 (src-tauri/capabilities/default.json):**
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:default",
    "dialog:default"
  ]
}
```

## 외부 참조

- 공식 문서: https://v2.tauri.app
- Rust API (docs.rs): https://docs.rs/tauri/~2/
- JavaScript API: https://v2.tauri.app/reference/javascript/api/
- GitHub: https://github.com/tauri-apps/tauri
