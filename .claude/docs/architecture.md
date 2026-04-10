# pi-monorepo Architecture

## Package Dependency Graph

```
tui (no deps)    ai (no deps)
  ↓                ↓
  ↓             agent (← ai)
  ↓                ↓
  ├──→ coding-agent (← tui, ai, agent)
  ↓        ↓
  ↓     mom (← ai, agent, coding-agent)
  ↓
  └──→ web-ui (← ai, tui)
         ↓
       pods (← agent)
```

빌드 순서: `tui → ai → agent → coding-agent → mom → web-ui → pods`

## 패키지 상세

### packages/ai — LLM 프로바이더 추상화

- **핵심**: `api-registry.ts` — `Map<string, RegisteredApiProvider>` 기반 프로바이더 레지스트리
- **API**: `registerApiProvider()`, `getApiProvider()`, `streamSimple()`, `stream()`
- **지원 프로바이더**: anthropic, openai, google, mistral, amazon-bedrock, azure-openai, groq, xai 등 15+
- **주요 타입**: `Api`, `Provider`, `Model<Api>`, `ThinkingLevel`, `StreamOptions`
- **주의**: `models.generated.ts`는 자동 생성 — 직접 수정 금지

### packages/agent — 에이전트 코어

- **핵심**: `agent.ts` — Agent 클래스 (상태 관리, 이벤트 기반)
- **AgentState**: systemPrompt, model, thinkingLevel, tools, messages, isStreaming, pendingToolCalls
- **API**: `prompt()`, `continue()`, `subscribe()`, `steer()`, `followUp()`, `abort()`, `waitForIdle()`
- **이벤트**: message_start → message_update → message_end → tool_execution → turn_end → agent_end
- **도구 실행**: "sequential" 또는 "parallel" 모드
- **큐**: steeringQueue (우선), followUpQueue — 각각 "all" | "one-at-a-time"

### packages/coding-agent — CLI 코딩 에이전트 (pi)

- **진입점**: `cli.ts` → `main.ts`
- **모드**: Interactive (TUI), RPC (headless JSONL stdin/stdout), Print
- **핵심 도구**: bash, read, write, edit, grep, find, ls
- **확장 시스템**: `.pi/extensions/`에서 `.ts` 파일 로드, ExtensionAPI로 도구/훅/커맨드 등록
- **RPC 프로토콜** (`rpc-types.ts`):
	- 명령: prompt, steer, abort, set_api_key, set_model, set_thinking_level, get_state
	- MCP: mcp_connect, mcp_status (bridge에서 인터셉트)
	- 응답: `{type: "response", id, success, data/error}`
	- 이벤트: JSONL 스트리밍 (agent_start, message_update, message_end, agent_end)

### packages/desktop — Tauri 데스크톱 앱

```
packages/desktop/
├── src/                        # 프론트엔드 (Lit + Vite + Tailwind)
│   ├── main.ts                 # 앱 엔트리, 세션 관리, MCP 설정 UI
│   ├── rpc-adapter.ts          # WebSocket RPC 어댑터 (RpcAgent 클래스)
│   ├── mcp-settings-tab.ts     # MCP 설정 탭 컴포넌트
│   ├── tauri-bridge.ts         # Tauri 네이티브 통합
│   └── custom-messages.ts      # 커스텀 메시지 렌더러
├── server/                     # Node.js bridge 서버
│   ├── start.ts                # 서버 엔트리
│   └── bridge.ts               # WebSocket ↔ RPC 릴레이 + MCP 상태
└── src-tauri/                  # Rust 백엔드
    ├── tauri.conf.json         # 앱 설정 (devUrl: localhost:1420)
    ├── Cargo.toml              # tauri 2, dialog/fs/shell 플러그인
    └── src/lib.rs              # 커맨드, 플러그인 등록
```

**실행**: `npx tauri dev` (packages/desktop에서)

**프론트엔드 저장소** (main.ts):
- `SettingsStore`, `ProviderKeysStore`, `SessionsStore`, `CustomProvidersStore`
- IndexedDB 백엔드 (`han-ai-desktop`)

**RpcAgent** (rpc-adapter.ts):
- WebSocket(`ws://localhost:3001`) → bridge → coding-agent RPC 프로세스
- `connect()`: 재시도 20회, get_state 폴링으로 상태 동기화
- `prompt()`: 로컬 메시지 추가 (즉시 UI) → RPC 전송
- 이벤트 처리: agent_start, message_update, message_end, agent_end

**Bridge 서버** (bridge.ts):
- coding-agent를 `--mode rpc`로 spawn (환경변수: RPC_PROVIDER, RPC_MODEL)
- WebSocket 서버(포트 3001) — 프론트엔드 ↔ RPC 프로세스 릴레이
- MCP 명령(mcp_status, mcp_connect) 인터셉트 처리
- 토큰 파일: `~/.config/han/mcp-tokens.json`

