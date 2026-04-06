# Tauri v2 설정 파일 레퍼런스

> 출처: https://v2.tauri.app/develop/configuration-files/ , https://v2.tauri.app/reference/config/

## 목차
1. [설정 파일 개요](#설정-파일-개요)
2. [tauri.conf.json 전체 구조](#tauriconfjson-전체-구조)
3. [주요 설정 필드 상세](#주요-설정-필드-상세)
4. [플랫폼별 설정](#플랫폼별-설정)
5. [Cargo.toml](#cargotoml)
6. [package.json](#packagejson)

---

## 설정 파일 개요

Tauri는 3개 설정 파일을 사용한다:
- `tauri.conf.json` (또는 `.json5`, `Tauri.toml`) — Tauri 핵심 설정
- `Cargo.toml` — Rust 의존성
- `package.json` — JS 의존성, 스크립트

### 지원 포맷

| 포맷 | 파일명 | 추가 설정 |
|------|--------|-----------|
| JSON (기본) | `tauri.conf.json` | 없음 |
| JSON5 | `tauri.conf.json5` | Cargo.toml에 `config-json5` feature 추가 |
| TOML | `Tauri.toml` | Cargo.toml에 `config-toml` feature 추가 |

JSON5/TOML 활성화:
```toml
[build-dependencies]
tauri-build = { version = "2.0.0", features = ["config-json5"] }

[dependencies]
tauri = { version = "2.0.0", features = ["config-json5"] }
```

## tauri.conf.json 전체 구조

```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-schema-generator/schemas/config.schema.json",
  "productName": "MyApp",
  "version": "0.1.0",
  "identifier": "com.example.myapp",
  "build": {
    "devUrl": "http://localhost:3000",
    "frontendDist": "../dist",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "beforeBundleCommand": "",
    "features": []
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "MyApp",
        "width": 800,
        "height": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "capabilities": [],
      "csp": null,
      "freezePrototype": false
    },
    "trayIcon": null,
    "withGlobalTauri": false,
    "enableGTKAppId": false,
    "macOSPrivateApi": false
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.icns", "icons/icon.ico"],
    "resources": [],
    "externalBin": [],
    "copyright": "",
    "license": "",
    "fileAssociations": []
  },
  "plugins": {}
}
```

## 주요 설정 필드 상세

### 최상위 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `identifier` | string | **Yes** | 역도메인 ID (예: `com.tauri.example`). 영숫자, 하이픈, 마침표만 |
| `productName` | string \| null | No | 앱 표시명 |
| `version` | string \| null | No | Semver 버전 또는 package.json 경로 |
| `mainBinaryName` | string \| null | No | 바이너리 파일명 오버라이드 |

### BuildConfig

| 필드 | 타입 | 설명 |
|------|------|------|
| `devUrl` | string (URI) | 개발 서버 URL (예: `http://localhost:3000`) |
| `frontendDist` | string \| null | 빌드된 프론트엔드 에셋 경로 또는 URL |
| `beforeDevCommand` | string \| null | `tauri dev` 전 실행할 스크립트 |
| `beforeBuildCommand` | string \| null | `tauri build` 전 실행할 스크립트 |
| `beforeBundleCommand` | string \| null | 번들링 전 실행할 스크립트 |
| `features` | string[] \| null | 활성화할 Cargo feature |
| `additionalWatchFolders` | string[] | `tauri dev` 중 감시할 추가 경로 |
| `removeUnusedCommands` | boolean | 빌드 시 미사용 플러그인 커맨드 제거 |

### AppConfig

| 필드 | 타입 | 설명 |
|------|------|------|
| `windows` | WindowConfig[] | 윈도우 정의 배열 (기본: `[]`) |
| `security` | SecurityConfig | CSP, capabilities, 에셋 프로토콜 |
| `trayIcon` | TrayIconConfig \| null | 시스템 트레이 설정 |
| `withGlobalTauri` | boolean | `window.__TAURI__`에 API 주입 |
| `enableGTKAppId` | boolean | GTK에서 identifier를 app ID로 설정 |
| `macOSPrivateApi` | boolean | 투명 배경, 전체 화면 API 활성화 |

### WindowConfig

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `label` | string | `"main"` | 윈도우 식별자 |
| `title` | string | `"Tauri"` | 윈도우 제목 |
| `width` / `height` | number | 800/600 | 논리 픽셀 크기 |
| `minWidth` / `minHeight` | number | - | 최소 크기 제약 |
| `maxWidth` / `maxHeight` | number | - | 최대 크기 제약 |
| `x` / `y` | number | - | 초기 위치 |
| `fullscreen` | boolean | false | 전체화면 시작 |
| `resizable` | boolean | true | 크기 조절 허용 |
| `maximized` | boolean | false | 최대화 시작 |
| `visible` | boolean | true | 생성 시 표시 여부 |
| `decorations` | boolean | true | 네이티브 윈도우 장식 표시 |
| `alwaysOnTop` | boolean | false | 항상 위 |
| `transparent` | boolean | false | 투명 배경 |
| `skipTaskbar` | boolean | false | 태스크바에서 숨김 |
| `focus` | boolean | true | 생성 시 포커스 |
| `create` | boolean | true | 시작 시 윈도우 생성 |

### BundleConfig

| 필드 | 타입 | 설명 |
|------|------|------|
| `active` | boolean | 번들링 활성화 (기본: false) |
| `targets` | string \| "all" | 번들 타입 (deb, appimage, msi, dmg 등) |
| `icon` | string[] | 앱 아이콘 경로 목록 |
| `resources` | string[] \| object | 번들할 추가 파일 |
| `externalBin` | string[] | 번들할 외부 바이너리 (사이드카) |
| `fileAssociations` | array \| null | 파일 타입 연결 |
| `createUpdaterArtifacts` | boolean \| "v1Compatible" | 업데이터 아티팩트 생성 |

### 플랫폼별 BundleConfig

| 필드 | 설명 |
|------|------|
| `bundle.android` | `minSdkVersion` (기본: 24), `versionCode` |
| `bundle.iOS` | `minimumSystemVersion` (기본: "14.0") |
| `bundle.linux` | AppImage, deb, rpm 설정 |
| `bundle.macOS` | DMG, notarization, `minimumSystemVersion` (기본: "10.13") |
| `bundle.windows` | NSIS, WiX, WebView 설치 모드, 코드 서명 |

## 플랫폼별 설정

플랫폼별 오버라이드 파일 (JSON Merge Patch RFC 7396):
- `tauri.linux.conf.json` / `Tauri.linux.toml`
- `tauri.windows.conf.json` / `Tauri.windows.toml`
- `tauri.macos.conf.json` / `Tauri.macos.toml`
- `tauri.android.conf.json` / `Tauri.android.toml`
- `tauri.ios.conf.json` / `Tauri.ios.toml`

```json
// tauri.conf.json (기본)
{ "productName": "MyApp", "bundle": { "resources": ["./resources"] } }

// tauri.linux.conf.json (Linux 오버라이드)
{ "productName": "my-app", "bundle": { "resources": ["./linux-assets"] } }
```

### CLI에서 설정 확장
```bash
npm run tauri build -- --config src-tauri/tauri.beta.conf.json
cargo tauri build --config '{"identifier":"com.example.beta"}'
```

## Cargo.toml

```toml
[package]
name = "app"
version = "0.1.0"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2.0.0" }

[dependencies]
serde_json = "1.0"
serde = { version = "1.0", features = ["derive"] }
tauri = { version = "2.0.0", features = [] }
```

**주의사항:**
- `tauri`와 `tauri-build` 마이너 버전을 CLI와 동일하게 유지
- 정확한 버전 고정: `tauri-build = { version = "=2.0.0" }`
- `Cargo.lock`은 반드시 커밋
- Feature flags는 `tauri dev`/`tauri build`가 `tauri.conf.json` 기반으로 자동 관리

## package.json

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/cli": "^2.0.0"
  }
}
```

- `beforeDevCommand` / `beforeBuildCommand`에서 이 스크립트를 참조
- 락 파일 (`yarn.lock`, `pnpm-lock.yaml`, `package-lock.json`) 커밋 필수
