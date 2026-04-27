#!/usr/bin/env node
/*
 * Copyright 2026 Hancom Inc. All rights reserved.
 *
 * https://www.hancom.com/
 */

import { spawn } from "node:child_process";
import { resolveHwpCli } from "../src/resolve-hwp-cli.mjs";

// MCP 서버가 상대경로 인자(예: "templates/계획서.hwpx")를 받았을 때 어디 기준으로
// 해석할지를 결정한다. 우선순위: HAN_HWP_ROOT 환경변수 > 현재 cwd.
// LG ChatExaone 통합처럼 모델이 system prompt의 cwd를 인자에 prepend하지 않는 경우,
// MCP 서버 자체의 cwd를 결정적으로 고정해야 SKILL.md의 `templates/...`가 정확히 풀린다.
const cwd = process.env.HAN_HWP_ROOT || process.cwd();

const serverPath = resolveHwpCli();
const child = spawn("node", [serverPath, "--service", "cowriter:file"], {
	stdio: "inherit",
	cwd,
	env: { ...process.env, HAN_HWP_ROOT: cwd },
});

child.on("exit", (code) => process.exit(code ?? 0));
