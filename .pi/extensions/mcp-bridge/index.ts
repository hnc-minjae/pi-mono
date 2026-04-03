/*
 * Copyright 2026 Hancom Inc. All rights reserved.
 *
 * https://www.hancom.com/
 */

/**
 * MCP Bridge Extension for pi-coding-agent
 *
 * MCP 서버(Atlassian 등)에 OAuth로 직접 인증하여 연결하고,
 * 해당 서버의 도구들을 pi.registerTool()로 등록한다.
 *
 * OAuth 토큰은 ~/.config/han/mcp-tokens.json에 자체 관리한다.
 */

// 사내 SSL 프록시 환경에서 인증서 검증 우회 (개발 환경 전용)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { Type } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpOAuthProvider } from "./oauth-provider.js";

// --- MCP Server Config ---

interface McpServerConfig {
	key: string;
	name: string;
	url: string;
	prefix: string;
}

const MCP_SERVERS: McpServerConfig[] = [
	{
		key: "atlassian",
		name: "Atlassian",
		url: "https://mcp.atlassian.com/v1/mcp",
		prefix: "mcp__atlassian",
	},
];

// --- Types ---

interface McpToolSchema {
	name: string;
	description?: string;
	inputSchema?: {
		type: string;
		properties?: Record<string, any>;
		required?: string[];
	};
}

// --- Tool Registration ---

function convertJsonSchemaToTypeBox(schema: any): any {
	if (!schema || !schema.properties) {
		return Type.Object({});
	}

	const props: Record<string, any> = {};
	for (const [key, value] of Object.entries(schema.properties)) {
		const prop = value as any;
		const desc = prop.description || key;

		switch (prop.type) {
			case "number":
			case "integer":
				props[key] = Type.Optional(Type.Number({ description: desc }));
				break;
			case "boolean":
				props[key] = Type.Optional(Type.Boolean({ description: desc }));
				break;
			case "array":
				props[key] = Type.Optional(Type.Array(Type.String(), { description: desc }));
				break;
			default:
				props[key] = Type.Optional(Type.String({ description: desc }));
				break;
		}
	}

	if (schema.required) {
		for (const req of schema.required) {
			if (props[req]) {
				const inner = props[req];
				if (inner.modifier === "Optional") {
					props[req] = { ...inner, modifier: undefined };
				}
			}
		}
	}

	return Type.Object(props);
}

function registerMcpTool(
	pi: ExtensionAPI,
	client: Client,
	serverPrefix: string,
	tool: McpToolSchema,
) {
	const toolName = `${serverPrefix}__${tool.name}`;
	const parameters = convertJsonSchemaToTypeBox(tool.inputSchema);

	pi.registerTool({
		name: toolName,
		label: tool.name,
		description: tool.description || `MCP tool: ${tool.name}`,
		promptSnippet: `${toolName}: ${tool.description || tool.name}`,
		parameters,

		async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
			try {
				const result = await client.callTool(
					{ name: tool.name, arguments: params },
					undefined,
					{ signal: signal || AbortSignal.timeout(30000) },
				);

				const content = result.content as any[];
				const textParts =
					content
						?.filter((c: any) => c.type === "text")
						.map((c: any) => c.text)
						.join("\n") || JSON.stringify(result);

				return {
					content: [{ type: "text" as const, text: textParts }],
					details: result,
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					content: [{ type: "text" as const, text: `MCP tool error: ${message}` }],
					details: { error: message },
				};
			}
		},
	});
}

// --- MCP Connection with OAuth ---

