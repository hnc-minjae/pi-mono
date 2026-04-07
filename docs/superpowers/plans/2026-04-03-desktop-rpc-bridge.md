# Desktop RPC Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web UI가 pi-coding-agent RPC 모드를 백엔드로 사용하여 .pi 확장/도구/스킬을 모두 활용할 수 있게 한다.

**Architecture:** Node.js WebSocket 서버가 pi-coding-agent를 RPC 모드로 spawn하고, 브라우저 Web UI와 WebSocket JSON 메시지를 교환한다. RPC 프로토콜 메시지를 양방향으로 pass-through한다.

**Tech Stack:** Node.js, WebSocket (ws), pi-coding-agent RPC mode, pi-web-ui (Lit), Vite

**Spec:** `docs/superpowers/specs/2026-04-03-desktop-rpc-bridge-design.md`

---

## File Structure

```
packages/desktop/
├── server/
│   ├── bridge.ts            # WebSocket 서버 + RPC child process 관리
│   └── start.ts             # 서버 진입점
├── src/
│   ├── rpc-adapter.ts       # 브라우저 측 WebSocket Agent 어댑터
│   └── main.ts              # 변경: Agent → RpcAgent
├── tsconfig.server.json     # 서버용 tsconfig
└── package.json             # 스크립트/의존성 추가
```

---

### Task 1: 의존성 추가 및 서버 tsconfig

**Files:**
- Modify: `packages/desktop/package.json`
- Create: `packages/desktop/tsconfig.server.json`

- [ ] **Step 1: package.json에 의존성 및 스크립트 추가**

`packages/desktop/package.json`에 다음을 추가:

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:ui\"",
    "dev:ui": "vite",
    "dev:server": "tsx --watch server/start.ts",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  },
  "dependencies": {
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/ws": "^8.18.0",
    "tsx": "^4.19.0",
    "concurrently": "^9.1.0"
  }
}
```

기존 dependencies/devDependencies에 merge한다. 기존 `"dev": "vite"`는 `"dev:ui": "vite"`로 변경하고, `"dev"`는 concurrently로 변경.

- [ ] **Step 2: tsconfig.server.json 생성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "lib": ["ES2022"]
  },
  "include": ["server"]
}
```

- [ ] **Step 3: npm install**

```bash
cd packages/desktop && npm install
```

- [ ] **Step 4: 커밋**

```bash
git add packages/desktop/package.json packages/desktop/tsconfig.server.json
git commit -m "feat(desktop): add ws, tsx, concurrently deps and server tsconfig"
```

---

### Task 2: Bridge Server — WebSocket ↔ RPC 프로세스

**Files:**
- Create: `packages/desktop/server/bridge.ts`

- [ ] **Step 1: bridge.ts 생성**

```typescript
import { type ChildProcess, spawn } from "node:child_process";
import { resolve } from "node:path";
import { WebSocketServer, WebSocket } from "ws";

const WS_PORT = parseInt(process.env.WS_PORT || "3001", 10);

// Path to the coding-agent CLI
const CLI_PATH = resolve(import.meta.dirname, "../../../coding-agent/dist/cli.js");

// Working directory for the agent (project root)
const AGENT_CWD = resolve(import.meta.dirname, "../../..");

interface BridgeState {
	rpcProcess: ChildProcess | null;
	wsClient: WebSocket | null;
	buffer: string;
}

const state: BridgeState = {
	rpcProcess: null,
	wsClient: null,
	buffer: "",
};

function spawnRpcAgent(): ChildProcess {
	const args = ["--mode", "rpc"];

	// Pass provider/model from env if set
	if (process.env.RPC_PROVIDER) {
		args.push("--provider", process.env.RPC_PROVIDER);
	}
	if (process.env.RPC_MODEL) {
		args.push("--model", process.env.RPC_MODEL);
	}

	const child = spawn("node", [CLI_PATH, ...args], {
		cwd: AGENT_CWD,
		env: process.env,
		stdio: ["pipe", "pipe", "pipe"],
	});

	console.log(`[bridge] RPC agent spawned (pid: ${child.pid})`);

	child.stderr?.on("data", (data: Buffer) => {
		process.stderr.write(`[rpc stderr] ${data.toString()}`);
	});

	child.on("exit", (code) => {
		console.log(`[bridge] RPC agent exited (code: ${code})`);
		state.rpcProcess = null;
	});

	return child;
}

function setupRpcStdoutReader(child: ChildProcess) {
	child.stdout?.on("data", (chunk: Buffer) => {
		state.buffer += chunk.toString("utf-8");

		while (true) {
			const newlineIndex = state.buffer.indexOf("\n");
			if (newlineIndex === -1) break;

			const line = state.buffer.slice(0, newlineIndex);
			state.buffer = state.buffer.slice(newlineIndex + 1);

			if (line.trim() && state.wsClient?.readyState === WebSocket.OPEN) {
				state.wsClient.send(line);
			}
		}
	});
}

function sendToRpc(json: string) {
	if (state.rpcProcess?.stdin?.writable) {
		state.rpcProcess.stdin.write(json + "\n");
	}
}

export function startBridge() {
	// Spawn RPC agent
	state.rpcProcess = spawnRpcAgent();
	setupRpcStdoutReader(state.rpcProcess);

	// Start WebSocket server
	const wss = new WebSocketServer({ port: WS_PORT });
	console.log(`[bridge] WebSocket server listening on ws://localhost:${WS_PORT}`);

	wss.on("connection", (ws) => {
		console.log("[bridge] Client connected");

		// Only one client at a time
		if (state.wsClient) {
			state.wsClient.close();
		}
		state.wsClient = ws;

		ws.on("message", (data) => {
			const message = data.toString();
			sendToRpc(message);
		});

		ws.on("close", () => {
			console.log("[bridge] Client disconnected");
			if (state.wsClient === ws) {
				state.wsClient = null;
			}
		});

		ws.on("error", (err) => {
			console.error("[bridge] WebSocket error:", err.message);
		});
	});

	// Graceful shutdown
	const shutdown = () => {
		console.log("[bridge] Shutting down...");
		if (state.rpcProcess) {
			state.rpcProcess.kill("SIGTERM");
		}
		wss.close();
		process.exit(0);
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
}
```

- [ ] **Step 2: 커밋**

```bash
git add packages/desktop/server/bridge.ts
git commit -m "feat(desktop): add WebSocket bridge server for RPC agent"
```

---

### Task 3: Server 진입점

**Files:**
- Create: `packages/desktop/server/start.ts`

- [ ] **Step 1: start.ts 생성**

```typescript
import { startBridge } from "./bridge.js";

