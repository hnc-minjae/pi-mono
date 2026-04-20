# Desktop App Reference

## 개요

Tauri v2 + Lit + Vite 기반 데스크톱 앱. Node.js bridge 서버를 통해 coding-agent RPC 프로세스와 통신.

## 디렉토리 구조

```
packages/desktop/
├── src/                          # 프론트엔드 (Lit + Vite + Tailwind)
│   ├── main.ts                   # 앱 엔트리, 세션 관리, 설정 UI
│   ├── rpc-adapter.ts            # WebSocket RPC 어댑터 (RpcAgent)
│   ├── mcp-settings-tab.ts       # MCP 설정 탭 (Lit 컴포넌트)
│   ├── tauri-bridge.ts           # Tauri 네이티브 파일 I/O
│   ├── custom-messages.ts        # 시스템 알림 커스텀 렌더러
│   └── app.css                   # 글로벌 스타일
├── server/                       # Node.js bridge 서버
│   ├── start.ts                  # 서버 엔트리
│   └── bridge.ts                 # WebSocket ↔ RPC 릴레이 + MCP
├── src-tauri/                    # Rust 백엔드
│   ├── src/lib.rs                # Tauri 커맨드, bridge 프로세스 관리
│   ├── src/main.rs               # 엔트리 (release: 콘솔 숨김)
│   ├── tauri.conf.json           # 앱 설정
│   ├── Cargo.toml                # Rust 의존성
│   └── capabilities/default.json # 권한 매니페스트
├── package.json                  # npm 스크립트
├── vite.config.ts                # Vite 설정 (포트 1420)
├── tsconfig.json                 # 프론트엔드 TS 설정
└── tsconfig.server.json          # 서버 TS 설정
```

## 실행 방법

```bash
# 전체 앱 (Tauri + Vite + Bridge)
cd packages/desktop && npx tauri dev

# 프론트엔드 + 서버만 (Tauri 없이)
cd packages/desktop && npm run dev

# 프로덕션 빌드
cd packages/desktop && npx tauri build
```

## 프론트엔드 (src/)

### main.ts — 앱 엔트리

**저장소 초기화** (IndexedDB, DB명: `han-ai-desktop`):
- `SettingsStore` — 사용자 설정
- `ProviderKeysStore` — API 키
- `SessionsStore` — 채팅 세션
- `CustomProvidersStore` — 커스텀 프로바이더

**주요 함수**:
- `createAgent()` — RpcAgent 생성, WebSocket 연결, API 키 로드, 이벤트 구독
- `saveSession()` — IndexedDB에 세션 저장 (모델, 메시지, 토큰 사용량)
- `generateTitle()` — 첫 사용자 메시지에서 제목 자동 생성
- `renderApp()` — 헤더 (히스토리, 새 세션, 제목, 설정) + ChatPanel
- `createMcpTab()` — MCP 설정 탭 (서버 목록, 연결 상태)
- `initApp()` — 로딩 → 세션 확인 → 에이전트 생성 → UI 렌더링

**설정 다이얼로그 탭**: ProvidersModelsTab, ProxyTab, McpTab

### rpc-adapter.ts — RpcAgent 클래스

WebSocket(`ws://localhost:3001`)으로 bridge 서버와 통신.

**상태 관리**:
- `_state: AgentState` — messages, model, thinkingLevel, isStreaming
- `_pendingUserMessages` — 로컬에서 먼저 추가된 사용자 메시지 추적

**주요 메서드**:
- `connect(retries=20, delay=500ms)` — 재시도 연결
- `pollGetState()` — 3초 간격, 최대 60초간 RPC 상태 동기화
- `prompt(message)` — 로컬 메시지 즉시 추가 → WebSocket 전송
- `sendCommand(command)` — 요청-응답 (id 매칭, 30초 타임아웃)
- `handleAgentEvent()` — agent_start/message_update/message_end/agent_end 처리
- `getMcpStatus()` / `mcpConnect()` — MCP 상태 조회/연결
- `setApiKey()` / `setModel()` / `setThinkingLevel()` — 설정 변경

**이벤트 처리 흐름**:
- `agent_start` → isStreaming = true
- `message_update` → skip (스트리밍 컨테이너가 처리)
- `message_end` → 메시지 추가 (스킬 메타데이터 추출 포함)
- `agent_end` → isStreaming = false, 원본 사용자 텍스트 복원

### tauri-bridge.ts — 네이티브 기능

- `isTauri()` — Tauri 환경 감지
- `openFileDialog()` / `saveFileDialog()` — 파일 다이얼로그
- `readFileText()` / `readFileBinary()` / `writeFile()` — Tauri invoke

### custom-messages.ts — 시스템 알림

