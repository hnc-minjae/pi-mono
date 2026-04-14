/*
 * Copyright 2026 Hancom Inc. All rights reserved.
 *
 * https://www.hancom.com/
 */

/**
 * 릴리즈 빌드용 번들링 스크립트.
 * 1. server/start.ts → dist-server/server/start.js (ws 인라인 번들링)
 * 2. coding-agent/dist/cli.js → dist-server/coding-agent/cli.js (단일 파일 번들)
 * Node builtins는 external 처리.
 */

import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(__dirname, "..");

await build({
	entryPoints: [resolve(desktopRoot, "server/start.ts")],
	bundle: true,
	platform: "node",
	target: "node20",
	format: "esm",
	outfile: resolve(desktopRoot, "dist-server/server/start.js"),
	external: [
		"node:*",
	],
	banner: {
		js: [
			'import { createRequire } from "node:module";',
			'import { fileURLToPath as __ftp } from "node:url";',
			'import { dirname as __dn } from "node:path";',
			"const require = createRequire(import.meta.url);",
			"const __filename = __ftp(import.meta.url);",
			"const __dirname = __dn(__filename);",
		].join("\n"),
	},
});

// mcp-hwp-server.mjs는 이미 번들된 파일 — 그대로 복사
mkdirSync(resolve(desktopRoot, "dist-server/server"), { recursive: true });
cpSync(
	resolve(desktopRoot, "server/mcp-hwp-server.mjs"),
	resolve(desktopRoot, "dist-server/server/mcp-hwp-server.mjs"),
);

console.log("[build-server] Server bundled to dist-server/server/");

// coding-agent CLI 번들링 — 단일 파일로 의존성 포함
const projectRoot = resolve(desktopRoot, "../..");
await build({
	entryPoints: [resolve(projectRoot, "packages/coding-agent/dist/cli.js")],
	bundle: true,
	platform: "node",
	target: "node20",
	format: "esm",
	outfile: resolve(desktopRoot, "dist-server/coding-agent/cli.js"),
	external: [
		"node:*",
	],
	banner: {
		js: [
			'import { createRequire } from "node:module";',
			'import { fileURLToPath as __ftp } from "node:url";',
			'import { dirname as __dn } from "node:path";',
			"const require = createRequire(import.meta.url);",
			"const __filename = __ftp(import.meta.url);",
			"const __dirname = __dn(__filename);",
		].join("\n"),
	},
});

// AGENT.md는 런타임에 readFileSync로 읽으므로 번들에 포함되지 않음 — 수동 복사
const agentMdSrc = resolve(projectRoot, "packages/coding-agent/AGENT.md");
const agentMdDest = resolve(desktopRoot, "dist-server/coding-agent/AGENT.md");
if (existsSync(agentMdSrc)) {
	cpSync(agentMdSrc, agentMdDest);
}

console.log("[build-server] Coding agent bundled to dist-server/coding-agent/");
