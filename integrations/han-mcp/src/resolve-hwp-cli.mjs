/*
 * Copyright 2026 Hancom Inc. All rights reserved.
 *
 * https://www.hancom.com/
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export function resolveHwpCli() {
	const vendorPath = join(packageRoot, "vendor", "mcp-stdio-server.mjs");
	if (existsSync(vendorPath)) return vendorPath;

	throw new Error(
		`HWP MCP server bundle not found at ${vendorPath}. 패키지가 손상되었을 수 있습니다.`,
	);
}
