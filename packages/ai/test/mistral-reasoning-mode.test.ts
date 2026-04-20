/*
 * Copyright 2026 Hancom Inc. All rights reserved.
 *
 * https://www.hancom.com/
 */

import { describe, expect, it } from "vitest";
import { streamSimple } from "../src/stream.js";
import type { Context, Model, SimpleStreamOptions } from "../src/types.js";

const mistralSmall: Model<"mistral-conversations"> = {
	id: "mistral-small-2603",
	name: "Mistral Small 2603",
	api: "mistral-conversations",
	provider: "mistral",
	baseUrl: "https://api.mistral.ai",
	reasoning: true,
	input: ["text"],
	cost: { input: 0.1, output: 0.3, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 32768,
	maxTokens: 4096,
};

const magistralMedium: Model<"mistral-conversations"> = {
	id: "magistral-medium-latest",
	name: "Magistral Medium",
	api: "mistral-conversations",
	provider: "mistral",
	baseUrl: "https://api.mistral.ai",
	reasoning: true,
	input: ["text"],
	cost: { input: 0.6, output: 1.8, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 131072,
	maxTokens: 16384,
};

interface MistralPayload {
	promptMode?: "reasoning";
	reasoningEffort?: "none" | "high";
}

function makeContext(): Context {
	return {
		messages: [{ role: "user", content: "Hello", timestamp: Date.now() }],
	};
}

async function capturePayload(
	model: Model<"mistral-conversations">,
	options?: SimpleStreamOptions,
): Promise<MistralPayload> {
	let capturedPayload: MistralPayload | undefined;
	const payloadCaptureModel: Model<"mistral-conversations"> = {
		...model,
		baseUrl: "http://127.0.0.1:9",
	};

	const stream = streamSimple(payloadCaptureModel, makeContext(), {
		...options,
		apiKey: "fake-key",
		onPayload: (payload) => {
			capturedPayload = payload as MistralPayload;
			return payload;
		},
	});

	await stream.result();

	if (!capturedPayload) {
		throw new Error("Expected payload to be captured before request failure");
	}

	return capturedPayload;
}

describe("Mistral reasoning mode selection", () => {
	it("uses reasoning_effort for Mistral Small 4", async () => {
		const payload = await capturePayload(mistralSmall, { reasoning: "medium" });

		expect(payload.reasoningEffort).toBe("high");
		expect(payload.promptMode).toBeUndefined();
	});

	it("omits reasoning controls for Mistral Small 4 when thinking is off", async () => {
		const payload = await capturePayload(mistralSmall);

		expect(payload.reasoningEffort).toBeUndefined();
		expect(payload.promptMode).toBeUndefined();
	});

	it("uses prompt_mode for Magistral reasoning models", async () => {
		const payload = await capturePayload(magistralMedium, { reasoning: "medium" });

		expect(payload.promptMode).toBe("reasoning");
		expect(payload.reasoningEffort).toBeUndefined();
	});
});
