/*
 * Copyright 2026 Hancom Inc. All rights reserved.
 *
 * https://www.hancom.com/
 */

/**
 * han-ax Extension — 한컴 AI 개발 하네스 (pi-mono 기반)
 *
 * 도구: han_jira (Jira REST API)
 * 훅: secret-guard, close-guard, 자연어 트리거
 * 상태: 세션 상태 관리 (appendEntry + 파일)
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { StringEnum, Type } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// --- Config Types ---

interface HanConfig {
	atlassianBaseUrl: string;
	gitlabBaseUrl: string;
	defaultBranch: string;
	userName: string;
	userDept: string;
	userEmail: string;
	devMode: string;
}

interface HanSessionState {
	issueKey: string | null;
	issueTitle: string | null;
	issueType: string | null;
	projectKey: string | null;
	branchName: string | null;
	stage: "idle" | "pre_done" | "code_done" | "close_done" | "security_blocked";
	startTime: string | null;
}

// --- Config Parser ---

function parseHanConfig(): HanConfig | null {
	const configPath = join(homedir(), ".config", "han", "han-config.md");
	if (!existsSync(configPath)) return null;

	const content = readFileSync(configPath, "utf-8");

	const extractValue = (section: string, key: string): string => {
		const sectionRegex = new RegExp(`## ${section}[\\s\\S]*?\\|[^|]*\\|[^|]*\\|([\\s\\S]*?)(?=##|$)`);
		const sectionMatch = content.match(sectionRegex);
		if (!sectionMatch) return "";

		const rowRegex = new RegExp(`\\|\\s*${key}\\s*\\|\\s*([^|]+)\\s*\\|`);
		const rowMatch = sectionMatch[0].match(rowRegex);
		return rowMatch ? rowMatch[1].trim() : "";
	};

	return {
		atlassianBaseUrl: extractValue("Atlassian", "Base URL"),
		gitlabBaseUrl: extractValue("GitLab", "Base URL"),
		defaultBranch: extractValue("GitLab", "기본 브랜치") || "main",
		userName: extractValue("개인 정보", "이름"),
		userDept: extractValue("개인 정보", "부서"),
		userEmail: extractValue("개인 정보", "이메일"),
		devMode: extractValue("기본 설정", "개발 모드") || "manual",
	};
}

// --- Jira REST API Helper ---

async function jiraFetch(
	config: HanConfig,
	path: string,
	options: RequestInit = {},
	signal?: AbortSignal,
): Promise<Response> {
	const user = process.env.JIRA_USER || config.userEmail;
	const token = process.env.JIRA_TOKEN || "";
	const auth = Buffer.from(`${user}:${token}`).toString("base64");

	return fetch(`${config.atlassianBaseUrl}${path}`, {
		...options,
		signal,
		headers: {
			Authorization: `Basic ${auth}`,
			"Content-Type": "application/json",
			Accept: "application/json",
			...options.headers,
		},
	});
}

// --- Extension Entry ---

export default function hanAxExtension(pi: ExtensionAPI) {
	let sessionState: HanSessionState = {
		issueKey: null,
		issueTitle: null,
		issueType: null,
		projectKey: null,
		branchName: null,
		stage: "idle",
		startTime: null,
	};

	// --- State Management ---

	function persistState() {
		pi.appendEntry("han-state", { ...sessionState });
	}

	function restoreState(ctx: { sessionManager: { getBranch(): any[] } }) {
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "custom" && entry.customType === "han-state") {
				const data = entry.data as HanSessionState | undefined;
				if (data) sessionState = { ...data };
			}
		}
	}

	// --- Tool: han_jira ---

	pi.registerTool({
		name: "han_jira",
		label: "Jira",
		description:
			"Jira REST API 도구. 이슈 조회, 상태 전환, 워크로그 기록, 코멘트 추가, 할당된 이슈 목록 조회 등을 수행한다.",
		promptSnippet: "han_jira: Jira 이슈 조회/전환/워크로그/코멘트",
		parameters: Type.Object({
			action: StringEnum(
				["get-issue", "list-my-issues", "get-transitions", "transition", "add-worklog", "add-comment", "create-issue"] as const,
				{ description: "수행할 Jira 작업" },
			),
			issue_key: Type.Optional(Type.String({ description: "Jira 이슈 키 (예: AIAGENT-123)" })),
			transition_name: Type.Optional(Type.String({ description: "전환할 상태 이름 (예: In Progress, To Do)" })),
			worklog_seconds: Type.Optional(Type.Number({ description: "워크로그 시간 (초)" })),
			worklog_started: Type.Optional(Type.String({ description: "워크로그 시작 시각 (ISO 8601)" })),
			comment_body: Type.Optional(Type.String({ description: "코멘트 내용" })),
			project_key: Type.Optional(Type.String({ description: "프로젝트 키" })),
			jql: Type.Optional(Type.String({ description: "JQL 쿼리 (list-my-issues 시 커스텀 필터)" })),
			issue_type: Type.Optional(Type.String({ description: "이슈 타입 (create-issue 시: Task, Bug, Story, Epic)" })),
			summary: Type.Optional(Type.String({ description: "이슈 제목 (create-issue 시)" })),
			description: Type.Optional(Type.String({ description: "이슈 설명 (create-issue 시, 마크다운)" })),
			parent_key: Type.Optional(Type.String({ description: "상위 이슈 키 (create-issue 시, Epic 또는 부모 Task)" })),
		}),

		async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
			const config = parseHanConfig();
			if (!config) {
				return {
					content: [
						{
							type: "text" as const,
							text: "han-config.md가 없습니다. ~/.config/han/han-config.md 를 생성하세요.",
						},
					],
					details: { error: "config_missing" },
				};
			}

			const jiraUser = process.env.JIRA_USER || config.userEmail;
			if (!jiraUser || !process.env.JIRA_TOKEN) {
				return {
					content: [
						{
							type: "text" as const,
							text: "JIRA_USER 또는 JIRA_TOKEN 환경변수가 설정되지 않았습니다.\nexport JIRA_USER=your@email.com\nexport JIRA_TOKEN=your-api-token",
						},
					],
					details: { error: "auth_missing" },
				};
			}

			try {
				switch (params.action) {
					case "get-issue": {
						if (!params.issue_key) {
							return {
								content: [{ type: "text" as const, text: "issue_key가 필요합니다." }],
								details: { error: "missing_param" },
							};
						}
						const res = await jiraFetch(config, `/rest/api/3/issue/${params.issue_key}`, {}, signal);
						if (!res.ok) {
							return {
								content: [
									{ type: "text" as const, text: `Jira API 오류: ${res.status} ${res.statusText}` },
								],
								details: { error: "api_error", status: res.status },
							};
						}
						const issue = (await res.json()) as any;
						const summary = {
							key: issue.key,
							summary: issue.fields?.summary,
							status: issue.fields?.status?.name,
							issuetype: issue.fields?.issuetype?.name,
							assignee: issue.fields?.assignee?.displayName,
							priority: issue.fields?.priority?.name,
							description:
								issue.fields?.description?.content
									?.map((block: any) =>
										block.content?.map((c: any) => c.text).join(""),
									)
									.join("\n") || "(설명 없음)",
						};
						return {
							content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
							details: summary,
						};
					}

					case "list-my-issues": {
						const jql =
							params.jql ||
							`assignee = currentUser() AND status NOT IN (Done, Resolved, Closed) ORDER BY updated DESC`;
						const res = await jiraFetch(
							config,
							`/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=20&fields=key,summary,status,issuetype,priority`,
							{},
							signal,
						);
						if (!res.ok) {
							return {
								content: [
									{ type: "text" as const, text: `Jira API 오류: ${res.status} ${res.statusText}` },
								],
								details: { error: "api_error", status: res.status },
							};
						}
						const data = (await res.json()) as any;
						const issues = data.issues?.map((i: any) => ({
							key: i.key,
							summary: i.fields?.summary,
							status: i.fields?.status?.name,
							type: i.fields?.issuetype?.name,
						}));
						return {
							content: [{ type: "text" as const, text: JSON.stringify(issues, null, 2) }],
							details: { issues, total: data.total },
						};
					}

					case "get-transitions": {
						if (!params.issue_key) {
							return {
								content: [{ type: "text" as const, text: "issue_key가 필요합니다." }],
								details: { error: "missing_param" },
							};
						}
						const res = await jiraFetch(
							config,
							`/rest/api/3/issue/${params.issue_key}/transitions`,
							{},
							signal,
						);
						if (!res.ok) {
							return {
								content: [
									{ type: "text" as const, text: `Jira API 오류: ${res.status} ${res.statusText}` },
								],
								details: { error: "api_error", status: res.status },
							};
						}
						const data = (await res.json()) as any;
						const transitions = data.transitions?.map((t: any) => ({
							id: t.id,
							name: t.name,
							to: t.to?.name,
						}));
						return {
							content: [{ type: "text" as const, text: JSON.stringify(transitions, null, 2) }],
							details: { transitions },
						};
					}

					case "transition": {
						if (!params.issue_key || !params.transition_name) {
							return {
								content: [
									{ type: "text" as const, text: "issue_key와 transition_name이 필요합니다." },
								],
								details: { error: "missing_param" },
							};
						}
						// First get available transitions to find the ID
						const transRes = await jiraFetch(
							config,
							`/rest/api/3/issue/${params.issue_key}/transitions`,
							{},
							signal,
						);
						const transData = (await transRes.json()) as any;
						const target = transData.transitions?.find(
							(t: any) =>
								t.name === params.transition_name ||
								t.to?.name === params.transition_name,
						);
						if (!target) {
							const available = transData.transitions
								?.map((t: any) => `${t.name} → ${t.to?.name}`)
								.join(", ");
							return {
								content: [
									{
										type: "text" as const,
										text: `"${params.transition_name}" 전환을 찾을 수 없습니다. 가능한 전환: ${available}`,
									},
								],
								details: { error: "transition_not_found", available: transData.transitions },
							};
						}
						const res = await jiraFetch(
							config,
							`/rest/api/3/issue/${params.issue_key}/transitions`,
							{
								method: "POST",
								body: JSON.stringify({ transition: { id: target.id } }),
							},
							signal,
						);
						if (!res.ok) {
							const errBody = await res.text();
							return {
								content: [
									{ type: "text" as const, text: `전환 실패: ${res.status} ${errBody}` },
								],
								details: { error: "transition_failed", status: res.status },
							};
						}
						return {
							content: [
								{
									type: "text" as const,
									text: `상태 전환 완료: ${params.issue_key} → ${target.to?.name || target.name}`,
								},
							],
							details: { transitioned_to: target.to?.name || target.name },
						};
					}

					case "add-worklog": {
						if (!params.issue_key || !params.worklog_seconds) {
							return {
								content: [
									{ type: "text" as const, text: "issue_key와 worklog_seconds가 필요합니다." },
								],
								details: { error: "missing_param" },
							};
						}
						const body: any = { timeSpentSeconds: params.worklog_seconds };
						if (params.worklog_started) body.started = params.worklog_started;
						const res = await jiraFetch(
							config,
							`/rest/api/3/issue/${params.issue_key}/worklog`,
							{ method: "POST", body: JSON.stringify(body) },
							signal,
						);
						if (!res.ok) {
							const errBody = await res.text();
							return {
								content: [
									{ type: "text" as const, text: `Worklog 기록 실패: ${res.status} ${errBody}` },
								],
								details: { error: "worklog_failed", status: res.status },
							};
						}
						const minutes = Math.round(params.worklog_seconds / 60);
						return {
							content: [
								{
									type: "text" as const,
									text: `Worklog 기록 완료: ${params.issue_key} (${minutes}분)`,
								},
							],
							details: { recorded_seconds: params.worklog_seconds },
						};
					}

					case "add-comment": {
						if (!params.issue_key || !params.comment_body) {
							return {
								content: [
									{ type: "text" as const, text: "issue_key와 comment_body가 필요합니다." },
								],
								details: { error: "missing_param" },
							};
						}
						const adfBody = {
							body: {
								version: 1,
								type: "doc",
								content: [
									{
										type: "paragraph",
										content: [{ type: "text", text: params.comment_body }],
									},
								],
							},
						};
						const res = await jiraFetch(
							config,
							`/rest/api/3/issue/${params.issue_key}/comment`,
							{ method: "POST", body: JSON.stringify(adfBody) },
							signal,
						);
						if (!res.ok) {
							const errBody = await res.text();
							return {
								content: [
									{ type: "text" as const, text: `코멘트 추가 실패: ${res.status} ${errBody}` },
								],
								details: { error: "comment_failed", status: res.status },
							};
						}
						return {
							content: [
								{ type: "text" as const, text: `코멘트 추가 완료: ${params.issue_key}` },
							],
							details: { issue_key: params.issue_key },
						};
					}

					case "create-issue": {
						if (!params.project_key || !params.summary || !params.issue_type) {
							return {
								content: [
									{ type: "text" as const, text: "project_key, summary, issue_type이 필요합니다." },
								],
								details: { error: "missing_param" },
							};
						}
						const issueBody: any = {
							fields: {
								project: { key: params.project_key },
								summary: params.summary,
								issuetype: { name: params.issue_type },
							},
						};
						if (params.description) {
							issueBody.fields.description = {
								version: 1,
								type: "doc",
								content: [
									{
										type: "paragraph",
										content: [{ type: "text", text: params.description }],
									},
								],
							};
						}
						if (params.parent_key) {
							issueBody.fields.parent = { key: params.parent_key };
						}
						const res = await jiraFetch(
							config,
							"/rest/api/3/issue",
							{ method: "POST", body: JSON.stringify(issueBody) },
							signal,
						);
						if (!res.ok) {
							const errBody = await res.text();
							return {
								content: [
									{ type: "text" as const, text: `이슈 생성 실패: ${res.status} ${errBody}` },
								],
								details: { error: "create_failed", status: res.status },
							};
						}
						const created = (await res.json()) as any;
						return {
							content: [
								{
									type: "text" as const,
									text: `이슈 생성 완료: ${created.key} (${params.issue_type}: ${params.summary})`,
								},
							],
							details: { key: created.key, self: created.self },
						};
					}

					default:
						return {
							content: [{ type: "text" as const, text: `알 수 없는 action: ${params.action}` }],
							details: { error: "unknown_action" },
						};
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					content: [{ type: "text" as const, text: `Jira API 호출 오류: ${message}` }],
					details: { error: "fetch_error", message },
				};
			}
		},
	});

	// --- Commands ---

	pi.registerCommand("han-status", {
		description: "현재 han-ax 워크플로우 상태 표시",
		handler: async (_args, ctx) => {
			const config = parseHanConfig();
			const lines = [
				`이슈: ${sessionState.issueKey ?? "(없음)"}`,
				`단계: ${sessionState.stage}`,
				`브랜치: ${sessionState.branchName ?? "(없음)"}`,
				`시작: ${sessionState.startTime ?? "(없음)"}`,
				`Atlassian: ${config?.atlassianBaseUrl ?? "(미설정)"}`,
				`GitLab: ${config?.gitlabBaseUrl ?? "(미설정)"}`,
			];
			ctx.ui.notify(`[han-ax]\n${lines.join("\n")}`, "info");
		},
	});

	pi.registerCommand("han-config", {
		description: "han-ax 설정 확인",
		handler: async (_args, ctx) => {
			const config = parseHanConfig();
			if (!config) {
				ctx.ui.notify("[han-ax] ~/.config/han/han-config.md 파일이 없습니다.", "warning");
				return;
			}
			const lines = [
				`Atlassian: ${config.atlassianBaseUrl}`,
				`GitLab: ${config.gitlabBaseUrl}`,
				`기본 브랜치: ${config.defaultBranch}`,
				`이름: ${config.userName}`,
				`부서: ${config.userDept}`,
				`이메일: ${config.userEmail}`,
				`개발 모드: ${config.devMode}`,
				`JIRA_USER: ${process.env.JIRA_USER ? "설정됨" : "미설정"}`,
				`JIRA_TOKEN: ${process.env.JIRA_TOKEN ? "설정됨" : "미설정"}`,
			];
			ctx.ui.notify(`[han-ax config]\n${lines.join("\n")}`, "info");
		},
	});

	// --- Event: State Restore ---

	pi.on("session_start", async (_event, ctx) => {
		restoreState(ctx);
		if (sessionState.issueKey) {
			ctx.ui.setStatus("han-ax", `${sessionState.issueKey} [${sessionState.stage}]`);
		}
	});

	pi.on("session_tree", async (_event, ctx) => {
		restoreState(ctx);
	});

	// --- Event: Status Display ---

	pi.on("turn_end", async (_event, ctx) => {
		if (sessionState.issueKey) {
			ctx.ui.setStatus("han-ax", `${sessionState.issueKey} [${sessionState.stage}]`);
		}
	});

	// --- Event: Secret Guard ---

	pi.on("tool_call", async (event, _ctx) => {
		if (event.toolName !== "bash") return;

		const command = (event.input as any)?.command as string | undefined;
		if (!command) return;

		const secretPatterns = [
			/JIRA_TOKEN\s*=/,
			/JIRA_USER\s*=.*@/,
			/api[_-]?token/i,
			/password\s*=/i,
			/secret\s*=/i,
		];

		for (const pattern of secretPatterns) {
			if (pattern.test(command)) {
				return { block: true, reason: "[han-ax secret-guard] 시크릿이 포함된 명령은 실행할 수 없습니다." };
			}
		}
	});

	// --- Event: Natural Language Triggers ---

	pi.on("input", async (event, _ctx) => {
		if (event.source === "extension") {
			return { action: "continue" };
		}

		const text = event.text.trim();

		// "개발 시작 AIAGENT-123" → subagent chain 트리거
		const startMatch = text.match(/^(?:개발\s*시작|작업\s*시작|이슈\s*시작)\s+(\S+)/);
		if (startMatch) {
			return {
				action: "transform",
				text: `이슈 ${startMatch[1]}에 대한 개발을 시작합니다. 먼저 han_jira 도구로 이슈를 조회하고, 개발 컨텍스트를 초기화한 뒤 To Do 상태로 전환해주세요.`,
			};
		}

		// "완료" / "마무리" → close 워크플로우
		if (/^(?:완료|마무리|close|PR)$/i.test(text) && sessionState.issueKey) {
			return {
				action: "transform",
				text: `이슈 ${sessionState.issueKey}의 마무리 작업을 수행합니다. 변경사항을 커밋하고, MR을 생성하고, Jira Worklog와 상태를 업데이트해주세요.`,
			};
		}

		return { action: "continue" };
	});
}
