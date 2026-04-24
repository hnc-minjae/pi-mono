#!/usr/bin/env node
/*
 * Copyright 2026 Hancom Inc. All rights reserved.
 *
 * https://www.hancom.com/
 */

import { spawn } from "node:child_process";
import { resolveHwpCli } from "../src/resolve-hwp-cli.mjs";

const serverPath = resolveHwpCli();
const child = spawn("node", [serverPath, "--service", "cowriter:file"], {
	stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 0));
