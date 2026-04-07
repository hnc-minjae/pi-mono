/*
 * Copyright 2026 Hancom Inc. All rights reserved.
 *
 * https://www.hancom.com/
 */

/**
 * MCP 연결 설정 탭 — Settings 다이얼로그에 추가
 * RpcAgent의 WebSocket을 공유하여 bridge 서버와 통신한다.
 */

import { Button } from "@mariozechner/mini-lit/dist/Button.js";
import { SettingsTab } from "@mariozechner/pi-web-ui";
import { html } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { RpcAgent } from "./rpc-adapter.js";

interface McpServer {
	key: string;
	name: string;
	connected: boolean;
	expiresAt?: number;
}

// 기본 서버 목록 (상태는 비동기로 갱신)
const DEFAULT_SERVERS: McpServer[] = [{ key: "atlassian", name: "Atlassian (Jira/Confluence)", connected: false }];

@customElement("mcp-settings-tab")
export class McpSettingsTab extends SettingsTab {
	@state() private servers: McpServer[] = [...DEFAULT_SERVERS];
	@state() private connecting: string | null = null;

	private agent: RpcAgent | null = null;

	setAgent(agent: RpcAgent) {
		this.agent = agent;
	}

	getTabName() {
		return "MCP";
	}

	override connectedCallback() {
		super.connectedCallback();
		// DOM에 연결된 후 상태 갱신
		this.refreshStatus();
	}

	private async refreshStatus() {
		if (!this.agent) return;
		try {
			const response = await this.agent.getMcpStatus();
			if (response?.servers) {
				this.servers = response.servers;
			}
		} catch {
			// 실패해도 기본 서버 목록 유지
		}
	}

	private handleConnect(serverKey: string) {
		if (!this.agent) return;
		this.connecting = serverKey;
		this.agent.mcpConnect(serverKey);
		setTimeout(() => {
			this.refreshStatus();
			this.connecting = null;
		}, 15000);
	}

	private formatExpiry(expiresAt?: number): string {
		if (!expiresAt) return "";
		const now = Date.now();
		const remaining = expiresAt - now;
		if (remaining <= 0) return "만료됨";
		const hours = Math.floor(remaining / 3600000);
		const mins = Math.floor((remaining % 3600000) / 60000);
		return `${hours}시간 ${mins}분 남음`;
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
					${this.servers.map(
						(server) => html`
						<div class="flex items-center justify-between p-3 border border-border rounded-lg">
							<div>
								<div class="flex items-center gap-2">
									<span class="font-medium text-foreground">${server.name}</span>
									${
										server.connected
											? html`<span class="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full">연결됨</span>`
											: html`<span class="text-xs px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded-full">미연결</span>`
									}
								</div>
								${
									server.connected && server.expiresAt
										? html`<div class="text-xs text-muted-foreground mt-1">토큰 만료: ${this.formatExpiry(server.expiresAt)}</div>`
										: ""
								}
							</div>
							<div>
								${
									server.connected
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
											})
								}
							</div>
						</div>
					`,
					)}
				</div>
			</div>
		`;
	}
}
