# RPC Protocol Reference

## 개요

JSONL(JSON Lines) 기반 RPC 프로토콜. coding-agent를 headless로 구동하여 외부 앱에서 제어.

- **프레이밍**: LF(`\n`)만 사용 (Unicode 구분자 U+2028/U+2029 사용 금지)
- **전송**: stdin/stdout (프로세스 간), WebSocket (네트워크)
- **상관**: 선택적 `id` 필드로 요청-응답 매칭
- **이벤트**: 비동기 스트리밍 (요청과 독립)

## 아키텍처

```
클라이언트 (Frontend/Bridge)
  │
  ├── 요청 → stdin (JSONL)
  │
  └── 응답/이벤트 ← stdout (JSONL)
        ├── {type: "response", id, success, ...}  — 요청 응답
        ├── {type: "agent_start"}                  — 이벤트 스트림
        ├── {type: "message_update", ...}
        └── {type: "extension_ui_request", ...}    — UI 요청
```

## 명령 (stdin → RPC)

### 프롬프팅

```typescript
{ id?, type: "prompt", message: string, images?: ImageContent[], streamingBehavior?: "steer"|"followUp" }
{ id?, type: "steer", message: string, images?: ImageContent[] }
{ id?, type: "follow_up", message: string, images?: ImageContent[] }
{ id?, type: "abort" }
{ id?, type: "new_session", parentSession?: string }
```

- `prompt`은 fire-and-forget (즉시 응답 후 이벤트 스트리밍)
- `steer`/`follow_up`은 큐에 추가 후 응답
- `streamingBehavior: "steer"` — 현재 실행 중단, "followUp" — 실행 후 대기

### 상태 조회

```typescript
{ id?, type: "get_state" }
{ id?, type: "get_messages" }
{ id?, type: "get_commands" }
{ id?, type: "get_session_stats" }
{ id?, type: "get_available_models" }
{ id?, type: "get_last_assistant_text" }
{ id?, type: "get_fork_messages" }
```

### 설정 변경

```typescript
{ id?, type: "set_api_key", provider: string, apiKey: string }
{ id?, type: "set_model", provider: string, modelId: string }
{ id?, type: "cycle_model" }
{ id?, type: "set_thinking_level", level: ThinkingLevel }
{ id?, type: "cycle_thinking_level" }
{ id?, type: "set_steering_mode", mode: "all"|"one-at-a-time" }
{ id?, type: "set_follow_up_mode", mode: "all"|"one-at-a-time" }
{ id?, type: "set_auto_compaction", enabled: boolean }
{ id?, type: "set_auto_retry", enabled: boolean }
{ id?, type: "set_session_name", name: string }
```

**ThinkingLevel**: `"off"` | `"minimal"` | `"low"` | `"medium"` | `"high"` | `"xhigh"`

### 실행

```typescript
{ id?, type: "bash", command: string }
{ id?, type: "abort_bash" }
{ id?, type: "compact", customInstructions?: string }
{ id?, type: "abort_retry" }
```

### 세션 관리

```typescript
{ id?, type: "switch_session", sessionPath: string }
{ id?, type: "fork", entryId: string }
{ id?, type: "export_html", outputPath?: string }
```

## 응답 (stdout ← RPC)

### 성공

```json
{ "id": "req_1", "type": "response", "command": "prompt", "success": true }
{ "id": "req_2", "type": "response", "command": "get_state", "success": true, "data": { ... } }
```

### 실패

```json
{ "id": "req_3", "type": "response", "command": "set_model", "success": false, "error": "Unknown model" }
```

### RpcSessionState (get_state 응답)

```typescript
{
  model?: Model<any>;
  thinkingLevel: ThinkingLevel;
  isStreaming: boolean;
  isCompacting: boolean;
  steeringMode: "all" | "one-at-a-time";
  followUpMode: "all" | "one-at-a-time";
  sessionFile?: string;
  sessionId: string;
  sessionName?: string;
  autoCompactionEnabled: boolean;
  messageCount: number;
  pendingMessageCount: number;
}
```

## 에이전트 이벤트 (stdout ← RPC, 비동기)

```typescript
{ type: "agent_start" }
{ type: "agent_end", messages: AgentMessage[] }
{ type: "turn_start" }
{ type: "turn_end", message: AgentMessage, toolResults: ToolResultMessage[] }
{ type: "message_start", message: AgentMessage }
{ type: "message_update", message: AgentMessage, assistantMessageEvent: AssistantMessageEvent }
{ type: "message_end", message: AgentMessage }
{ type: "tool_execution_start", toolCallId: string, toolName: string, args: any }
{ type: "tool_execution_update", toolCallId: string, toolName: string, args: any, partialResult: any }
{ type: "tool_execution_end", toolCallId: string, toolName: string, result: any, isError: boolean }
```

