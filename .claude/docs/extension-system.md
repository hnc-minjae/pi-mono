# Extension System Reference

## 개요

코딩 에이전트(pi)의 확장 시스템. 도구, 커맨드, 훅, 위젯을 플러그인 방식으로 등록한다.

## 로딩 흐름

```
discoverAndLoadExtensions()
  ↓
1. .pi/extensions/ (프로젝트 로컬)
2. {agentDir}/extensions/ (글로벌)
3. 설정된 추가 경로 (중복 제거)
  ↓
각 경로: loadExtension()
  ↓
  resolvePath() → loadExtensionModule() (jiti 사용)
  → createExtension() → createExtensionAPI()
  → factory(api) (확장 팩토리 호출)
```

**진입점 탐색 순서**: `package.json("pi.extensions")` → `index.ts` → `index.js`

**가상 모듈** (번들 모드에서 자동 해결):
- `@sinclair/typebox`, `@mariozechner/pi-agent-core`, `@mariozechner/pi-tui`
- `@mariozechner/pi-ai`, `@mariozechner/pi-ai/oauth`, `@mariozechner/pi-coding-agent`

## ExtensionAPI 주요 메서드

### 이벤트 구독

```typescript
pi.on(event, handler)
```

**리소스**: `resources_discover`
**세션**: `session_start`, `session_switch`, `session_fork`, `session_compact`, `session_tree`, `session_shutdown`, `session_directory`, `session_before_switch/fork/compact/tree`
**에이전트**: `context`, `before_provider_request`, `before_agent_start`, `agent_start`, `agent_end`, `turn_start`, `turn_end`
**메시지**: `message_start`, `message_update`, `message_end`
**도구**: `tool_execution_start/update/end`, `tool_call` (차단 가능), `tool_result` (수정 가능)
**모델**: `model_select`
**사용자**: `input` (변환 가능), `user_bash`

### 도구 등록

```typescript
pi.registerTool({
	name: string,
	label: string,
	description: string,
	promptSnippet?: string,      // "Available tools" 섹션에 삽입
	promptGuidelines?: string[], // 시스템 프롬프트에 bullet 추가
	parameters: TypeBox_Schema,
	execute(toolCallId, params, signal, onUpdate, ctx) → Promise<AgentToolResult>,
	renderCall?: (args, theme, context) → Component,
	renderResult?: (result, options, theme, context) → Component,
})
```

### 커맨드/단축키/플래그

```typescript
pi.registerCommand(name, { description, handler })
pi.registerShortcut(shortcut, { description?, handler })
pi.registerFlag(name, { type: "boolean"|"string", default? })
pi.getFlag(name)
```

### 메시지/상태

```typescript
pi.sendMessage({ customType, data }, { triggerTurn?, deliverAs? })
pi.sendUserMessage(content, options?)
pi.appendEntry(customType, data?)     // 세션에 커스텀 엔트리 저장
pi.setSessionName(name)
```

### 프로바이더

```typescript
pi.registerProvider(name, { baseUrl, apiKey, api, models, oauth? })
pi.unregisterProvider(name)
```

## 이벤트 핸들러 체이닝

| 패턴 | 이벤트 | 동작 |
|------|--------|------|
| 변환 체인 | `input` | text/images를 핸들러 순서대로 변형 |
| 캡처 체인 | `tool_result` | content/details/isError 수정 |
| 차단 우선 | `tool_call` | 첫 번째 차단이 실행 방지 |
| 누적 | `before_agent_start` | messages + systemPrompt 합산 |

## 컨텍스트

**ExtensionContext** (모든 핸들러):
- `ui`, `hasUI`, `cwd`, `sessionManager`, `modelRegistry`, `model`
- `isIdle()`, `signal`, `abort()`, `hasPendingMessages()`, `shutdown()`
- `getContextUsage()`, `compact()`, `getSystemPrompt()`