- `SystemNotificationMessage` — role: "system-notification", variant: "default"|"destructive"
- `customConvertToLlm()` — 시스템 알림을 `<system>` 태그 사용자 메시지로 변환

## 서버 (server/)

### bridge.ts — RPC Bridge

**프로세스 관리**:
- `spawnRpcAgent()` — `node coding-agent/dist/cli.js --mode rpc` spawn
- 환경변수: `RPC_PROVIDER`(기본 openai), `RPC_MODEL`(기본 gpt-5.4)
- 초기화 3초 후 `set_thinking_level` 전송

**WebSocket 서버** (포트 3001):
- 단일 클라이언트만 허용 (새 연결 시 기존 클라이언트 닫기)
- MCP 명령 인터셉트 (`mcp_status`, `mcp_connect`)
- 나머지 메시지는 RPC stdin으로 전달

**JSONL 버퍼링**:
- stdout 청크를 버퍼에 누적
- `\n` 기준으로 분리하여 WebSocket 클라이언트에 전송

## Tauri 백엔드 (src-tauri/)

### lib.rs — 핵심 로직

**BridgeProcess**: bridge 서버 자식 프로세스 래퍼
- `stop()`: SIGTERM (Unix) / CTRL_BREAK_EVENT (Windows) → 3초 대기 → 강제 종료
- Drop 트레잇으로 자동 정리

**Windows**: Job Object로 자식 프로세스 자동 정리 (`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`)
**Linux**: `prctl(PR_SET_PDEATHSIG, SIGTERM)` — 부모 사망 시 자동 종료

**Tauri 커맨드**:
- `read_file_text(path)` — 텍스트 파일 읽기
- `read_file_binary(path)` — 바이너리 파일 읽기
- `write_file(path, contents)` — 디렉토리 생성 + 파일 쓰기

**start_bridge_server()**:
- Debug: `tsx` 로더로 `server/start.ts` 실행
- Release: `node server/start.js` 실행
- `NODE_TLS_REJECT_UNAUTHORIZED=0` 설정

### tauri.conf.json

```json
{
  "productName": "Han AI Orchestrator",
  "identifier": "io.hancom.ai-orchestrator",
  "build": {
    "beforeDevCommand": "npm run dev:ui",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [{ "title": "Han AI Orchestrator", "width": 1200, "height": 800 }]
  }
}
```

### capabilities/default.json

권한: core:default, dialog (open/save/message/ask), fs (read/write/exists/mkdir), shell:allow-open

## 프로세스 라이프사이클

### 시작

```
npx tauri dev
  → Vite dev 서버 (포트 1420)
  → Rust 앱 시작 (lib.rs run())
    → start_bridge_server()
      → node tsx server/start.ts
        → spawnRpcAgent() (coding-agent --mode rpc)
        → WebSocket 서버 (포트 3001)
  → 프론트엔드 로드 (Webview)
    → initApp() → createAgent() → RpcAgent.connect()
    → pollGetState() → 상태 동기화
    → renderApp()
```

### 종료

```
앱 닫기 / Ctrl+C
  → Tauri RunEvent::Exit
    → BridgeProcess.stop()
      → SIGTERM / CTRL_BREAK_EVENT
      → 3초 대기 → 강제 종료
  → Windows: Job Object가 자식 프로세스 자동 정리
  → Linux: PDEATHSIG로 자식 자동 종료
```

## 컴포넌트 의존 관계

```
Tauri App (lib.rs)
  └── Bridge Server (bridge.ts, 포트 3001)
        └── RPC Agent (coding-agent --mode rpc)
              └── LLM Provider (OpenAI, Anthropic 등)

Frontend (main.ts)
  ├── RpcAgent (rpc-adapter.ts) ←→ Bridge Server (WebSocket)
  ├── ChatPanel (pi-web-ui) ← RpcAgent 이벤트 구독
  ├── SettingsDialog
  │   ├── ProvidersModelsTab
  │   ├── ProxyTab
  │   └── McpSettingsTab (mcp-settings-tab.ts)
  └── AppStorage (IndexedDB: han-ai-desktop)
        ├── SettingsStore
        ├── ProviderKeysStore
        ├── SessionsStore
        └── CustomProvidersStore
```

## 환경변수

| 변수 | 기본값 | 용도 |
|------|--------|------|
| `RPC_PROVIDER` | openai | LLM 프로바이더 |
| `RPC_MODEL` | gpt-5.4 | LLM 모델 |
| `RPC_THINKING_LEVEL` | medium | Extended thinking |
| `WS_PORT` | 3001 | Bridge WebSocket 포트 |
| `TAURI_DEV_HOST` | — | Dev 서버 호스트 오버라이드 |