console.log("[server] Starting RPC bridge server...");
startBridge();
```

- [ ] **Step 2: 서버 실행 확인**

```bash
cd packages/desktop && npx tsx server/start.ts
```

Expected: `[bridge] RPC agent spawned` + `[bridge] WebSocket server listening on ws://localhost:3001` 출력

- [ ] **Step 3: 커밋**

```bash
git add packages/desktop/server/start.ts
git commit -m "feat(desktop): add bridge server entry point"
```

---

### Task 4: RpcAgent 어댑터 — 브라우저 측 WebSocket Agent

**Files:**
- Create: `packages/desktop/src/rpc-adapter.ts`

- [ ] **Step 1: rpc-adapter.ts 생성**

ChatPanel이 기대하는 Agent 인터페이스를 WebSocket 통신으로 구현한다.

```typescript
import type { AgentMessage, AgentState, AgentTool, ThinkingLevel } from "@mariozechner/pi-agent-core";

type AgentEvent = {
	type: string;
	[key: string]: any;
};

type EventListener = (event: AgentEvent) => void;

/**
 * WebSocket 기반 Agent 어댑터.
 * pi-coding-agent RPC 모드와 통신하여 ChatPanel에 Agent 인터페이스를 제공한다.
 */
export class RpcAgent {
	private ws: WebSocket | null = null;
	private listeners: EventListener[] = [];
	private requestId = 0;
	private pendingRequests = new Map<string, {
		resolve: (data: any) => void;
		reject: (error: Error) => void;
	}>();

	private _state: AgentState = {
		systemPrompt: "",
		model: null as any,
		thinkingLevel: "off" as ThinkingLevel,
		messages: [],
		tools: [],
		isStreaming: false,
		pendingToolCalls: new Set<string>(),
	};

	constructor(private wsUrl: string) {}

	/** Agent state (read by ChatPanel/AgentInterface) */
	get state(): AgentState {
		return this._state;
	}

	/** Whether the agent is currently running */
	get isRunning(): boolean {
		return this._state.isStreaming;
	}

	/** Connect to the bridge WebSocket server */
	async connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.ws = new WebSocket(this.wsUrl);

			this.ws.onopen = () => {
				console.log("[rpc-adapter] Connected to bridge server");
				// Fetch initial state
				this.sendCommand({ type: "get_state" }).then((response: any) => {
					if (response.success && response.data) {
						this.updateStateFromRpc(response.data);
					}
					resolve();
				}).catch(reject);
			};

			this.ws.onmessage = (event) => {
				this.handleMessage(event.data as string);
			};

			this.ws.onclose = () => {
				console.log("[rpc-adapter] Disconnected from bridge server");
			};

			this.ws.onerror = (err) => {
				console.error("[rpc-adapter] WebSocket error:", err);
				reject(err);
			};
		});
	}

	/** Disconnect */
	disconnect() {
		this.ws?.close();
		this.ws = null;
	}

	/** Subscribe to agent events (used by AgentInterface) */
	subscribe(listener: (event: any, signal: AbortSignal) => void | Promise<void>): () => void {
		const wrappedListener: EventListener = (event) => {
			listener(event, new AbortController().signal);
		};
		this.listeners.push(wrappedListener);
		return () => {
			const index = this.listeners.indexOf(wrappedListener);
			if (index !== -1) this.listeners.splice(index, 1);
		};
	}

	/** Send a user message (prompt) */
	steer(message: AgentMessage | string) {
		const text = typeof message === "string"
			? message
			: typeof message.content === "string"
				? message.content
				: (message.content as any[])
					?.filter((c: any) => c.type === "text")
					.map((c: any) => c.text)
					.join("") || "";

		if (!text) return;

		this._state.isStreaming = true;
		this.emitEvent({ type: "agent_start" });
		this.send({ type: "prompt", message: text });
	}

	/** Abort current operation */
	abort() {
		this.send({ type: "abort" });
	}

	/** Set model */
	async setModel(provider: string, modelId: string) {
		const response = await this.sendCommand({ type: "set_model", provider, modelId });
		if (response.success && response.data) {
			this._state.model = response.data as any;
			this.emitEvent({ type: "state-update", state: this._state });
		}
	}

	/** Set thinking level */
	async setThinkingLevel(level: ThinkingLevel) {
		await this.sendCommand({ type: "set_thinking_level", level });
		this._state.thinkingLevel = level;
	}

	/** Get available models */
	async getAvailableModels() {
		const response = await this.sendCommand({ type: "get_available_models" });
		return response.success ? (response.data as any).models : [];
	}

	// --- Internal ---

	private send(command: any) {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(command));
		}
	}

	private sendCommand(command: any): Promise<any> {
		return new Promise((resolve, reject) => {
			const id = `req_${++this.requestId}`;
			this.pendingRequests.set(id, { resolve, reject });

			const timeout = setTimeout(() => {
				this.pendingRequests.delete(id);
				reject(new Error(`Timeout waiting for ${command.type}`));
			}, 30000);

			this.pendingRequests.set(id, {
				resolve: (data) => { clearTimeout(timeout); resolve(data); },
				reject: (err) => { clearTimeout(timeout); reject(err); },
			});

			this.send({ ...command, id });
		});
	}

	private handleMessage(raw: string) {
		let data: any;
		try {
			data = JSON.parse(raw);
		} catch {
			return;
		}

		// Response to a pending command
		if (data.type === "response" && data.id && this.pendingRequests.has(data.id)) {
			const pending = this.pendingRequests.get(data.id)!;
			this.pendingRequests.delete(data.id);
			pending.resolve(data);
			return;
		}

		// Agent events — update state and notify listeners
		this.handleAgentEvent(data);
	}

	private handleAgentEvent(event: any) {
		switch (event.type) {
			case "agent_start":
				this._state.isStreaming = true;
				break;

			case "message_start":
			case "turn_start":
				break;

			case "message_update": {
				// Update or add the message in state
				const msg = event.message;
				if (msg) {
					const existingIndex = this._state.messages.findIndex(
						(m: any) => m.role === "assistant" && m === this._state.messages[this._state.messages.length - 1]
					);
					if (msg.role === "assistant") {
						// Replace last assistant message or add new
						const lastMsg = this._state.messages[this._state.messages.length - 1];
						if (lastMsg?.role === "assistant") {
							this._state.messages[this._state.messages.length - 1] = msg;
						} else {
							this._state.messages.push(msg);
						}
					}
				}
				break;
			}

			case "message_end": {
				const msg = event.message;
				if (msg) {
					const lastMsg = this._state.messages[this._state.messages.length - 1];
					if (lastMsg?.role === msg.role) {
						this._state.messages[this._state.messages.length - 1] = msg;
					} else {
						this._state.messages.push(msg);
					}
				}
				break;
			}

			case "turn_end":
				break;

			case "agent_end":
				this._state.isStreaming = false;
				break;
		}

		// Notify all listeners
		this.emitEvent(event);
	}

	private updateStateFromRpc(rpcState: any) {
		if (rpcState.model) this._state.model = rpcState.model;
		if (rpcState.thinkingLevel) this._state.thinkingLevel = rpcState.thinkingLevel;
		if (rpcState.isStreaming !== undefined) this._state.isStreaming = rpcState.isStreaming;
	}

	private emitEvent(event: any) {
		for (const listener of this.listeners) {
			listener(event);
		}
	}
}
```

