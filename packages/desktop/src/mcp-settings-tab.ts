/*
 * Copyright 2026 Hancom Inc. All rights reserved.
 *
 * https://www.hancom.com/
 */

/**
 * MCP 연결 설정 탭 — Settings 다이얼로그에 추가
 */

import { html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Button } from "@mariozechner/mini-lit/dist/Button.js";
import { SettingsTab } from "@mariozechner/pi-web-ui";

interface McpServer {
	key: string;
	name: string;
	connected: boolean;
	expiresAt?: number;
}

@customElement("mcp-settings-tab")
export class McpSettingsTab extends SettingsTab {
	@state() private servers: McpServer[] = [];
	@state() private loading = false;
	@state() private connecting: string | null = null;

	private ws: WebSocket | null = null;

	connectedCallback() {
		super.connectedCallback();
		this.connectWs();
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		this.ws?.close();
		this.ws = null;
	}

	private connectWs() {
		this.ws = new WebSocket("ws://localhost:3001");
		this.ws.onopen = () => this.refreshStatus();
		this.ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.type === "mcp_status_response") {
					this.servers = data.servers || [];
					this.loading = false;
					this.connecting = null;
				}
			} catch {}
		};
	}

	private refreshStatus() {
		this.loading = true;
		this.ws?.send(JSON.stringify({ type: "mcp_status" }));
	}

	private handleConnect(serverKey: string) {
		this.connecting = serverKey;
		this.ws?.send(JSON.stringify({ type: "mcp_connect", server: serverKey }));
		// OAuth 완료 후 상태 갱신 (10초 후 자동 체크)
		setTimeout(() => this.refreshStatus(), 10000);
	}

	private formatExpiry(expiresAt?: number): string {
		if (!expiresAt) return "";
		const date = new Date(expiresAt);
		const now = Date.now();
		const remaining = expiresAt - now;
		if (remaining <= 0) return "만료됨";
		const hours = Math.floor(remaining / 3600000);
		const mins = Math.floor((remaining % 3600000) / 60000);
		return `${date.toLocaleString("ko-KR")} (${hours}시간 ${mins}분 남음)`;
	}

	// SettingsDialog가 기대하는 인터페이스
	getTabName() {
		return "MCP";
	}

	render() {
		return html`
			<div class="space-y-4">
				<div>
					<h3 class="text-lg font-semibold text-foreground">MCP 서버 연결</h3>
					<p class="text-sm text-muted-foreground mt-1">
						외부 서비스(Jira, Confluence 등)에 연결하여 에이전트가 도구로 사용할 수 있습니다.
					</p>
				</div>
				<div class="space-y-3">
					${this.servers.length === 0 && this.loading
						? html`<div class="text-sm text-muted-foreground">연결 상태 확인 중...</div>`
						: this.servers.map(
								(server) => html`
							<div class="flex items-center justify-between p-3 border border-border rounded-lg">
								<div>
									<div class="flex items-center gap-2">
										<span class="font-medium text-foreground">${server.name}</span>
										${server.connected
											? html`<span class="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full">연결됨</span>`
											: html`<span class="text-xs px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded-full">미연결</span>`}
									</div>
									${server.connected && server.expiresAt
										? html`<div class="text-xs text-muted-foreground mt-1">만료: ${this.formatExpiry(server.expiresAt)}</div>`
										: ""}
								</div>
								<div>
									${server.connected
										? Button({
												variant: "ghost",
												size: "sm",
												children: "재연결",
												onClick: () => this.handleConnect(server.key),
												disabled: this.connecting === server.key,
											})
										: Button({
												variant: "default",
												size: "sm",
												children: this.connecting === server.key ? "인증 중..." : "연결",
												onClick: () => this.handleConnect(server.key),
												disabled: this.connecting === server.key,
											})}
								</div>
							</div>
						`,
							)}
				</div>
			</div>
		`;
	}
}
