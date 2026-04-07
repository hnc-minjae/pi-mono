/*
 * Copyright 2026 Hancom Inc. All rights reserved.
 *
 * https://www.hancom.com/
 */

import type { AgentMessage, AgentState, ThinkingLevel } from "@mariozechner/pi-agent-core";

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
	private pendingRequests = new Map<
		string,
		{
			resolve: (data: any) => void;
			reject: (error: Error) => void;
		}
	>();

	private _pendingUserMessages: any[] = [];

	private _state: AgentState = {
		systemPrompt: "",
		model: null as any,
		thinkingLevel: "off" as ThinkingLevel,
		messages: [],
		tools: [],
		isStreaming: false,
		pendingToolCalls: new Set<string>(),
	};

	/** API key provider — always returns dummy key since RPC agent manages keys server-side */
	getApiKey: ((provider: string) => Promise<string | undefined>) | null = async () => "rpc-managed";

	constructor(private wsUrl: string) {}

	get state(): AgentState {
		return this._state;
	}

	get isRunning(): boolean {
		return this._state.isStreaming;
	}

	/** Called by AgentInterface.sendMessage() to send a user message */
	async prompt(message: string | AgentMessage) {
		const text =
			typeof message === "string"
				? message
				: typeof message.content === "string"
					? message.content
					: (message.content as any[])
							?.filter((c: any) => c.type === "text")
							.map((c: any) => c.text)
							.join("") || "";

		if (!text) return;

		// Add user message immediately so it appears in chat before the RPC responds.
		// Track in _pendingUserMessages so agent_end can preserve original text
		// instead of the server-transformed version (e.g. skill block).
		const userMsg = { role: "user" as const, content: text, timestamp: Date.now() };
		this._state.messages.push(userMsg);
		this._pendingUserMessages.push(userMsg);
		this.emitEvent({ type: "message_end", message: userMsg });

		this.send({ type: "prompt", message: text });
	}

	async connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.ws = new WebSocket(this.wsUrl);

			this.ws.onopen = () => {
				console.log("[rpc-adapter] Connected to bridge server");
				this.sendCommand({ type: "get_state" })
					.then((response: any) => {
						if (response.success && response.data) {
							this.updateStateFromRpc(response.data);
						}
						resolve();
					})
					.catch((err) => {
						console.warn("[rpc-adapter] get_state failed, continuing anyway:", err?.message);
						resolve(); // 실패해도 앱은 로드
					});
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

	disconnect() {
		this.ws?.close();
		this.ws = null;
	}

	/** MCP 서버 상태 조회 (bridge 서버가 직접 처리) */
	async getMcpStatus(): Promise<any> {
		return this.sendCommand({ type: "mcp_status" });
	}

	/** MCP 서버 연결 시작 (OAuth 플로우 트리거) */
	mcpConnect(serverKey: string) {
		this.send({ type: "mcp_connect", server: serverKey });
	}

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

	steer(message: AgentMessage | string) {
		const text =
			typeof message === "string"
				? message
				: typeof message.content === "string"
					? message.content
					: (message.content as any[])
							?.filter((c: any) => c.type === "text")
							.map((c: any) => c.text)
							.join("") || "";

		if (!text) return;
		this.send({ type: "steer", message: text });
	}

	abort() {
		this.send({ type: "abort" });
	}

	async setModel(provider: string, modelId: string) {
		try {
			const response = await this.sendCommand({ type: "set_model", provider, modelId });
			if (response.success && response.data) {
				this._state.model = response.data as any;
				this.emitEvent({ type: "state-update", state: this._state });
			} else {
				console.warn("[rpc-adapter] setModel failed:", response.error);
			}
		} catch (err) {
			console.error("[rpc-adapter] setModel error:", err);
		}
	}

	async setThinkingLevel(level: ThinkingLevel) {
		await this.sendCommand({ type: "set_thinking_level", level });
		this._state.thinkingLevel = level;
	}

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

			const timeout = setTimeout(() => {
				this.pendingRequests.delete(id);
				reject(new Error(`Timeout waiting for ${command.type}`));
			}, 30000);

			this.pendingRequests.set(id, {
				resolve: (data) => {
					clearTimeout(timeout);
					resolve(data);
				},
				reject: (err) => {
					clearTimeout(timeout);
					reject(err);
				},
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

		// Response matching: RPC responses (type: "response") and bridge responses (type: "mcp_status_response")
		if (data.id && this.pendingRequests.has(data.id)) {
			const pending = this.pendingRequests.get(data.id)!;
			this.pendingRequests.delete(data.id);
			pending.resolve(data);
			return;
		}

		this.handleAgentEvent(data);
	}

	private handleAgentEvent(event: any) {
		switch (event.type) {
			case "agent_start":
				this._state.isStreaming = true;
				break;

			case "message_update":
				// Don't add to _state.messages during streaming.
				// AgentInterface's streaming-message-container handles display.
				// Messages are added on message_end only.
				break;

			case "message_end": {
				const msg = event.message;
				if (msg) {
					// User messages are already added locally in prompt() — skip RPC version
					// to prevent server-transformed content (e.g. skill blocks) from overwriting original text.
					if (msg.role === "user" && this._pendingUserMessages.length > 0) {
						// If server sent a skill-expanded message, extract skill metadata and update pending
						// message to a compact format so the UI can show which skill was triggered.
						if (typeof msg.content === "string" && msg.content.includes("<skill name=")) {
							const skillMatch = msg.content.match(/<skill name="([^"]+)"/);
							const descMatch = msg.content.match(/^description:\s*(.+)$/m);
							const userMsgMatch = msg.content.match(/<\/skill>\n\n([\s\S]+)$/);
							if (skillMatch) {
								const skillName = skillMatch[1];
								const description = descMatch ? descMatch[1].trim() : "";
								const pendingMsg = this._pendingUserMessages[this._pendingUserMessages.length - 1];
								const originalText = (userMsgMatch ? userMsgMatch[1] : pendingMsg.content).trim();
								// Create new object (not mutation) so Lit detects the change and re-renders
								const updatedMsg = {
									...pendingMsg,
									content: `<skill name="${skillName}">\ndescription: ${description}\n</skill>\n\n${originalText}`,
								};
								this._pendingUserMessages[this._pendingUserMessages.length - 1] = updatedMsg;
								const stateIdx = this._state.messages.indexOf(pendingMsg);
								if (stateIdx >= 0) this._state.messages[stateIdx] = updatedMsg;
								this.emitEvent({ type: "message_end", message: updatedMsg });
							}
						}
						break;
					}
					const lastMsg = this._state.messages[this._state.messages.length - 1];
					if (lastMsg?.role === msg.role) {
						this._state.messages[this._state.messages.length - 1] = msg;
					} else {
						this._state.messages.push(msg);
					}
				}
				break;
			}

			case "agent_end":
				this._state.isStreaming = false;
				if (event.messages) {
					// Replace server messages but restore original user message text
					const pending = [...this._pendingUserMessages];
					this._pendingUserMessages = [];
					let pendingIdx = 0;
					this._state.messages = (event.messages as any[]).map((m: any) => {
						if (m.role === "user" && pendingIdx < pending.length) {
							return pending[pendingIdx++];
						}
						return m;
					});
				} else {
					this._pendingUserMessages = [];
				}
				break;
		}

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