- [ ] **Step 2: 커밋**

```bash
git add packages/desktop/src/rpc-adapter.ts
git commit -m "feat(desktop): add RpcAgent WebSocket adapter for browser"
```

---

### Task 5: main.ts 변경 — Agent → RpcAgent

**Files:**
- Modify: `packages/desktop/src/main.ts`

- [ ] **Step 1: main.ts에서 Agent 직접 생성을 RpcAgent로 교체**

주요 변경:
1. `Agent`, `getModel` import 제거
2. `RpcAgent` import 추가
3. `createAgent()` 함수를 RpcAgent 기반으로 변경
4. `toolsFactory` 제거 (도구는 RPC 에이전트가 관리)
5. `onApiKeyRequired` 제거 (API 키는 서버 측 환경변수)

변경되는 import:
```typescript
// 제거:
// import { Agent, type AgentMessage } from "@mariozechner/pi-agent-core";
// import { getModel } from "@mariozechner/pi-ai";

// 추가:
import { RpcAgent } from "./rpc-adapter.js";
```

변경되는 `createAgent`:
```typescript
const WS_URL = "ws://localhost:3001";

const createAgent = async (initialState?: any) => {
  if (agentUnsubscribe) {
    agentUnsubscribe();
  }

  agent = new RpcAgent(WS_URL);
  await agent.connect();

  agentUnsubscribe = agent.subscribe((event: any) => {
    if (event.type === "state-update" || event.type === "agent_end" || event.type === "message_end") {
      const messages = agent.state.messages;
      if (!currentTitle && shouldSaveSession(messages)) {
        currentTitle = generateTitle(messages);
      }
      if (currentSessionId) {
        saveSession();
      }
      if (currentTitle !== prevTitle) {
        prevTitle = currentTitle;
        renderApp();
      }
    }
  });

  await chatPanel.setAgent(agent as any, {
    toolsFactory: () => [],  // Tools managed by RPC agent
  });
};
```

