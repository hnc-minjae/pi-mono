/*
 * Copyright 2026 Hancom Inc. All rights reserved.
 *
 * https://www.hancom.com/
 */

/**
 * MCP OAuth 토큰 저장/로드
 * ~/.config/han/mcp-tokens.json에 서버별 토큰을 관리한다.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const TOKEN_DIR = join(homedir(), ".config", "han");
const TOKEN_FILE = join(TOKEN_DIR, "mcp-tokens.json");

interface StoredTokens {
	[serverKey: string]: {
		accessToken: string;
		refreshToken?: string;
		expiresAt?: number;
		clientId?: string;
		clientSecret?: string;
		clientInfo?: any;
		codeVerifier?: string;
	};
}

function loadAll(): StoredTokens {
	try {
		return JSON.parse(readFileSync(TOKEN_FILE, "utf-8"));
	} catch {
		return {};
	}
}

function saveAll(data: StoredTokens) {
	mkdirSync(TOKEN_DIR, { recursive: true });
	writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
}

export function loadTokens(serverKey: string) {
	const all = loadAll();
	return all[serverKey] || null;
}

export function saveTokens(serverKey: string, tokens: any) {
	const all = loadAll();
	all[serverKey] = { ...all[serverKey], ...tokens };
	saveAll(all);
}

export function loadClientInfo(serverKey: string) {
	const all = loadAll();
	return all[serverKey]?.clientInfo || null;
}

export function saveClientInfo(serverKey: string, clientInfo: any) {
	const all = loadAll();
	all[serverKey] = { ...all[serverKey], clientInfo };
	saveAll(all);
}

export function loadCodeVerifier(serverKey: string): string {
	const all = loadAll();
	return all[serverKey]?.codeVerifier || "";
}

export function saveCodeVerifier(serverKey: string, verifier: string) {
	const all = loadAll();
	all[serverKey] = { ...all[serverKey], codeVerifier: verifier };
	saveAll(all);
}
