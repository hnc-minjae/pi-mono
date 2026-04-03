/*
 * Copyright 2026 Hancom Inc. All rights reserved.
 *
 * https://www.hancom.com/
 */

import "@mariozechner/mini-lit/dist/ThemeToggle.js";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import {
	AppStorage,
	ChatPanel,
	CustomProvidersStore,
	IndexedDBStorageBackend,
	ProviderKeysStore,
	ProvidersModelsTab,
	ProxyTab,
	SessionListDialog,
	SessionsStore,
	SettingsDialog,
	SettingsStore,
	setAppStorage,
} from "@mariozechner/pi-web-ui";
import { html, render } from "lit";
import { History, Plus, Settings } from "lucide";
import "./app.css";
import { McpSettingsTab } from "./mcp-settings-tab.js";
import { icon } from "@mariozechner/mini-lit";
import { Button } from "@mariozechner/mini-lit/dist/Button.js";
import { Input } from "@mariozechner/mini-lit/dist/Input.js";
import { registerCustomMessageRenderers } from "./custom-messages.js";
import { RpcAgent } from "./rpc-adapter.js";

registerCustomMessageRenderers();

// Storage setup
const settings = new SettingsStore();
const providerKeys = new ProviderKeysStore();
const sessions = new SessionsStore();
const customProviders = new CustomProvidersStore();

const configs = [
	settings.getConfig(),
	SessionsStore.getMetadataConfig(),
	providerKeys.getConfig(),
	customProviders.getConfig(),
	sessions.getConfig(),
];

const backend = new IndexedDBStorageBackend({
	dbName: "han-ai-desktop",
	version: 1,
	stores: configs,
});

settings.setBackend(backend);
providerKeys.setBackend(backend);
customProviders.setBackend(backend);
sessions.setBackend(backend);

const storage = new AppStorage(settings, providerKeys, sessions, customProviders, backend);
setAppStorage(storage);

let currentSessionId: string | undefined;
let currentTitle = "";
let prevTitle = "";
let isEditingTitle = false;
let agent: RpcAgent;
let chatPanel: ChatPanel;
let agentUnsubscribe: (() => void) | undefined;

const WS_URL = "ws://localhost:3001";

const generateTitle = (messages: AgentMessage[]): string => {
	const firstUserMsg = messages.find((m) => m.role === "user" || m.role === "user-with-attachments");
	if (!firstUserMsg || (firstUserMsg.role !== "user" && firstUserMsg.role !== "user-with-attachments")) return "";

	let text = "";
	const content = firstUserMsg.content;

	if (typeof content === "string") {
		text = content;
	} else {
		const textBlocks = content.filter((c: any) => c.type === "text");
		text = textBlocks.map((c: any) => c.text || "").join(" ");
	}

	text = text.trim();
	if (!text) return "";

	const sentenceEnd = text.search(/[.!?]/);
	if (sentenceEnd > 0 && sentenceEnd <= 50) {
		return text.substring(0, sentenceEnd + 1);
	}
	return text.length <= 50 ? text : `${text.substring(0, 47)}...`;
};

const shouldSaveSession = (messages: AgentMessage[]): boolean => {
	const hasUserMsg = messages.some((m: any) => m.role === "user" || m.role === "user-with-attachments");
	const hasAssistantMsg = messages.some((m: any) => m.role === "assistant");
	return hasUserMsg && hasAssistantMsg;
};

const saveSession = async () => {
	if (!storage.sessions || !currentSessionId || !agent || !currentTitle) return;

	const state = agent.state;
	if (!shouldSaveSession(state.messages)) return;

	try {
		const sessionData = {
			id: currentSessionId,
			title: currentTitle,
			model: state.model!,
			thinkingLevel: state.thinkingLevel,
			messages: state.messages,
			createdAt: new Date().toISOString(),
			lastModified: new Date().toISOString(),
		};

		const metadata = {
			id: currentSessionId,
			title: currentTitle,
			createdAt: sessionData.createdAt,
			lastModified: sessionData.lastModified,
			messageCount: state.messages.length,
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			modelId: state.model?.id || null,
			thinkingLevel: state.thinkingLevel,
			preview: generateTitle(state.messages),
		};

		await storage.sessions.save(sessionData, metadata);
	} catch (err) {
		console.error("Failed to save session:", err);
	}
};

const updateUrl = (sessionId: string) => {
	const url = new URL(window.location.href);
	url.searchParams.set("session", sessionId);
	window.history.replaceState({}, "", url);
};