변경되는 `loadSession`:
```typescript
const loadSession = async (sessionId: string): Promise<boolean> => {
  // RPC 모드에서는 세션 로드를 서버에 위임
  // MVP에서는 새 세션만 지원
  return false;
};
```

`renderApp`에서 모델 표시:
- RPC 에이전트의 `state.model`이 설정되므로 모델 선택 UI는 유지

- [ ] **Step 2: main.ts 전체 교체**

기존 main.ts를 읽고, Agent 직접 호출 부분을 RpcAgent로 교체한다.

핵심 변경 목록:
- line 2: `Agent` import → 삭제
- line 3: `getModel` import → 삭제
- line 5-10: web-ui imports에서 `ApiKeyPromptDialog`, `createJavaScriptReplTool` 제거
- line 29: `import { RpcAgent } from "./rpc-adapter.js";` 추가
- `createAgent` 함수 전체 교체 (위 코드)
- `initApp`에서 `await createAgent()` 유지

- [ ] **Step 3: 커밋**

```bash
git add packages/desktop/src/main.ts
git commit -m "feat(desktop): switch main.ts from direct Agent to RpcAgent"
```

---

### Task 6: 통합 테스트 — 서버 + UI 동시 실행

- [ ] **Step 1: coding-agent 빌드 확인**

```bash
ls packages/coding-agent/dist/cli.js
```

없으면:
```bash
cd packages/coding-agent && npm run build
```

- [ ] **Step 2: 서버 단독 실행 테스트**

```bash
cd packages/desktop && npx tsx server/start.ts
```

Expected:
```
[server] Starting RPC bridge server...
[bridge] RPC agent spawned (pid: XXXXX)
[bridge] WebSocket server listening on ws://localhost:3001
```

Ctrl+C로 종료.

- [ ] **Step 3: 동시 실행 테스트**

```bash
cd packages/desktop && npm run dev
```

Expected: Vite + Bridge 서버가 동시에 시작.

- [ ] **Step 4: 브라우저에서 http://localhost:1420 접속**

1. 메시지 입력 및 전송
2. 스트리밍 응답 표시 확인
3. `han_jira` 등 도구 사용 확인 (예: "ASSISTANT-5573 이슈 현황 파악해줘")

- [ ] **Step 5: 문제가 있으면 수정 후 커밋**

```bash
git add packages/desktop/
git commit -m "fix(desktop): integration fixes for RPC bridge"
```

---

## Summary

| Task | 내용 | 파일 |
|------|------|------|
| 1 | 의존성 + tsconfig | package.json, tsconfig.server.json |
| 2 | Bridge Server | server/bridge.ts |
| 3 | Server 진입점 | server/start.ts |
| 4 | RpcAgent 어댑터 | src/rpc-adapter.ts |
| 5 | main.ts 변경 | src/main.ts |
| 6 | 통합 테스트 | 전체 |
