/*
 * Copyright 2026 Hancom Inc. All rights reserved.
 *
 * https://www.hancom.com/
 */

import { Box, type MarkdownTheme, Text } from "@mariozechner/pi-tui";
import type { ParsedSkillBlock } from "../../../core/agent-session.js";
import { getMarkdownTheme, theme } from "../theme/theme.js";

/**
 * Component that renders a skill invocation message with collapsed/expanded state.
 * Uses same background color as custom messages for visual consistency.
 * Only renders the skill block itself - user message is rendered separately.
 */
export class SkillInvocationMessageComponent extends Box {
	private skillBlock: ParsedSkillBlock;

	constructor(skillBlock: ParsedSkillBlock, _markdownTheme: MarkdownTheme = getMarkdownTheme()) {
		super(1, 1, (t) => theme.bg("customMessageBg", t));
		this.skillBlock = skillBlock;
		this.updateDisplay();
	}

	// Implements Expandable interface — always stays collapsed
	setExpanded(_expanded: boolean): void {}

	override invalidate(): void {
		super.invalidate();
		this.updateDisplay();
	}

	private updateDisplay(): void {
		this.clear();
		const line =
			theme.fg("customMessageLabel", `\x1b[1m[skill]\x1b[22m `) +
			theme.fg("customMessageText", this.skillBlock.name);
		this.addChild(new Text(line, 0, 0));
	}
}
