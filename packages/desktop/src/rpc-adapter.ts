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

	get state(): AgentState {
		return this._state;
	}

	get isRunning(): boolean {
		return this._state.isStreaming;
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
					.catch(reject);
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

		this._state.isStreaming = true;
		this.emitEvent({ type: "agent_start" });
		this.send({ type: "prompt", message: text });
	}

	abort() {
		this.send({ type: "abort" });
	}

	async setModel(provider: string, modelId: string) {
		const response = await this.sendCommand({ type: "set_model", provider, modelId });
		if (response.success && response.data) {
			this._state.model = response.data as any;
			this.emitEvent({ type: "state-update", state: this._state });
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

		if (data.type === "response" && data.id && this.pendingRequests.has(data.id)) {
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

			case "message_update": {
				const msg = event.message;
				if (msg) {
					const lastMsg = this._state.messages[this._state.messages.length - 1];
					if (lastMsg?.role === "assistant") {
						this._state.messages[this._state.messages.length - 1] = msg;
					} else {
						this._state.messages.push(msg);
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

			case "agent_end":
				this._state.isStreaming = false;
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
