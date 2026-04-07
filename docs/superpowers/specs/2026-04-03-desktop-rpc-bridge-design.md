# Desktop RPC Bridge Server Design

## 개요

기존 desktop 앱의 아키텍처를 변경한다. Web UI가 `pi-ai`로 직접 LLM을 호출하는 대신, `pi-coding-agent --mode rpc`를 백엔드로 사용하여 `.pi` 확장/도구/스킬을 모두 활용할 수 있게 한다.

### 목표

- Web UI에서 `han_jira`, `bash`, `read`, `edit` 등 모든 coding-agent 도구 사용 가능
- `.pi/extensions`, `.pi/skills`, `.pi/agents` 설정이 자동 로드됨
- 브라우저에서 바로 개발/테스트 가능 (Tauri 불필요)

### 비목표 (향후)

- Tauri IPC 통합 (B 방식)
- 파일 업로드/첨부
- 멀티 세션 관리

## 아키텍처

```
Browser (http://localhost:1420)          Node.js Server
┌──────────────────────┐    WebSocket    ┌──────────────────────┐
│  Web UI (pi-web-ui)  │◄──────────────►│  Bridge Server       │
│  ├── ChatPanel       │    JSON msgs    │  ├── WebSocket 수신  │
│  ├── RpcAgent adapter│                 │  ├── RPC 프로세스    │
│  └── AgentInterface  │                 │  │   stdin/stdout     │
└──────────────────────┘                 │  └── 이벤트 전달     │
                                         └──────────┬───────────┘
                                                    │ spawn
                                         ┌──────────▼───────────┐
                                         │ pi-coding-agent       │
                                         │ --mode rpc            │
                                         │ ├── .pi/extensions    │
                                         │ ├── .pi/skills        │
                                         │ ├── han_jira 도구     │
                                         │ ├── bash, read, edit  │
                                         │ └── LLM 호출          │
                                         └──────────────────────┘
```

## 컴포넌트

### 1. Bridge Server (`server/bridge.ts`)

Node.js WebSocket 서버. 두 가지 역할:
- WebSocket으로 Web UI와 JSON 메시지 교환
- `pi-coding-agent --mode rpc`를 child process로 spawn하고 stdin/stdout JSON lines로 통신

**spawn 명령:**
```bash
node packages/coding-agent/dist/cli.js --mode rpc --provider openai --model gpt-5-chat-latest
```

**메시지 변환:**
- Web UI → Server: WebSocket JSON → RPC stdin JSON line
- Server → Web UI: RPC stdout JSON line → WebSocket JSON

별도 변환 로직 없이 JSON을 그대로 전달한다 (pass-through). RPC 프로토콜이 이미 완전한 JSON 기반이므로.

### 2. Server 진입점 (`server/start.ts`)

- HTTP 서버 없음 (Vite가 프론트엔드 서빙 담당)
- WebSocket 서버만 별도 포트에서 실행 (예: 3001)
- 환경변수: `WS_PORT` (기본 3001)

### 3. RpcAgent 어댑터 (`src/rpc-adapter.ts`)

브라우저 측 어댑터. `Agent` (pi-agent-core)와 유사한 인터페이스를 제공하되, 실제 동작은 WebSocket을 통해 RPC에 위임한다.

Web UI의 `ChatPanel`이 기대하는 `Agent` 인터페이스:
- `state`: messages, model, isStreaming, thinkingLevel, tools
- `subscribe(callback)`: 이벤트 구독
- `steer(message)`: 메시지 전송
- `abort()`: 중단

RpcAgent는 이 인터페이스를 WebSocket 통신으로 구현한다:
- `steer(message)` → WebSocket `{ type: "prompt", message: "..." }` 전송
- RPC 이벤트 수신 → `state` 업데이트 → subscriber callback 호출
- `abort()` → WebSocket `{ type: "abort" }` 전송

### 4. main.ts 변경

기존:
```typescript
import { Agent } from "@mariozechner/pi-agent-core";
const agent = new Agent({ initialState: { ... } });
await chatPanel.setAgent(agent, { ... });
```

변경:
```typescript
import { RpcAgent } from "./rpc-adapter.js";
const agent = new RpcAgent("ws://localhost:3001");
await agent.connect();
await chatPanel.setAgent(agent, { ... });
```

## WebSocket 프로토콜

RPC 프로토콜(`rpc-types.ts`)을 그대로 사용한다. 추가 래핑 없음.

### Client → Server (Web UI → Bridge)

```json
{ "type": "prompt", "message": "ASSISTANT-5573 이슈 현황을 파악해 주세요" }
{ "type": "abort" }
{ "type": "set_model", "provider": "openai", "modelId": "gpt-5-chat-latest" }
{ "type": "get_state" }
{ "type": "get_messages" }
```

### Server → Client (Bridge → Web UI)

RPC stdout의 JSON line을 그대로 전달:
```json
{ "type": "response", "command": "prompt", "success": true }
{ "type": "agent_start", ... }
{ "type": "message_update", "message": { "role": "assistant", "content": [...] } }
{ "type": "agent_end", ... }
{ "type": "response", "command": "get_state", "data": { ... } }
```

## 파일 구조

```
packages/desktop/
├── server/
│   ├── bridge.ts            # WebSocket 서버 + RPC spawn
│   └── start.ts             # 서버 진입점 (node로 실행)
├── src/
│   ├── main.ts              # Web UI (RpcAgent 사용으로 변경)
│   ├── rpc-adapter.ts       # WebSocket 기반 Agent 어댑터
│   ├── custom-messages.ts   # 커스텀 메시지 렌더러 (유지)
│   └── app.css              # 스타일 (유지)
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.server.json     # 서버용 tsconfig (Node.js target)
└── package.json
```

## 실행 방법

```bash
# 터미널 1: Bridge 서버
npm run dev:server    # → node server/start.ts (WebSocket :3001 + RPC spawn)

# 터미널 2: Vite UI
npm run dev:ui        # → vite (http://localhost:1420)

# 또는 동시 실행
npm run dev           # → concurrently "dev:server" "dev:ui"
```

## package.json 스크립트

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:ui\"",
    "dev:ui": "vite",
    "dev:server": "tsx server/start.ts",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  }
}
```

## 의존성 추가

```json
{
  "dependencies": {
    "ws": "^8"
  },
  "devDependencies": {
    "@types/ws": "^8",
    "tsx": "^4",
    "concurrently": "^9"
  }
}
```

## MVP 기능 범위

| 기능 | 상태 |
|------|------|
| 메시지 전송/스트리밍 응답 | 포함 |
| .pi 확장/도구 (han_jira 등) | 포함 |
| .pi 스킬 | 포함 |
| 모델 선택 | 포함 |
| 세션 관리 | RPC에 위임 |
| 대화 중단 (abort) | 포함 |
| Tauri IPC 통합 | 제외 (향후) |
| 파일 업로드 | 제외 (향후) |
