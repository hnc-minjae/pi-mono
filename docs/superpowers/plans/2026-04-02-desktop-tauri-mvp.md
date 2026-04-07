# Desktop Tauri v2 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 web-ui를 Tauri v2로 래핑하여 로컬 파일 접근이 가능한 데스크탑 에이전트 앱을 만든다.

**Architecture:** Tauri v2 WebView가 web-ui 프론트엔드를 호스팅하고, Rust 백엔드는 파일 다이얼로그/읽기/쓰기만 담당한다. LLM 호출과 에이전트 로직은 모두 WebView 측 JavaScript에서 실행된다.

**Tech Stack:** Tauri v2, Vite 7, Lit 3, Tailwind CSS v4, @mariozechner/pi-web-ui, Rust 2021 edition

**Spec:** `docs/superpowers/specs/2026-04-02-desktop-tauri-mvp-design.md`

---

## File Structure

```
packages/desktop/
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs              # Tauri Builder 설정, 커맨드 등록
│   │   └── main.rs             # 진입점 (lib::run 호출)
│   ├── capabilities/
│   │   └── default.json        # Tauri v2 권한 설정
│   ├── Cargo.toml              # Rust 의존성
│   └── tauri.conf.json         # Tauri 앱 설정
├── src/
│   ├── main.ts                 # 앱 진입점 (web-ui example 기반)
│   ├── tauri-bridge.ts         # Tauri API 래퍼 (파일 다이얼로그, 읽기/쓰기)
│   ├── custom-messages.ts      # 커스텀 메시지 타입 (example에서 복사)
│   └── app.css                 # Tailwind 진입 CSS
├── index.html                  # SPA 진입 HTML
├── package.json                # Node 의존성, 스크립트
├── vite.config.ts              # Vite 설정 (Tauri 호환)
└── tsconfig.json               # TypeScript 설정
```

---

### Task 1: packages/desktop 스캐폴딩 — package.json, tsconfig, index.html

**Files:**
- Create: `packages/desktop/package.json`
- Create: `packages/desktop/tsconfig.json`
- Create: `packages/desktop/index.html`

- [ ] **Step 1: package.json 생성**

```json
{
  "name": "@anthropics/han-ai-desktop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  },
  "dependencies": {
    "@mariozechner/mini-lit": "^0.2.0",
    "@mariozechner/pi-ai": "file:../ai",
    "@mariozechner/pi-web-ui": "file:../web-ui",
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-dialog": "^2",
    "@tauri-apps/plugin-fs": "^2",
    "lit": "^3.3.1",
    "lucide": "^0.544.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2",
    "@tailwindcss/vite": "^4.1.17",
    "typescript": "^5.7.3",
    "vite": "^7.1.6"
  }
}
```

- [ ] **Step 2: tsconfig.json 생성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "jsx": "preserve",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "experimentalDecorators": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: index.html 생성**

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Han AI Orchestrator</title>
  </head>
  <body class="bg-background">
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 4: 커밋**

```bash
cd packages/desktop
git add package.json tsconfig.json index.html
git commit -m "feat(desktop): scaffold package.json, tsconfig, index.html"
```

---

### Task 2: Vite 설정 — Tauri 호환 vite.config.ts

**Files:**
- Create: `packages/desktop/vite.config.ts`

- [ ] **Step 1: vite.config.ts 생성**

Tauri 공식 문서 기반 설정. `TAURI_DEV_HOST` 환경변수, strictPort, 소스 감시 설정 포함.

```typescript
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
```

- [ ] **Step 2: 커밋**

```bash
git add packages/desktop/vite.config.ts
git commit -m "feat(desktop): add Tauri-compatible vite.config.ts"
```

---

### Task 3: Tauri Rust 백엔드 — Cargo.toml, main.rs, lib.rs

**Files:**
- Create: `packages/desktop/src-tauri/Cargo.toml`
- Create: `packages/desktop/src-tauri/src/main.rs`
- Create: `packages/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Cargo.toml 생성**

```toml
[package]
name = "han-ai-desktop"
version = "0.1.0"
edition = "2021"

