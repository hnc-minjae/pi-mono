/*
 * Copyright 2026 Hancom Inc. All rights reserved.
 *
 * https://www.hancom.com/
 */

import { type ChildProcess, spawn } from "node:child_process";
import { resolve, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { WebSocketServer, WebSocket } from "ws";

const WS_PORT = parseInt(process.env.WS_PORT || "3001", 10);

// Path to the coding-agent CLI
const CLI_PATH = resolve(import.meta.dirname, "../../coding-agent/dist/cli.js");

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

	const provider = process.env.RPC_PROVIDER || "openai";
	const model = process.env.RPC_MODEL || "gpt-5.4";
	args.push("--provider", provider, "--model", model);

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

// --- MCP Management ---

const TOKEN_FILE = join(homedir(), ".config", "han", "mcp-tokens.json");

function getMcpStatus(): { servers: Array<{ key: string; name: string; connected: boolean; expiresAt?: number }> } {
	// stdio 서버는 토큰 없이 항상 연결 가능
	const stdioServers = new Set(["hwp-cowriter-file"]);

	const servers = [
		{ key: "atlassian", name: "Atlassian (Jira/Confluence)" },
		{ key: "hwp-cowriter-file", name: "HWP Cowriter (File)" },
	];

	let tokens: Record<string, any> = {};
	try {
		if (existsSync(TOKEN_FILE)) {
			tokens = JSON.parse(readFileSync(TOKEN_FILE, "utf-8"));
		}
	} catch {}

	return {
		servers: servers.map((s) => {
			if (stdioServers.has(s.key)) {
				return { key: s.key, name: s.name, connected: true };
			}
			const token = tokens[s.key];
			const hasToken = !!token?.accessToken;
			const expiresAt = token?.expiresAt;
			const isExpired = expiresAt ? Date.now() > expiresAt : false;
			return {
				key: s.key,
				name: s.name,
				connected: hasToken && !isExpired,
				expiresAt,
			};
		}),
	};
}

function handleMcpCommand(ws: WebSocket, data: any): boolean {
	switch (data.type) {
		case "mcp_status": {
			const status = getMcpStatus();
			ws.send(JSON.stringify({ type: "mcp_status_response", id: data.id, ...status }));
			return true;
		}
		case "mcp_connect": {
			// RPC 에이전트에 /mcp-connect 명령 전달
			sendToRpc(JSON.stringify({ type: "prompt", id: data.id, message: "/mcp-connect" }));
			return true;
		}
		default:
			return false;
	}
}

export function startBridge() {
	state.rpcProcess = spawnRpcAgent();
	setupRpcStdoutReader(state.rpcProcess);

	// RPC 초기화 후 thinking level 설정
	const thinkingLevel = process.env.RPC_THINKING_LEVEL || "medium";
	setTimeout(() => {
		sendToRpc(JSON.stringify({ type: "set_thinking_level", level: thinkingLevel }));
		console.log(`[bridge] Thinking level set to: ${thinkingLevel}`);
	}, 3000);

	const wss = new WebSocketServer({ port: WS_PORT });
	console.log(`[bridge] WebSocket server listening on ws://localhost:${WS_PORT}`);

	wss.on("connection", (ws) => {
		console.log("[bridge] Client connected");

		if (state.wsClient) {
			state.wsClient.close();
		}
		state.wsClient = ws;

		ws.on("message", (raw) => {
			const message = raw.toString();
			try {
				const parsed = JSON.parse(message);
				if (handleMcpCommand(ws, parsed)) return;
			} catch {}
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