**ExtensionCommandContext** (커맨드 전용, Context 확장):
- `waitForIdle()`, `newSession()`, `fork()`, `navigateTree()`, `switchSession()`, `reload()`

**ExtensionUIContext** (UI 작업):
- 다이얼로그: `select()`, `confirm()`, `input()`, `notify()`
- 에디터: `pasteToEditor()`, `setEditorText()`, `getEditorText()`, `editor()`
- 위젯: `setWidget()`, `setFooter()`, `setHeader()`, `custom()`
- 테마: `theme`, `getAllThemes()`, `setTheme()`

## 현재 확장 목록

### han-ax/ — 한컴 개발 하네스

- **도구**: `han_jira` — Jira REST API (get-issue, list-my-issues, get-transitions, transition, add-worklog, add-comment, create-issue)
- **커맨드**: `/han-status` (워크플로우 상태), `/han-config` (설정 표시)
- **훅**: session_start/tree (상태 복원), turn_end (상태 표시 갱신), tool_call:bash (시크릿 가드), input (자연어 트리거)
- **상태**: `HanSessionState` (issueKey, issueTitle, issueType, projectKey, branchName, stage, startTime)
- **설정**: `~/.config/han/han-config.md` (atlassianBaseUrl, gitlabBaseUrl, defaultBranch, userName 등)
- **인증**: `JIRA_USER` + `JIRA_TOKEN` 환경변수

### mcp-bridge/ — MCP 서버 브릿지

- 상세: `.claude/docs/mcp-system.md` 참조

### files.ts — 세션 파일 목록

- **커맨드**: `/files` — 세션에서 read/write/edit한 파일 목록, VS Code에서 열기

### diff.ts — Git 변경 보기

- **커맨드**: `/diff` — git status + VS Code diff view

### tps.ts — 토큰 처리량

- **훅**: `agent_end` — TPS, 입출력 토큰, 캐시, 총 토큰, 경과 시간 표시

### redraws.ts — TUI 리드로우

- **커맨드**: `/tui` — TUI 리드로우 통계

### prompt-url-widget.ts — GitHub URL 위젯

- **훅**: `before_agent_start` — PR/Issue URL 감지 → 메타데이터 표시

### subagent/ — 서브에이전트 관리

- 개발 참조용 심링크

## 스킬 (.pi/skills/)

확장과 다른 시스템. SKILL.md 파일로 정의, 슬래시 커맨드로 호출.

**포맷**:
```yaml
---
name: skill-id
description: 한줄 설명
user_invocable: true/false
argument: "[PARAM] — description"
---
# 마크다운 프롬프트
```

**개발 스킬**: han-dev (전체 워크플로우), han-start (1단계), han-code (2단계), han-close (3단계), han-branch, han-tdd, han-analyze, han-security, han-code-review, han-mr, han-comment
**이슈 스킬**: han-issue-check, han-issue-create, han-issue-list
**문서 스킬**: han-doc-plan, han-doc-memo, han-doc-draft, han-doc-report, han-doc-report-gen, han-doc-greeting, han-doc-solution, han-doc-reflection
**기타**: han-atlassian, han-dev-setup

## 에이전트 (.pi/agents/)

마크다운 파일로 정의. Agent 도구로 독립 컨텍스트에서 실행.

```yaml
---
name: agent-id
description: 설명
model: claude-sonnet-4-6
---
<Agent_Prompt>...</Agent_Prompt>
```

| 에이전트 | 역할 |
|---------|------|
| start-agent | Jira 이슈 파악 (1단계) |
| code-agent | 코드 개발 래퍼 (2단계) |
| close-agent | 마무리 (3단계) |
| han-reviewer | 코드 리뷰 |
| cpp-expert | C++ 전문 |
| hwp-expert | HWP 문서 전문 |

## 프롬프트 (.pi/prompts/)

재사용 프롬프트 템플릿: context.md (환경 컨텍스트), han-dev.md (3단계 하네스 가이드) 등
