---
name: han-comment
description: Jira 이슈에 작업 완료 요약 코멘트를 작성한다. 커밋 목록·변경 파일 통계·MR URL 등을 종합하여 마크다운으로 등록한다. 독립 단독 실행 지원. "코멘트", "코멘트 달아줘", "코멘트 작성", "Jira 코멘트", "작업 요약", "comment", "이슈에 코멘트" 등에 반응한다.
user_invocable: true
argument: "[ISSUE_KEY] — 예: 'AIAGENT-123'. 생략 시 세션 컨텍스트 또는 현재 브랜치명에서 자동 추출한다."
---

# Jira 작업 완료 코멘트

`mcp__atlassian__addCommentToJiraIssue`를 통해 마크다운 형식으로 Jira에 직접 등록한다.

---

## 입력 정보 수집

3단계 우선순위로 `ISSUE_KEY`를 결정한 후, 나머지 필드를 수집한다.

### ISSUE_KEY 결정

1. **인자 우선** — `/han-common:han-comment AIAGENT-123`
2. **세션 컨텍스트** — `.han/state/sessions/{SESSION_ID}.json`에서 추출
3. **브랜치명 추론** — 현재 브랜치에서 `[A-Z][A-Z0-9]+-\d+` 패턴 추출. 실패 시 `AskUserQuestion`으로 입력

### 나머지 필드 수집

| 필드 | 출처 |
|------|------|
| `ISSUE_TITLE` | 세션 컨텍스트 또는 Atlassian MCP get-issue |
| `BRANCH_NAME` | 세션 컨텍스트 또는 `git branch --show-current` |
| `COMMIT_SHA` | 세션 컨텍스트 또는 `git rev-parse --short HEAD` |
| `MR_URL` | 세션 컨텍스트 (없으면 "미생성") |
| `display` | 세션 컨텍스트의 worklog 시간 (없으면 생략) |
| 커밋 목록 | `git log --oneline origin/$DEFAULT_BRANCH..HEAD` |
| 변경 파일 통계 | `git diff --stat origin/$DEFAULT_BRANCH..HEAD` |

---

## 코멘트 형식

> **heading 규칙**: `#` `##` 절대 금지. 섹션 구분은 `###`만 사용. 인라인 강조는 `**bold**`.

```
### 작업 완료 요약
- 브랜치: {BRANCH_NAME}
- 커밋: {COMMIT_SHA}
- MR: {MR_URL} 또는 "미생성"
- 작업 시간: {display}  ← worklog 없으면 이 줄 생략

### 변경 내용
- {커밋 메시지 + diff stat 기반 요약 3~5줄}

### 변경 파일
- {파일1} (+{추가} -{삭제})
- {파일2} (+{추가} -{삭제})
```

---

## 실행

위 형식으로 Markdown 본문을 작성한 후 MCP로 직접 등록:

```
→ mcp__atlassian__addCommentToJiraIssue 호출
  - cloudId: API_BASE에서 호스트 추출 (예: hancom.atlassian.net)
  - issueIdOrKey: {ISSUE_KEY}
  - commentBody: {MARKDOWN_BODY}
  - contentFormat: "markdown"
```

실패 시: 경고 출력 후 호출자에게 제어 반환 (best-effort).
