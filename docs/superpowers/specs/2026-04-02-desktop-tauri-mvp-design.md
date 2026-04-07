# han-ai-orchestrator Desktop (Tauri v2 MVP)

## 개요

기존 `packages/web-ui`를 Tauri v2로 래핑하여 데스크탑 에이전트 앱을 만든다. LLM 호출과 에이전트 로직은 브라우저 측 JavaScript에서 실행되며, Tauri Rust 백엔드는 파일 시스템 접근 등 네이티브 기능만 담당한다.

### 목표

- Cicely AI와 유사한 데스크탑 에이전트 앱
- 기존 web-ui 패키지 최대 재사용
- 로컬 파일 접근 (열기/저장 다이얼로그, 드래그앤드롭)
- 경량 번들 (~10MB, Electron 대비 1/15)

### 비목표 (향후)

- 시스템 트레이, 글로벌 단축키, 자동 시작
- 자동 업데이트 (electron-updater 대응)
- 사내 인증 (LDAP/SSO)
- HWP/Excel COM 자동화

## 아키텍처

```
packages/desktop/
├── src-tauri/              # Rust 백엔드
│   ├── src/
│   │   ├── main.rs         # Tauri 앱 진입점
│   │   ├── commands.rs     # IPC 커맨드 (파일 열기/저장)
│   │   └── lib.rs
│   ├── Cargo.toml
│   ├── tauri.conf.json     # 앱 설정 (창 크기, 이름, 권한)
│   └── capabilities/       # Tauri v2 권한 설정
│       └── default.json
├── src/                    # 프론트엔드 (web-ui 기반)
│   ├── main.ts             # web-ui example 기반, Tauri IPC 연동
│   ├── tauri-bridge.ts     # Tauri invoke 래퍼
│   ├── app.css
│   └── custom-messages.ts
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

### 데이터 흐름

```
WebView (시스템 WebView)
├── web-ui (Lit + Tailwind)
│   ├── ChatPanel, AgentInterface
│   ├── Agent (pi-agent-core) — 브라우저에서 실행
│   ├── LLM API 직접 호출 (pi-ai) — HTTPS
│   └── IndexedDB — 세션 저장
│
│  invoke() / IPC
│
└── Tauri Rust Backend
    ├── open_file_dialog()
    ├── save_file_dialog()
    ├── read_file()
    ├── write_file()
    └── read_dropped_files()
```

핵심: 원격 백엔드 서버가 없다. Agent와 LLM API 호출이 모두 브라우저(WebView) 측에서 직접 실행된다.

## Tauri IPC 커맨드

| 커맨드 | 인자 | 반환 | 설명 |
|--------|------|------|------|
| `open_file_dialog` | `filters: FileFilter[]` | `string[]` (경로) | 파일 선택 다이얼로그 |
| `save_file_dialog` | `defaultName: string, filters: FileFilter[]` | `string` (경로) | 파일 저장 다이얼로그 |
| `read_file` | `path: string` | `Uint8Array` | 파일 읽기 (바이너리) |
| `read_file_text` | `path: string` | `string` | 파일 읽기 (텍스트) |
| `write_file` | `path: string, contents: Uint8Array` | `void` | 파일 쓰기 |

Tauri v2 플러그인 `tauri-plugin-dialog`와 `tauri-plugin-fs`를 활용한다.

## 프론트엔드 구조

`web-ui/example/src/main.ts`를 기반으로 하되, 다음을 변경한다:

1. **tauri-bridge.ts**: Tauri `@tauri-apps/api` invoke 래퍼. 파일 다이얼로그, 파일 읽기/쓰기를 추상화.
2. **main.ts**: example의 main.ts를 복사 후 수정. 헤더에 앱 이름 변경, 파일 관련 기능에 tauri-bridge 연동.
3. **app.css**: Tailwind v4 import + 커스텀 스타일.

기존 web-ui 컴포넌트(ChatPanel, AgentInterface, ArtifactsPanel 등)는 npm 의존성으로 그대로 사용한다.

## 기술 스택

| 항목 | 선택 | 버전 |
|------|------|------|
| 데스크탑 프레임워크 | Tauri | v2 |
| 프론트엔드 빌드 | Vite | 7.x |
| UI 컴포넌트 | @mariozechner/pi-web-ui | 0.64.x |
| UI 라이브러리 | Lit | 3.x |
| CSS | Tailwind CSS | v4 |
| 로컬 저장소 | IndexedDB | (브라우저 내장) |
| Rust 에디션 | 2021 | |

## 빌드/실행

```bash
# 사전 요구사항
# - Rust toolchain (rustup)
# - Node.js 20+
# - 시스템별: Linux(webkit2gtk-4.1, libappindicator3), macOS(Xcode CLT), Windows(MSVC)

# 개발 모드
cd packages/desktop
npm install
npm run tauri dev

# 프로덕션 빌드
npm run tauri build
# → src-tauri/target/release/bundle/ 에 설치 파일 생성
```

## MVP 기능 범위

| 기능 | 구현 방식 |
|------|----------|
| 대화 UI | web-ui ChatPanel 그대로 |
| 모델 선택 | web-ui ModelSelector (Anthropic, OpenAI, Ollama 등) |
| 스트리밍 응답 | pi-ai 스트림 (브라우저 fetch) |
| 아티팩트 | web-ui ArtifactsPanel (HTML, SVG, Markdown, 코드 등) |
| 세션 저장/불러오기 | IndexedDB (web-ui SessionsStore) |
| 설정 | web-ui SettingsDialog (API 키, 프록시) |
| 다크/라이트 테마 | mini-lit ThemeToggle |
| 파일 열기 다이얼로그 | Tauri plugin-dialog |
| 파일 저장 다이얼로그 | Tauri plugin-dialog |
| 파일 드래그앤드롭 | Tauri 이벤트 + web-ui attachments |
| JavaScript REPL | web-ui createJavaScriptReplTool (샌드박스) |

## 보안 고려사항

- Tauri v2의 capabilities 시스템으로 파일 접근 범위 제한
- CSP 헤더 설정 (LLM API 도메인만 허용)
- API 키는 IndexedDB에 저장 (web-ui 기존 방식). 향후 OS keychain 연동 고려.
- 시스템 WebView 사용으로 Chromium 번들 취약점 회피