async function connectWithOAuth(config: McpServerConfig): Promise<Client | null> {
	const authProvider = new McpOAuthProvider(config.key);

	// 1차 시도: 기존 토큰으로 연결
	try {
		const transport = new StreamableHTTPClientTransport(new URL(config.url), {
			authProvider,
		});
		const client = new Client({ name: "han-ai-orchestrator", version: "1.0.0" });
		await client.connect(transport);
		console.log(`[mcp-bridge] ${config.name}: 기존 토큰으로 연결 성공!`);
		return client;
	} catch {
		// 토큰 없거나 만료 — OAuth 플로우 진행
	}

	// OAuth 플로우: 브라우저 인증 후 토큰 획득까지 대기
	console.log(`[mcp-bridge] ${config.name}: OAuth 인증이 필요합니다. 브라우저에서 인증을 완료해 주세요...`);
	const authenticated = await authProvider.waitForAuthentication(config.url);
	if (!authenticated) {
		console.error(`[mcp-bridge] ${config.name}: 인증 실패 또는 시간 초과`);
		return null;
	}

	// 2차 시도: 새 토큰으로 연결
	try {
		const transport = new StreamableHTTPClientTransport(new URL(config.url), {
			authProvider,
		});
		const client = new Client({ name: "han-ai-orchestrator", version: "1.0.0" });
		await client.connect(transport);
		console.log(`[mcp-bridge] ${config.name}: OAuth 인증 후 연결 성공!`);
		return client;
	} catch (err: any) {
		console.error(`[mcp-bridge] ${config.name}: 인증 후에도 연결 실패:`, err?.message);
		return null;
	}
}

// --- Extension Entry ---

export default async function mcpBridgeExtension(pi: ExtensionAPI) {
	console.log("[mcp-bridge] Starting MCP Bridge Extension...");

	// MCP 연결 커맨드 등록
	pi.registerCommand("mcp-connect", {
		description: "MCP 서버에 연결 (OAuth 인증 포함)",
		handler: async (_args, ctx) => {
			for (const config of MCP_SERVERS) {
				ctx.ui.notify(`[mcp-bridge] ${config.name} 연결 시도...`, "info");

				const client = await connectWithOAuth(config);
				if (!client) {
					ctx.ui.notify(`[mcp-bridge] ${config.name} 연결 실패`, "warning");
					continue;
				}

				try {
					const toolsResult = await client.listTools();
					const tools = toolsResult.tools || [];

					for (const tool of tools) {
						registerMcpTool(pi, client, config.prefix, tool as McpToolSchema);
					}

					ctx.ui.notify(
						`[mcp-bridge] ${config.name}: ${tools.length}개 도구 등록 완료`,
						"info",
					);
				} catch (err: any) {
					ctx.ui.notify(
						`[mcp-bridge] ${config.name} 도구 조회 실패: ${err?.message}`,
						"warning",
					);
				}
			}
		},
	});

	// session_start 이벤트에서 도구 등록 (bindCore() 이후이므로 refreshTools()가 동작)
	pi.on("session_start", async () => {
		for (const config of MCP_SERVERS) {
			console.log(`[mcp-bridge] Connecting to ${config.name} (${config.url})...`);

			const client = await connectWithOAuth(config);
			if (!client) {
				console.log(`[mcp-bridge] ${config.name}: 자동 연결 실패. /mcp-connect 로 수동 연결하세요.`);
				continue;
			}

			try {
				const toolsResult = await client.listTools();
				const tools = toolsResult.tools || [];

				console.log(`[mcp-bridge] ${config.name}: ${tools.length} tools available`);

				for (const tool of tools) {
					registerMcpTool(pi, client, config.prefix, tool as McpToolSchema);
				}

				console.log(`[mcp-bridge] ${config.name}: all tools registered`);
			} catch (err: any) {
				console.error(`[mcp-bridge] Failed to list tools for ${config.name}:`, err?.message);
			}
		}
	});

	// 매 턴마다 han-config.md 내용을 시스템 프롬프트에 주입
	pi.on("before_agent_start", async () => {
		try {
			const configPath = join(homedir(), ".config", "han", "han-config.md");
			const config = readFileSync(configPath, "utf-8");
			return {
				systemPrompt: `\n\n## 사용자 환경 설정 (han-config.md)\n\n${config}`,
			};
		} catch {
			return {};
		}
	});
}
