/*
 * Copyright 2026 Hancom Inc. All rights reserved.
 *
 * https://www.hancom.com/
 */

/**
 * OAuthClientProvider 구현 — MCP SDK용
 *
 * 로컬 HTTP 콜백 서버를 띄워 OAuth authorization_code 플로우를 처리한다.
 * 토큰은 ~/.config/han/mcp-tokens.json에 저장한다.
 */

import { createServer, type Server } from "node:http";
import { URL } from "node:url";
import { exec } from "node:child_process";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
	OAuthClientMetadata,
	OAuthClientInformationMixed,
	OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import {
	loadTokens,
	saveTokens,
	loadClientInfo,
	saveClientInfo,
	loadCodeVerifier,
	saveCodeVerifier,
} from "./token-store.js";

const CALLBACK_PORT = 9876;
const CALLBACK_PATH = "/oauth/callback";

export class McpOAuthProvider implements OAuthClientProvider {
	private serverKey: string;
	private callbackServer: Server | null = null;
	private authResolve: ((code: string) => void) | null = null;

	constructor(serverKey: string) {
		this.serverKey = serverKey;
	}

	get redirectUrl(): string {
		return `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`;
	}

	get clientMetadata(): OAuthClientMetadata {
		return {
			client_name: "Han AI Orchestrator",
			redirect_uris: [this.redirectUrl],
			grant_types: ["authorization_code", "refresh_token"],
			response_types: ["code"],
			token_endpoint_auth_method: "none",
		};
	}

	async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
		const info = loadClientInfo(this.serverKey);
		return info || undefined;
	}

	async saveClientInformation(clientInfo: OAuthClientInformationMixed): Promise<void> {
		saveClientInfo(this.serverKey, clientInfo);
	}

	async tokens(): Promise<OAuthTokens | undefined> {
		const stored = loadTokens(this.serverKey);
		if (!stored?.accessToken) return undefined;

		return {
			access_token: stored.accessToken,
			refresh_token: stored.refreshToken,
			token_type: "Bearer",
		};
	}

	async saveTokens(tokens: OAuthTokens): Promise<void> {
		saveTokens(this.serverKey, {
			accessToken: tokens.access_token,
			refreshToken: tokens.refresh_token,
			expiresAt: tokens.expires_in
				? Date.now() + tokens.expires_in * 1000
				: undefined,
		});
		console.log(`[mcp-oauth] Tokens saved for ${this.serverKey}`);
	}

	async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
		console.log(`[mcp-oauth] Opening browser for authorization...`);
		console.log(`[mcp-oauth] URL: ${authorizationUrl.toString()}`);

		// 콜백 서버 시작
		await this.startCallbackServer();

		// 브라우저 열기
		const url = authorizationUrl.toString();
		const platform = process.platform;
		if (platform === "darwin") {
			exec(`open "${url}"`);
		} else if (platform === "win32") {
			exec(`start "${url}"`);
		} else {
			exec(`xdg-open "${url}"`);
		}
	}

	async saveCodeVerifier(verifier: string): Promise<void> {
		saveCodeVerifier(this.serverKey, verifier);
	}

	async codeVerifier(): Promise<string> {
		return loadCodeVerifier(this.serverKey);
	}

	/**
	 * 로컬 콜백 서버를 시작하여 OAuth redirect를 수신한다.
	 */
	private startCallbackServer(): Promise<void> {
		return new Promise((resolve) => {
			if (this.callbackServer) {
				resolve();
				return;
			}

			this.callbackServer = createServer((req, res) => {
				const url = new URL(req.url || "", `http://localhost:${CALLBACK_PORT}`);

				if (url.pathname === CALLBACK_PATH) {
					const code = url.searchParams.get("code");
					const error = url.searchParams.get("error");

					if (error) {
						res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
						res.end(`<html><body><h2>인증 실패</h2><p>${error}</p><script>window.close()</script></body></html>`);
					} else if (code) {
						res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
						res.end(`<html><body><h2>인증 완료!</h2><p>이 창을 닫아도 됩니다.</p><script>window.close()</script></body></html>`);

						if (this.authResolve) {
							this.authResolve(code);
							this.authResolve = null;
						}
					} else {
						res.writeHead(400);
						res.end("Missing code parameter");
					}

					// 콜백 수신 후 서버 종료
					setTimeout(() => this.stopCallbackServer(), 1000);
				} else {
					res.writeHead(404);
					res.end("Not found");
				}
			});

			this.callbackServer.listen(CALLBACK_PORT, () => {
				console.log(`[mcp-oauth] Callback server listening on http://localhost:${CALLBACK_PORT}`);
				resolve();
			});
		});
	}

	private stopCallbackServer() {
		if (this.callbackServer) {
			this.callbackServer.close();
			this.callbackServer = null;
			console.log("[mcp-oauth] Callback server stopped");
		}
	}
}