**이벤트 순서**:
```
agent_start
  → message_start (user)
  → message_end (user)
  → turn_start
    → message_start (assistant)
    → message_update* (토큰 스트리밍)
    → message_end (assistant)
    → [tool_execution_start → tool_execution_update* → tool_execution_end]*
  → turn_end
  → [추가 turn]*
→ agent_end
```

## Extension UI 프로토콜

### UI 요청 (stdout ← RPC)

```typescript
{ type: "extension_ui_request", id: string, method: "select", title, options: string[], timeout? }
{ type: "extension_ui_request", id: string, method: "confirm", title, message, timeout? }
{ type: "extension_ui_request", id: string, method: "input", title, placeholder?, timeout? }
{ type: "extension_ui_request", id: string, method: "editor", title, prefill? }
{ type: "extension_ui_request", id: string, method: "notify", message, notifyType? }
{ type: "extension_ui_request", id: string, method: "setStatus", statusKey, statusText }
{ type: "extension_ui_request", id: string, method: "setWidget", widgetKey, widgetLines, widgetPlacement? }
{ type: "extension_ui_request", id: string, method: "setTitle", title }
{ type: "extension_ui_request", id: string, method: "set_editor_text", text }
```

### UI 응답 (stdin → RPC)

```typescript
{ type: "extension_ui_response", id: string, value: string }       // select, input, editor
{ type: "extension_ui_response", id: string, confirmed: boolean }  // confirm
{ type: "extension_ui_response", id: string, cancelled: true }     // 취소
```

`id` 필드로 요청-응답 매칭.

## Bridge 릴레이

bridge.ts가 WebSocket ↔ stdin/stdout 사이를 릴레이:

```
프론트엔드 → WebSocket → bridge.ts → RPC stdin
                                          ↓
프론트엔드 ← WebSocket ← bridge.ts ← RPC stdout
```

**MCP 명령 인터셉트**: `mcp_status`, `mcp_connect`는 bridge가 직접 처리 (RPC에 전달 안 함)

**JSONL 버퍼링**: stdout 청크를 버퍼에 누적, `\n` 기준 분리 후 WebSocket 전송

## JSONL 직렬화

```typescript
// 직렬화
function serializeJsonLine(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

// 역직렬화 (attachJsonlLineReader)
// UTF-8 디코더로 바이트 스트림 처리
// \n 기준 분리 (readline 사용 금지 — U+2028/U+2029 문제)
// CRLF 처리: \r 자동 제거
```

## 요청-응답 상관

**요청 ID 형식**: `req_${autoIncrement}`

```typescript
// 요청 전송
const id = `req_${++this.requestId}`;
this.pendingRequests.set(id, { resolve, reject });
this.send({ ...command, id });

// 응답 매칭
if (data.id && this.pendingRequests.has(data.id)) {
  const pending = this.pendingRequests.get(data.id)!;
  this.pendingRequests.delete(data.id);
  pending.resolve(data);
}
```

**타임아웃**: 30초 (RPC 클라이언트, 프론트엔드 어댑터 모두)

## 프로토콜 예제

### 프롬프트 전송

```json
→ {"id":"req_1","type":"prompt","message":"파일 분석해줘"}
← {"id":"req_1","type":"response","command":"prompt","success":true}
← {"type":"agent_start"}
← {"type":"message_start","message":{"role":"user","content":"파일 분석해줘"}}
← {"type":"message_end","message":{"role":"user","content":"파일 분석해줘"}}
← {"type":"turn_start"}
← {"type":"message_start","message":{"role":"assistant","content":[]}}
← {"type":"message_update","message":{"role":"assistant","content":[{"type":"text","text":"분석"}]}}
← {"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"분석하겠습니다."}]}}
← {"type":"turn_end","message":{...},"toolResults":[]}
← {"type":"agent_end","messages":[...]}
```

### Extension UI 대화

```json
← {"type":"extension_ui_request","id":"dlg_1","method":"confirm","title":"변경 저장?","message":"저장하시겠습니까?"}
→ {"type":"extension_ui_response","id":"dlg_1","confirmed":true}
```

## 파일 위치

| 컴포넌트 | 경로 |
|---------|------|
| RPC 타입 정의 | `packages/coding-agent/src/modes/rpc/rpc-types.ts` |
| RPC 모드 핸들러 | `packages/coding-agent/src/modes/rpc/rpc-mode.ts` |
| JSONL 전송 | `packages/coding-agent/src/modes/rpc/jsonl.ts` |
| RPC 클라이언트 | `packages/coding-agent/src/modes/rpc/rpc-client.ts` |
| Bridge 릴레이 | `packages/desktop/server/bridge.ts` |
| 프론트엔드 어댑터 | `packages/desktop/src/rpc-adapter.ts` |
| 에이전트 이벤트 타입 | `packages/agent/src/types.ts` |
