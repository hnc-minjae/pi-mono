# @hancom/han-ai-desktop

Tauri v2 기반의 한컴 데스크톱 AI 에이전트 앱입니다.

pi-mono의 `pi-web-ui` 채팅 컴포넌트와 `pi-coding-agent` RPC 모드를 결합하여, 로컬에서 실행되는 풀스택 AI 에이전트 환경을 제공합니다.

## 아키텍처

```
Tauri App (Rust)
  ├─ BridgeProcess: Node.js Bridge 서버 프로세스 관리
  ├─ Tauri Commands: read_file_text, read_file_binary, write_file
  └─ Plugins: dialog, fs, shell
       ↕
Bridge Server (server/bridge.ts, WebSocket)
  ├─ WebSocket Server (ws://localhost:3001)
  ├─ RPC Agent 프로세스 (coding-agent --mode rpc)
  └─ MCP 상태 관리 (~/.config/han/mcp-tokens.json)
       ↕
Frontend (src/main.ts, Lit + pi-web-ui)
  ├─ RpcAgent (WebSocket 클라이언트)
  ├─ ChatPanel (pi-web-ui)
  └─ IndexedDB 세션 저장소
```

## 기술 스택

- **Rust**: Tauri v2, tauri-plugin-dialog, tauri-plugin-fs, tauri-plugin-shell
- **Frontend**: Lit (mini-lit), Tailwind CSS v4, Vite
- **Backend**: Node.js, WebSocket (ws)
- **패키지 의존성**: @mariozechner/pi-ai, @mariozechner/pi-web-ui, @hancom/hwp-cli

## 개발

```bash
# UI + Bridge 서버 동시 실행
npm run dev

# Tauri 앱 전체 실행 (Rust 포함)
npm run tauri:dev

# 프로덕션 빌드
npm run tauri:build
```

## 환경변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `RPC_PROVIDER` | LLM 프로바이더 | `openai` |
| `RPC_MODEL` | 모델 ID | `gpt-5.4` |
| `RPC_THINKING_LEVEL` | Thinking 수준 (off/low/medium/high) | `medium` |
| `WS_PORT` | WebSocket 서버 포트 | `3001` |

## 디렉토리 구조

```
packages/desktop/
├── src-tauri/           # Rust 백엔드
│   ├── src/lib.rs       # BridgeProcess, Tauri Commands, 앱 셋업
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── capabilities/    # 권한 설정
├── server/              # Node.js Bridge
│   ├── start.ts         # 진입점
│   └── bridge.ts        # WebSocket + RPC 오케스트레이션
├── src/                 # TypeScript 프론트엔드
│   ├── main.ts          # 앱 초기화, 세션 관리, UI 렌더링
│   ├── rpc-adapter.ts   # WebSocket 기반 Agent 어댑터
│   ├── tauri-bridge.ts  # Tauri 파일 시스템 통합
│   └── custom-messages.ts
└── package.json
```

## MCP 통합

- **Atlassian (Jira/Confluence)**: OAuth 기반 인증, Settings > MCP 탭에서 연결
- **HWP Cowriter**: stdio 기반, 토큰 불필요
