#!/usr/bin/env node
/*
 * Copyright 2026 Hancom Inc. All rights reserved.
 *
 * https://www.hancom.com/
 *
 * @hancom/hwp-cli/dist/mcp-stdio-server.mjs를 javascript-obfuscator로 난독화하여
 * vendor/mcp-stdio-server.mjs로 출력한다. LG ChatExaone 등 외부 배포용 번들 갱신 시 사용.
 *
 * 옵션은 6a6a6152 commit과 동일하게 string array(base64) + identifier 난독화만 적용하고,
 * 런타임 부담이 큰 control-flow-flattening · dead-code-injection은 비활성화한다.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JavaScriptObfuscator from "javascript-obfuscator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = resolve(__dirname, "..");
const requireFromHere = createRequire(import.meta.url);

let sourcePath;
try {
	sourcePath = requireFromHere.resolve("@hancom/hwp-cli/dist/mcp-stdio-server.mjs");
} catch (err) {
	console.error(
		"[build-vendor] @hancom/hwp-cli를 찾을 수 없습니다. GITLAB_NPM_TOKEN을 설정하고 root에서 'npm install'을 먼저 실행하세요.",
	);
	console.error(`[build-vendor] cause: ${err instanceof Error ? err.message : String(err)}`);
	process.exit(1);
}

const source = readFileSync(sourcePath, "utf-8");

const obfuscated = JavaScriptObfuscator.obfuscate(source, {
	compact: true,
	stringArray: true,
	stringArrayEncoding: ["base64"],
	stringArrayThreshold: 0.75,
	identifierNamesGenerator: "hexadecimal",
	controlFlowFlattening: false,
	deadCodeInjection: false,
	target: "node",
}).getObfuscatedCode();

const outDir = join(packageRoot, "vendor");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "mcp-stdio-server.mjs");
writeFileSync(outPath, obfuscated, "utf-8");

console.log(
	`[build-vendor] ${sourcePath} (${source.length.toLocaleString()} bytes)`,
);
console.log(
	`[build-vendor]   → ${outPath} (${obfuscated.length.toLocaleString()} bytes)`,
);