[lib]
name = "han_ai_desktop_lib"
crate-type = ["lib", "cdylib", "staticlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **Step 2: build.rs 생성**

Create: `packages/desktop/src-tauri/build.rs`

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 3: main.rs 생성**

```rust
// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    han_ai_desktop_lib::run()
}
```

- [ ] **Step 4: lib.rs 생성**

파일 읽기/쓰기 커맨드 포함. Tauri 플러그인 등록.

```rust
use std::fs;
use std::path::PathBuf;

#[tauri::command]
fn read_file_text(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn read_file_binary(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn write_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    let path = PathBuf::from(&path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    fs::write(&path, &contents).map_err(|e| format!("Failed to write file: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            read_file_text,
            read_file_binary,
            write_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: 커밋**

```bash
git add packages/desktop/src-tauri/
git commit -m "feat(desktop): add Tauri Rust backend with file commands"
```

---

### Task 4: Tauri 설정 — tauri.conf.json, capabilities

**Files:**
- Create: `packages/desktop/src-tauri/tauri.conf.json`
- Create: `packages/desktop/src-tauri/capabilities/default.json`

- [ ] **Step 1: tauri.conf.json 생성**

```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-config-schema/schema.json",
  "productName": "Han AI Orchestrator",
  "version": "0.1.0",
  "identifier": "io.hancom.ai-orchestrator",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "title": "Han AI Orchestrator",
    "windows": [
      {
        "title": "Han AI Orchestrator",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": "default-src 'self'; connect-src 'self' https://api.anthropic.com https://api.openai.com https://*.amazonaws.com https://*.ollama.com http://localhost:*; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

- [ ] **Step 2: capabilities/default.json 생성**

Tauri v2 권한 시스템. 파일 다이얼로그, 파일 읽기/쓰기, 셸 권한 부여.

```json
{
  "$schema": "https://raw.githubusercontent.com/nicegram/nicetauri/main/crates/tauri/schema.json",
  "identifier": "default",
  "description": "Default capabilities for Han AI Desktop",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "dialog:allow-open",
    "dialog:allow-save",
    "dialog:allow-message",
    "dialog:allow-ask",
    "fs:default",
    "fs:allow-read",
    "fs:allow-write",
    "fs:allow-exists",
    "fs:allow-mkdir",
    "shell:allow-open"
  ]
}
```

- [ ] **Step 3: 아이콘 디렉토리 생성 (placeholder)**

```bash
mkdir -p packages/desktop/src-tauri/icons
# Tauri CLI가 기본 아이콘을 생성하므로, 빌드 시 자동 처리됨
```

- [ ] **Step 4: 커밋**

```bash
git add packages/desktop/src-tauri/tauri.conf.json packages/desktop/src-tauri/capabilities/
git commit -m "feat(desktop): add tauri.conf.json and capability permissions"
```

---

### Task 5: 프론트엔드 CSS — app.css

**Files:**
- Create: `packages/desktop/src/app.css`

- [ ] **Step 1: app.css 생성**

```css
@import "tailwindcss";
@import "@mariozechner/mini-lit/dist/themes/default.css";
@import "@mariozechner/pi-web-ui/app.css";

/* Tauri 데스크탑 앱용 스타일 */
body {
  overflow: hidden;
  user-select: none;
}

/* 입력 필드, 코드 블록 등은 텍스트 선택 허용 */
input,
textarea,
pre,
code,
[contenteditable] {
  user-select: text;
}
```

- [ ] **Step 2: 커밋**

```bash
git add packages/desktop/src/app.css
git commit -m "feat(desktop): add Tailwind CSS entry with web-ui theme imports"
```

---

### Task 6: Tauri 브릿지 — tauri-bridge.ts

**Files:**
- Create: `packages/desktop/src/tauri-bridge.ts`

- [ ] **Step 1: tauri-bridge.ts 생성**

Tauri API를 래핑하여 프론트엔드에서 파일 다이얼로그와 파일 I/O를 사용할 수 있게 한다.

```typescript
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

export interface FileFilter {
  name: string;
  extensions: string[];
}

/**
 * 파일 열기 다이얼로그를 표시하고 선택된 파일 경로를 반환한다.
 * 사용자가 취소하면 null을 반환한다.
 */
export async function openFileDialog(options?: {
  filters?: FileFilter[];
  multiple?: boolean;
  title?: string;
}): Promise<string | string[] | null> {
  const result = await open({
    multiple: options?.multiple ?? false,
    title: options?.title ?? "파일 열기",
    filters: options?.filters,
  });
  return result;
}

/**
 * 파일 저장 다이얼로그를 표시하고 선택된 경로를 반환한다.
 */
export async function saveFileDialog(options?: {
  defaultPath?: string;
  filters?: FileFilter[];
  title?: string;
}): Promise<string | null> {
  const result = await save({
    defaultPath: options?.defaultPath,
    title: options?.title ?? "파일 저장",
    filters: options?.filters,
  });
  return result;
}

/**
 * 파일을 텍스트로 읽는다.
 */
export async function readFileText(path: string): Promise<string> {
  return invoke<string>("read_file_text", { path });
}

/**
 * 파일을 바이너리로 읽는다.
 */
export async function readFileBinary(path: string): Promise<Uint8Array> {
  const data = await invoke<number[]>("read_file_binary", { path });
  return new Uint8Array(data);
}

/**
 * 파일에 바이너리 데이터를 쓴다.
 */
export async function writeFile(
  path: string,
  contents: Uint8Array,
): Promise<void> {
  await invoke("write_file", { path, contents: Array.from(contents) });
}

/**
 * 텍스트 파일을 저장한다 (다이얼로그 + 쓰기 결합).
 */
export async function saveTextFile(
  text: string,
  options?: {
    defaultPath?: string;
    filters?: FileFilter[];
  },
): Promise<string | null> {
  const path = await saveFileDialog(options);
  if (!path) return null;
  await writeFile(path, new TextEncoder().encode(text));
  return path;
}

/**
 * Tauri 환경인지 확인한다 (브라우저에서도 동작할 수 있도록).
 */
export function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}
```

- [ ] **Step 2: 커밋**

```bash
git add packages/desktop/src/tauri-bridge.ts
git commit -m "feat(desktop): add Tauri bridge for file dialogs and I/O"
```

---

### Task 7: 커스텀 메시지 — custom-messages.ts

**Files:**
- Create: `packages/desktop/src/custom-messages.ts`

- [ ] **Step 1: web-ui example에서 custom-messages.ts 복사**

```bash
cp packages/web-ui/example/src/custom-messages.ts packages/desktop/src/custom-messages.ts
```

- [ ] **Step 2: 커밋**

```bash
git add packages/desktop/src/custom-messages.ts
git commit -m "feat(desktop): add custom message renderers from web-ui example"
```

---

### Task 8: 메인 앱 — main.ts

**Files:**
- Create: `packages/desktop/src/main.ts`

- [ ] **Step 1: main.ts 생성**

`web-ui/example/src/main.ts`를 기반으로 하되, 앱 이름을 변경하고 Tauri 파일 브릿지를 연동한다.

```typescript
import "@mariozechner/mini-lit/dist/ThemeToggle.js";
import { Agent, type AgentMessage } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import {
  type AgentState,
  ApiKeyPromptDialog,
  AppStorage,
  ChatPanel,
  CustomProvidersStore,
  createJavaScriptReplTool,
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
import { History, Plus, Settings, FolderOpen } from "lucide";
import "./app.css";
import { icon } from "@mariozechner/mini-lit";
import { Button } from "@mariozechner/mini-lit/dist/Button.js";
import { Input } from "@mariozechner/mini-lit/dist/Input.js";
import {
  createSystemNotification,
  customConvertToLlm,
  registerCustomMessageRenderers,
} from "./custom-messages.js";
import { openFileDialog, readFileText, isTauri } from "./tauri-bridge.js";

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

const storage = new AppStorage(
  settings,
  providerKeys,
  sessions,
  customProviders,
  backend,
);
setAppStorage(storage);

let currentSessionId: string | undefined;
let currentTitle = "";
let isEditingTitle = false;
let agent: Agent;
let chatPanel: ChatPanel;
let agentUnsubscribe: (() => void) | undefined;

const generateTitle = (messages: AgentMessage[]): string => {
  const firstUserMsg = messages.find(
    (m) => m.role === "user" || m.role === "user-with-attachments",
  );
  if (
    !firstUserMsg ||
    (firstUserMsg.role !== "user" && firstUserMsg.role !== "user-with-attachments")
  )
    return "";

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
  const hasUserMsg = messages.some(
    (m: any) => m.role === "user" || m.role === "user-with-attachments",
  );
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

const createAgent = async (initialState?: Partial<AgentState>) => {
  if (agentUnsubscribe) {
    agentUnsubscribe();
  }

  agent = new Agent({
    initialState: initialState || {
      systemPrompt: `You are a helpful AI assistant running in Han AI Orchestrator desktop app.

Available tools:
- JavaScript REPL: Execute JavaScript code in a sandboxed browser environment
- Artifacts: Create interactive HTML, SVG, Markdown, and text artifacts

Feel free to use these tools when needed to provide accurate and helpful responses.`,
      model: getModel("anthropic", "claude-sonnet-4-5-20250929"),
      thinkingLevel: "off",
      messages: [],
      tools: [],
    },
    convertToLlm: customConvertToLlm,
  });

  agentUnsubscribe = agent.subscribe((event: any) => {
    if (event.type === "state-update") {
      const messages = event.state.messages;
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
      renderApp();
    }
  });

  await chatPanel.setAgent(agent, {
    onApiKeyRequired: async (provider: string) => {
      return await ApiKeyPromptDialog.prompt(provider);
    },
    toolsFactory: (
      _agent,
      _agentInterface,
      _artifactsPanel,
      runtimeProvidersFactory,
    ) => {
      const replTool = createJavaScriptReplTool();
      replTool.runtimeProvidersFactory = runtimeProvidersFactory;
      return [replTool];
    },
  });
};

const loadSession = async (sessionId: string): Promise<boolean> => {
  if (!storage.sessions) return false;
  const sessionData = await storage.sessions.get(sessionId);
  if (!sessionData) return false;

  currentSessionId = sessionId;
  const metadata = await storage.sessions.getMetadata(sessionId);
  currentTitle = metadata?.title || "";

  await createAgent({
    model: sessionData.model,
    thinkingLevel: sessionData.thinkingLevel,
    messages: sessionData.messages,
    tools: [],
  });

  updateUrl(sessionId);
  renderApp();
  return true;
};

const newSession = () => {
  const url = new URL(window.location.href);
  url.search = "";
  window.location.href = url.toString();
};

/** Tauri 파일 열기 → 내용을 에이전트 메시지로 주입 */
const handleOpenFile = async () => {
  if (!isTauri()) return;

  const path = await openFileDialog({
    title: "파일 열기",
    filters: [
      { name: "텍스트 파일", extensions: ["txt", "md", "json", "csv", "xml", "yaml", "yml"] },
      { name: "코드", extensions: ["ts", "js", "py", "rs", "go", "java", "c", "cpp", "h"] },
      { name: "모든 파일", extensions: ["*"] },
    ],
  });

  if (!path || Array.isArray(path)) return;

  try {
    const content = await readFileText(path);
    const filename = path.split(/[/\\]/).pop() || path;
    agent.steer(
      createSystemNotification(`📄 파일 열림: ${filename} (${content.length} chars)`),
    );
    // 파일 내용을 사용자 메시지로 추가
    agent.steer({
      role: "user",
      content: `다음 파일의 내용을 분석해주세요.\n\n**파일:** ${filename}\n\`\`\`\n${content}\n\`\`\``,
    });
  } catch (err) {
    console.error("Failed to read file:", err);
  }
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
          ${isTauri()
            ? Button({
                variant: "ghost",
                size: "sm",
                children: icon(FolderOpen, "sm"),
                onClick: handleOpenFile,
                title: "파일 열기",
              })
            : ""}
          ${currentTitle
            ? isEditingTitle
              ? html`<div class="flex items-center gap-2">
                  ${Input({
                    type: "text",
                    value: currentTitle,
                    className: "text-sm w-64",
                    onChange: async (e: Event) => {
                      const newTitle = (
                        e.target as HTMLInputElement
                      ).value.trim();
                      if (
                        newTitle &&
                        newTitle !== currentTitle &&
                        storage.sessions &&
                        currentSessionId
                      ) {
                        await storage.sessions.updateTitle(
                          currentSessionId,
                          newTitle,
                        );
                        currentTitle = newTitle;
                      }
                      isEditingTitle = false;
                      renderApp();
                    },
                    onKeyDown: async (e: KeyboardEvent) => {
                      if (e.key === "Enter") {
                        const newTitle = (
                          e.target as HTMLInputElement
                        ).value.trim();
                        if (
                          newTitle &&
                          newTitle !== currentTitle &&
                          storage.sessions &&
                          currentSessionId
                        ) {
                          await storage.sessions.updateTitle(
                            currentSessionId,
                            newTitle,
                          );
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
                      const input = app?.querySelector(
                        'input[type="text"]',
                      ) as HTMLInputElement;
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
              >`}
        </div>
        <div class="flex items-center gap-1 px-2">
          <theme-toggle></theme-toggle>
          ${Button({
            variant: "ghost",
            size: "sm",
            children: icon(Settings, "sm"),
            onClick: () =>
              SettingsDialog.open([new ProvidersModelsTab(), new ProxyTab()]),
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
```

- [ ] **Step 2: 커밋**

```bash
git add packages/desktop/src/main.ts
git commit -m "feat(desktop): add main app entry point with Tauri file integration"
```

---

### Task 9: Rust 빌드 검증

- [ ] **Step 1: Rust 컴파일 확인**

```bash
cd packages/desktop/src-tauri
cargo check
```

Expected: 경고 없이 `Finished` 출력

- [ ] **Step 2: 실패 시 Cargo.toml 의존성 버전 조정**

오류가 나면 `cargo check` 출력을 읽고 의존성 버전을 수정한다.

---

### Task 10: npm install 및 개발 모드 실행

- [ ] **Step 1: 루트 package.json에 desktop 워크스페이스 추가**

`packages/desktop`을 워크스페이스에 포함시킨다. 루트 `package.json`의 `workspaces` 배열에 추가:

기존:
```json
"workspaces": [
  "packages/*",
  ...
]
```

`packages/*` 글로브가 이미 `packages/desktop`을 포함하므로 별도 추가 불필요. npm install만 재실행.

- [ ] **Step 2: npm install**

```bash
cd /home/minjae/dev/local_agent/han-ai-orchestrator
npm install
```

- [ ] **Step 3: Tauri 개발 모드 실행**

```bash
cd packages/desktop
npx tauri dev
```

Expected: Vite 개발 서버 시작 → Rust 컴파일 → 데스크탑 창 표시

- [ ] **Step 4: 기본 동작 확인**
  - 창이 뜨는지 확인
  - 테마 토글이 동작하는지 확인
  - API 키 설정 후 대화가 동작하는지 확인
  - 파일 열기 버튼이 다이얼로그를 표시하는지 확인

- [ ] **Step 5: 커밋**

```bash
git add -A packages/desktop/
git commit -m "feat(desktop): complete Tauri v2 MVP desktop app"
```

---

## Summary

| Task | 내용 | 예상 시간 |
|------|------|----------|
| 1 | 스캐폴딩 (package.json, tsconfig, index.html) | 2분 |
| 2 | Vite 설정 | 2분 |
| 3 | Rust 백엔드 (Cargo.toml, main.rs, lib.rs) | 5분 |
| 4 | Tauri 설정 (tauri.conf.json, capabilities) | 3분 |
| 5 | CSS 진입점 | 1분 |
| 6 | Tauri 브릿지 (tauri-bridge.ts) | 3분 |
| 7 | 커스텀 메시지 (복사) | 1분 |
| 8 | 메인 앱 (main.ts) | 5분 |
| 9 | Rust 빌드 검증 | 3분 |
| 10 | npm install + 개발 모드 실행 | 5분 |
