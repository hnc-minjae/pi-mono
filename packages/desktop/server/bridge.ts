/*
 * Copyright 2026 Hancom Inc. All rights reserved.
 *
 * https://www.hancom.com/
 */

import { type ChildProcess, spawn } from "node:child_process";
import { resolve } from "node:path";
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
	state.rpcProcess = spawnRpcAgent();
	setupRpcStdoutReader(state.rpcProcess);

	const wss = new WebSocketServer({ port: WS_PORT });
	console.log(`[bridge] WebSocket server listening on ws://localhost:${WS_PORT}`);

	wss.on("connection", (ws) => {
		console.log("[bridge] Client connected");

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