### packages/mom — Slack 봇 오케스트레이터

- Slack Socket Mode로 메시지 수신 → pi coding-agent에 위임
- 샌드박스 실행: host 또는 Docker
- 의존: `@slack/socket-mode`, `@slack/web-api`, coding-agent

### packages/tui — TUI 컴포넌트

- 차등 렌더링 기반 터미널 UI
- 컴포넌트: Button, Input, SelectList, Container, Text
- ANSI 컬러, East Asian 문자폭 계산

### packages/web-ui — 공유 웹 컴포넌트

- ChatPanel, ModelSelector, SessionListDialog, SettingsDialog
- Lit + Tailwind CSS, mini-lit 컴포넌트
- 문서 지원: pdfjs, docx-preview, xlsx

### packages/pods — vLLM 배포 관리

- GPU 파드에 vLLM 배포 관리 CLI (`pi-pods`)

## MCP 서버 구성

MCP 서버 추가/수정 시 **3곳 모두** 반영 필수:

| 파일 | 역할 | 변경 내용 |
|------|------|-----------|
| `.pi/extensions/mcp-bridge/index.ts` | 코딩 에이전트용 MCP 연결 | `MCP_SERVERS` 배열에 서버 추가 |
| `packages/desktop/server/bridge.ts` | 데스크톱 bridge 서버 | `stdioServers` Set + `servers` 배열에 추가 |
| `packages/desktop/src/main.ts` | 데스크톱 프론트엔드 UI | `servers` 배열에 추가 (하드코딩) |

**현재 MCP 서버**:
- `atlassian` — HTTP, OAuth 필요
- `hwp-cowriter-file` — stdio, `--service cowriter:file` (파일 기반, 한글 미설치 OK)
- `hwp-cowriter-auto` — stdio, `--service cowriter:auto` (한글 COM 자동화)

MCP 서버 바이너리: `@hancom/hwp-cli/dist/mcp-stdio-server.mjs`

## 데이터 흐름: 사용자 메시지 → 응답

```
사용자 입력 (ChatPanel)
  ↓
RpcAgent.prompt(text)  — 로컬 messages에 즉시 추가 (UI 반영)
  ↓
WebSocket → ws://localhost:3001
  ↓
bridge.ts — MCP 명령이면 인터셉트, 아니면 RPC stdin에 JSONL 전달
  ↓
coding-agent (--mode rpc) — AgentSession.prompt() → AgentLoop
  ↓
pi-ai — getApiProvider() → LLM 스트리밍 호출
  ↓
이벤트 스트리밍 (agent_start → message_update* → message_end → agent_end)
  ↓
RPC stdout (JSONL) → bridge → WebSocket → RpcAdapter
  ↓
handleAgentEvent() — 상태 업데이트, 리스너 알림
  ↓
ChatPanel 리렌더링 → IndexedDB 세션 자동 저장
```

## .pi/ 디렉토리

### 확장 (.pi/extensions/)

- `mcp-bridge/` — MCP 서버 브릿지 (Atlassian OAuth + HWP stdio)
- `han-ax/` — 한컴 개발 하네스 (Jira, GitLab, Atlassian 연동)
- `subagent/` — 서브에이전트 관리
- `files.ts`, `diff.ts`, `tps.ts` — 유틸리티 확장

### 스킬 (.pi/skills/)

- **개발**: han-dev, han-start, han-code, han-close, han-branch, han-analyze, han-code-review, han-security, han-tdd, han-mr
- **이슈**: han-issue-check, han-issue-create, han-issue-list, han-comment
- **문서**: han-doc-plan, han-doc-memo, han-doc-draft, han-doc-report, han-doc-report-gen, han-doc-greeting, han-doc-solution, han-doc-reflection
- **기타**: han-atlassian

### 에이전트 (.pi/agents/)

- code-agent, start-agent, close-agent, han-reviewer, hwp-expert, cpp-expert

## 환경변수

| 변수 | 기본값 | 용도 |
|------|--------|------|
| `WS_PORT` | 3001 | Bridge WebSocket 포트 |
| `RPC_PROVIDER` | openai | LLM 프로바이더 |
| `RPC_MODEL` | gpt-5.4 | LLM 모델 |
| `RPC_THINKING_LEVEL` | medium | Extended thinking 레벨 |
| `GITLAB_NPM_TOKEN` | — | @hancom 패키지 설치 |
| `MOM_SLACK_APP_TOKEN` | — | Slack 앱 토큰 |
| `MOM_SLACK_BOT_TOKEN` | — | Slack 봇 토큰 |
