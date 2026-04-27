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
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
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

// MCP 서버는 npm 패키지(@hancom/hwp-cli)에서 런타임 resolve — 번들에 포함하지 않음

console.log("[build-server] Server bundled to dist-server/server/");

// coding-agent CLI 번들링 — 단일 파일로 의존성 포함
const projectRoot = resolve(desktopRoot, "../..");
await build({
	entryPoints: [resolve(projectRoot, "packages/coding-agent/dist/cli.js")],
	bundle: true,
	platform: "node",
	target: "node20",
	format: "cjs",
	outfile: resolve(desktopRoot, "dist-server/coding-agent/cli.cjs"),
	external: [
		"node:*",
	],
	// CJS에서 import.meta.url을 사용하는 코드를 위한 shim
	banner: {
		js: 'const __import_meta_url = require("node:url").pathToFileURL(__filename).href;',
	},
	define: {
		"import.meta.url": "__import_meta_url",
	},
});

// 런타임에 readFileSync로 읽는 파일들은 번들에 포함되지 않음 — 수동 복사
// 테마 파일 (RPC 모드 초기화 시 필요)
const themeSrc = resolve(projectRoot, "packages/coding-agent/dist/modes/interactive/theme");
const themeDest = resolve(desktopRoot, "dist-server/coding-agent/dist/modes/interactive/theme");
mkdirSync(themeDest, { recursive: true });
for (const file of ["dark.json", "light.json", "theme-schema.json"]) {
	const src = resolve(themeSrc, file);
	if (existsSync(src)) cpSync(src, resolve(themeDest, file));
}

// package.json (PI_PACKAGE_DIR에서 읽으므로 최소 버전 필요)
const origPkg = JSON.parse(readFileSync(resolve(projectRoot, "packages/coding-agent/package.json"), "utf-8"));
const minPkg = { name: origPkg.name, version: origPkg.version };
writeFileSync(resolve(desktopRoot, "dist-server/coding-agent/package.json"), JSON.stringify(minPkg));

// AGENT.md
const agentMdSrc = resolve(projectRoot, "packages/coding-agent/AGENT.md");
const agentMdDest = resolve(desktopRoot, "dist-server/coding-agent/AGENT.md");
if (existsSync(agentMdSrc)) {
	cpSync(agentMdSrc, agentMdDest);
}

console.log("[build-server] Coding agent bundled to dist-server/coding-agent/");

// .pi 에셋 복사 — 에이전트 구성 파일 (npm, han-doc/output 제외)
const piSrc = resolve(projectRoot, ".pi");
const piDest = resolve(desktopRoot, "dist-server/.pi");

// 일반 디렉토리 복사
// subagent 디렉토리는 cp 진입 시점에 skip한다. 이 디렉토리의 {agents,index}.ts는 in-repo의
// packages/coding-agent/examples/extensions/subagent/* 를 가리키는 symlink인데, cpSync가
// symlink를 verbatim으로 복사하면 dist-server 기준 상대 경로가 invalid해져 ENOENT가 난다.
// 5e0f3765의 사후 rmSync는 cp가 통과한 후 처리라 이번 stat-fail 케이스에서는 도달조차 못 한다.
const isSubagentPath = (src) => {
	const rel = relative(piSrc, src);
	return rel === "extensions/subagent" || rel.startsWith(`extensions/subagent/`);
};
for (const dir of ["skills", "extensions", "agents", "docs", "prompts", "scripts"]) {
	const src = resolve(piSrc, dir);
	const dest = resolve(piDest, dir);
	if (existsSync(src)) {
		cpSync(src, dest, { recursive: true, filter: (s) => !isSubagentPath(s) });
	}
}

// .pi/extensions/subagent은 Linux symlink로, Windows 체크아웃 시 텍스트 stub 파일로 materialize되어
// jiti 파서가 ParseError를 던지고 RPC 에이전트가 fatal exit한다.
// (upstream 9f9277cc 이후 모든 error 진단이 fatal). 번들에서 제외하여 회귀 차단.
const brokenSubagentDest = resolve(piDest, "extensions/subagent");
if (existsSync(brokenSubagentDest)) {
	rmSync(brokenSubagentDest, { recursive: true, force: true });
	console.log("[build-server] Excluded broken subagent extension stubs from bundle");
}

// han-doc/templates 복사 (output 제외)
const hanDocTemplatesSrc = resolve(piSrc, "han-doc/templates");
const hanDocTemplatesDest = resolve(piDest, "han-doc/templates");
if (existsSync(hanDocTemplatesSrc)) {
	mkdirSync(hanDocTemplatesDest, { recursive: true });
	cpSync(hanDocTemplatesSrc, hanDocTemplatesDest, { recursive: true });
}