const createAgent = async () => {
	if (agentUnsubscribe) {
		agentUnsubscribe();
	}

	agent = new RpcAgent(WS_URL);
	await agent.connect();

	agentUnsubscribe = agent.subscribe((event: any) => {
		if (event.type === "agent_end" || event.type === "message_end" || event.type === "agent_start") {
			const messages = agent.state.messages;
			if (!currentTitle && shouldSaveSession(messages)) {
				currentTitle = generateTitle(messages);
			}
			if (!currentSessionId && shouldSaveSession(messages)) {
				currentSessionId = crypto.randomUUID();
				updateUrl(currentSessionId);
			}
			if (currentSessionId) {
				saveSession();
			}
			if (currentTitle !== prevTitle) {
				prevTitle = currentTitle;
				renderApp();
			}
		}
	});

	await chatPanel.setAgent(agent as any, {
		// RPC 에이전트가 서버 측에서 API 키를 관리하므로 항상 통과
		onApiKeyRequired: async () => true,
		toolsFactory: () => [],
	});
};

const loadSession = async (_sessionId: string): Promise<boolean> => {
	return false;
};

const newSession = () => {
	const url = new URL(window.location.href);
	url.search = "";
	window.location.href = url.toString();
};

// ============================================================================
// RENDER
// ============================================================================
const renderApp = () => {
	const app = document.getElementById("app");
	if (!app) return;

	const appHtml = html`
    <div
      class="w-full h-screen flex flex-col bg-background text-foreground overflow-hidden"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between border-b border-border shrink-0"
      >
        <div class="flex items-center gap-2 px-4 py-1">
          ${Button({
					variant: "ghost",
					size: "sm",
					children: icon(History, "sm"),
					onClick: () => {
						SessionListDialog.open(
							async (sessionId) => {
								await loadSession(sessionId);
							},
							(deletedSessionId) => {
								if (deletedSessionId === currentSessionId) {
									newSession();
								}
							},
						);
					},
					title: "Sessions",
				})}
          ${Button({
					variant: "ghost",
					size: "sm",
					children: icon(Plus, "sm"),
					onClick: newSession,
					title: "New Session",
				})}
          ${
					currentTitle
						? isEditingTitle
							? html`<div class="flex items-center gap-2">
                  ${Input({
							type: "text",
							value: currentTitle,
							className: "text-sm w-64",
							onChange: async (e: Event) => {
								const newTitle = (e.target as HTMLInputElement).value.trim();
								if (newTitle && newTitle !== currentTitle && storage.sessions && currentSessionId) {
									await storage.sessions.updateTitle(currentSessionId, newTitle);
									currentTitle = newTitle;
								}
								isEditingTitle = false;
								renderApp();
							},
							onKeyDown: async (e: KeyboardEvent) => {
								if (e.key === "Enter") {
									const newTitle = (e.target as HTMLInputElement).value.trim();
									if (newTitle && newTitle !== currentTitle && storage.sessions && currentSessionId) {
										await storage.sessions.updateTitle(currentSessionId, newTitle);
										currentTitle = newTitle;
									}
									isEditingTitle = false;
									renderApp();
								} else if (e.key === "Escape") {
									isEditingTitle = false;
									renderApp();
								}
							},
						})}
                </div>`
							: html`<button
                  class="px-2 py-1 text-sm text-foreground hover:bg-secondary rounded transition-colors"
                  @click=${() => {
							isEditingTitle = true;
							renderApp();
							requestAnimationFrame(() => {
								const input = app?.querySelector('input[type="text"]') as HTMLInputElement;
								if (input) {
									input.focus();
									input.select();
								}
							});
						}}
                  title="Click to edit title"
                >
                  ${currentTitle}
                </button>`
						: html`<span class="text-base font-semibold text-foreground"
                >Han AI Orchestrator</span
              >`
				}
        </div>
        <div class="flex items-center gap-1 px-2">
          <theme-toggle></theme-toggle>
          ${Button({
					variant: "ghost",
					size: "sm",
					children: icon(Settings, "sm"),
					onClick: () => {
							const mcpTab = new McpSettingsTab();
							mcpTab.setAgent(agent);
							SettingsDialog.open([new ProvidersModelsTab(), new ProxyTab(), mcpTab]);
						},
					title: "Settings",
				})}
        </div>
      </div>

      <!-- Chat Panel -->
      ${chatPanel}
    </div>
  `;

	render(appHtml, app);
};

// ============================================================================
// INIT
// ============================================================================
async function initApp() {
	const app = document.getElementById("app");
	if (!app) throw new Error("App container not found");

	render(
		html`
      <div
        class="w-full h-screen flex items-center justify-center bg-background text-foreground"
      >
        <div class="text-muted-foreground">Loading...</div>
      </div>
    `,
		app,
	);

	chatPanel = new ChatPanel();

	const urlParams = new URLSearchParams(window.location.search);
	const sessionIdFromUrl = urlParams.get("session");

	if (sessionIdFromUrl) {
		const loaded = await loadSession(sessionIdFromUrl);
		if (!loaded) {
			newSession();
			return;
		}
	} else {
		await createAgent();
	}

	renderApp();
}

initApp();
