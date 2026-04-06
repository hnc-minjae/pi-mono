# Tauri v2 보안 & 권한 레퍼런스

> 출처: https://v2.tauri.app/security/

## 목차
1. [보안 모델 개요](#보안-모델-개요)
2. [Capabilities (역할)](#capabilities)
3. [Permissions (권한)](#permissions)
4. [Scopes (범위)](#scopes)
5. [설정 예시](#설정-예시)

---

## 보안 모델 개요

Tauri v2는 3계층 보안 모델을 사용한다:
- **Capabilities**: 어떤 윈도우/웹뷰에 어떤 권한을 부여할지 정의
- **Permissions**: 특정 커맨드의 허용/거부를 명시
- **Scopes**: 커맨드가 접근할 수 있는 리소스 범위를 제한

```
Capability → Permission → Scope
(윈도우 매핑)  (커맨드 허용)  (리소스 범위)
```

## Capabilities

Capability는 **특정 윈도우에 부여할 권한 집합**을 정의한다.

### 파일 기반 정의

`src-tauri/capabilities/` 디렉토리의 JSON/TOML 파일은 자동으로 활성화된다.

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Main window capabilities",
  "windows": ["main"],
  "permissions": [
    "core:path:default",
    "core:window:default",
    "core:window:allow-set-title",
    "fs:default",
    "dialog:default"
  ]
}
```

### tauri.conf.json 인라인

```json
{
  "app": {
    "security": {
      "capabilities": [
        {
          "identifier": "inline-capability",
          "windows": ["*"],
          "permissions": ["fs:default"]
        }
      ]
    }
  }
}
```

### 윈도우 타겟팅
- `"windows": ["main"]` — 특정 윈도우
- `"windows": ["*"]` — 모든 윈도우
- `"windows": ["editor", "viewer"]` — 복수 윈도우

### 플랫폼별 Capability

```json
{
  "identifier": "desktop-capability",
  "platforms": ["linux", "macOS", "windows"],
  "windows": ["main"],
  "permissions": ["global-shortcut:allow-register"]
}
```

```json
{
  "identifier": "mobile-capability",
  "platforms": ["iOS", "android"],
  "windows": ["main"],
  "permissions": ["nfc:allow-scan", "biometric:allow-authenticate"]
}
```

### 원격 접근 (Remote API Access)

외부 URL에 Tauri API 접근을 허용:
```json
{
  "identifier": "remote-capability",
  "remote": {
    "urls": ["https://*.tauri.app"]
  },
  "permissions": ["nfc:allow-scan"]
}
```

> **주의**: Linux/Android에서는 `<iframe>`과 윈도우 자체의 요청을 구분할 수 없음

### 스키마 유효성 검증

Tauri는 `gen/schemas/`에 플랫폼별 JSON 스키마를 생성한다. `$schema` 필드로 IDE 자동완성 가능.

## Permissions

Permission은 **특정 커맨드에 대한 명시적 권한**이다.

### 식별자 형식
- `<name>:default` — 플러그인/앱의 기본 권한
- `<name>:<command-name>` — 개별 커맨드 권한
- `allow-` / `deny-` 접두사

예시:
```
core:default                    # 코어 기본 권한
core:window:allow-set-title     # 윈도우 제목 설정 허용
fs:allow-read-text-file         # 텍스트 파일 읽기 허용
fs:deny-write-file              # 파일 쓰기 거부
```

### 식별자 제약
- 소문자 ASCII [a-z] + 하이픈
- 최대 116자
- 플러그인 접두사 `tauri-plugin-`은 컴파일 타임에 자동 추가

### 파일 구조

**플러그인:**
```
tauri-plugin-xxx/permissions/
├── <identifier>.json/toml
└── default.json/toml
```

**앱:**
```
src-tauri/permissions/
├── <identifier>.toml
└── ...
```

### 커스텀 Permission 정의 (TOML)

```toml
[[permission]]
identifier = "allow-my-read"
description = "Allow reading app data"

[[permission.scope.allow]]
path = "$APPDATA/*"
```

### Permission Set (그룹)

여러 permission을 하나의 세트로 묶기:
```toml
[[set]]
identifier = "my-app-permissions"
permissions = [
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "dialog:default"
]
```

## Scopes

Scope는 커맨드가 접근 가능한 **리소스 범위를 세밀하게 제한**한다.

### 핵심 규칙
- **deny는 항상 allow보다 우선한다**
- Scope 타입은 `serde` 직렬화 가능한 모든 타입

### 경로 변수

| 변수 | 설명 |
|------|------|
| `$APPCONFIG` | 앱 설정 디렉토리 |
| `$APPDATA` | 앱 데이터 디렉토리 |
| `$APPLOCALDATA` | 앱 로컬 데이터 디렉토리 |
| `$APPCACHE` | 앱 캐시 디렉토리 |
| `$APPLOG` | 앱 로그 디렉토리 |
| `$HOME` | 사용자 홈 디렉토리 |
| `$TEMP` | 임시 디렉토리 |
| `$RESOURCE` | 번들된 리소스 디렉토리 |
| `$DESKTOP` | 데스크톱 |
| `$DOCUMENT` | 문서 |
| `$DOWNLOAD` | 다운로드 |

### FS 플러그인 Scope 예시

```toml
[[permission]]
identifier = "scope-appdata"
[[permission.scope.allow]]
path = "$APPDATA/**"
```

### HTTP 플러그인 Scope 예시

URL 패턴으로 접근 가능 도메인 제한:
```json
{
  "identifier": "http:default",
  "allow": [{ "url": "https://*.myapi.com" }],
  "deny": [{ "url": "https://internal.myapi.com" }]
}
```

### Scope 조합

```toml
[[set]]
identifier = "scope-reasonable"
permissions = ["scope-appdata-recursive", "deny-dangerous-paths"]
```

> **중요**: 커맨드 개발자는 scope 바이패스가 불가능하도록 직접 검증해야 한다. 프레임워크가 아닌 커맨드 자체에서 enforcement를 수행.

## 설정 예시

### 일반적인 데스크톱 앱

`src-tauri/capabilities/default.json`:
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capabilities for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:default",
    "core:window:allow-set-title",
    "core:window:allow-close",
    "core:window:allow-minimize",
    "core:window:allow-maximize",
    "fs:default",
    {
      "identifier": "fs:scope",
      "allow": ["$APPDATA/**", "$RESOURCE/**"],
      "deny": ["$APPDATA/secrets/**"]
    },
    "dialog:default",
    "store:default",
    {
      "identifier": "http:default",
      "allow": [{ "url": "https://api.myapp.com/**" }]
    },
    "notification:default",
    "shell:allow-open"
  ]
}
```

### 플러그인별 기본 권한 (자주 사용)

| 플러그인 | 기본 권한 ID |
|---------|-------------|
| File System | `fs:default` |
| Dialog | `dialog:default` |
| HTTP | `http:default` (+ URL scope 필요) |
| Store | `store:default` |
| Shell | `shell:default` (open만 허용) |
| Notification | `notification:default` |
| Clipboard | `clipboard-manager:default` |
| Updater | `updater:default` |
| Process | `process:default` |
| Global Shortcut | `global-shortcut:default` |
| Deep Link | `deep-link:default` |