console.log("[build-server] .pi assets copied to dist-server/.pi/");

// HWP MCP stdio 서버 번들 복사 (@hancom/hwp-cli)
const hwpMcpSrc = resolve(projectRoot, "node_modules/@hancom/hwp-cli/dist/mcp-stdio-server.mjs");
const hwpMcpDest = resolve(desktopRoot, "dist-server/hwp-mcp/mcp-stdio-server.mjs");
if (existsSync(hwpMcpSrc)) {
	mkdirSync(dirname(hwpMcpDest), { recursive: true });
	cpSync(hwpMcpSrc, hwpMcpDest);

	// winax: 한글 COM 자동화용 네이티브 애드온 (cowriter:auto 서비스에 필요)
	// mcp-stdio-server.mjs가 require("winax")로 동적 로드 — node_modules에 있어야 함
	const winaxSrc = resolve(projectRoot, "node_modules/winax");
	if (existsSync(winaxSrc)) {
		const winaxDest = resolve(desktopRoot, "dist-server/hwp-mcp/node_modules/winax");
		mkdirSync(resolve(winaxDest, "build/Release"), { recursive: true });
		for (const f of ["index.js", "activex.js", "package.json"]) {
			if (existsSync(resolve(winaxSrc, f))) cpSync(resolve(winaxSrc, f), resolve(winaxDest, f));
		}
		cpSync(resolve(winaxSrc, "build/Release"), resolve(winaxDest, "build/Release"), { recursive: true });
		console.log("[build-server] winax (COM automation) copied to dist-server/hwp-mcp/node_modules/");
	} else {
		console.warn("[build-server] WARNING: winax not found — HWP COM automation will not work");
	}

	console.log("[build-server] HWP MCP server copied to dist-server/hwp-mcp/");
} else {
	console.warn("[build-server] WARNING: @hancom/hwp-cli MCP server not found");
}

// tauri.conf.json 리소스 항목 자동 생성 — .pi/ 서브디렉토리 구조 보존
// Tauri의 **/* 패턴은 파일을 flat하게 설치하므로 각 디렉토리마다 명시적 항목 필요
function collectLeafDirs(dir) {
	const dirs = new Set();
	function walk(current) {
		const entries = readdirSync(current, { withFileTypes: true });
		const hasFiles = entries.some((e) => e.isFile());
		if (hasFiles) {
			dirs.add(current);
		}
		for (const entry of entries) {
			if (entry.isDirectory()) {
				walk(resolve(current, entry.name));
			}
		}
	}
	walk(dir);
	return dirs;
}

const piDest2 = resolve(desktopRoot, "dist-server/.pi");
const leafDirs = collectLeafDirs(piDest2);

const baseResources = {
	"../dist-server/server/*": "server/",
	"../dist-server/coding-agent/*": "coding-agent/",
	"../dist-server/coding-agent/dist/modes/interactive/theme/*": "coding-agent/dist/modes/interactive/theme/",
	"../dist-server/hwp-mcp/*": "hwp-mcp/",
};

// .pi/ 리소스
for (const leafDir of leafDirs) {
	const rel = relative(piDest2, leafDir).replace(/\\/g, "/");
	const src = rel ? `../dist-server/.pi/${rel}/*` : "../dist-server/.pi/*";
	const dest = rel ? `.pi/${rel}/` : ".pi/";
	baseResources[src] = dest;
}

// hwp-mcp/node_modules 리소스 (winax 등 네이티브 의존성)
const hwpNmDest = resolve(desktopRoot, "dist-server/hwp-mcp/node_modules");
if (existsSync(hwpNmDest)) {
	const hwpNmLeafDirs = collectLeafDirs(hwpNmDest);
	for (const leafDir of hwpNmLeafDirs) {
		const rel = relative(hwpNmDest, leafDir).replace(/\\/g, "/");
		const src = rel ? `../dist-server/hwp-mcp/node_modules/${rel}/*` : "../dist-server/hwp-mcp/node_modules/*";
		const dest = rel ? `hwp-mcp/node_modules/${rel}/` : "hwp-mcp/node_modules/";
		baseResources[src] = dest;
	}
}

const tauriConfPath = resolve(desktopRoot, "src-tauri/tauri.conf.json");
const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf-8"));
tauriConf.bundle.resources = baseResources;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n");
console.log(`[build-server] tauri.conf.json updated — ${leafDirs.size} .pi resource entries added`);
