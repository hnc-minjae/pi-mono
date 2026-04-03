---
name: han-issue-check
description: Jira 이슈 키 또는 URL(hancom.atlassian.net/browse/PROJ-123)로 이슈 정보를 조회하여 구조화하여 표시한다. 독립 단독 실행 지원. "이슈 조회", "이슈 확인", "이슈 보기", "이슈 보여줘", "이슈 알려줘", "이슈 정보", "PROJ-123 확인", "issue check" 등에 반응한다.
user_invocable: true
argument: "{ISSUE_KEY} — 예: AIAGENT-123"
---

# 이슈 파악 워크플로우

이슈 키를 받아 Jira에서 이슈 정보를 조회하고, 개발자가 작업 내용을 한눈에 파악할 수 있도록 구조화하여 출력한다.

---

## Step 0: 환경 설정 로드

`~/.config/han/han-config.md` 읽기:
- 파일 없음 → **"/han-dev:han-dev-setup 을 먼저 실행하세요."** 출력 후 중단

추출 값:

| 변수 | 섹션 | 키 |
|------|------|----|
| `API_BASE` | Atlassian | Base URL |

JIRA_USER, JIRA_TOKEN 환경변수 확인 (미설정 시 "/han-dev:han-dev-setup 을 먼저 실행하세요." 후 중단)

> 인증 테스트 없음 — han-setup에서 1회 처리

---

## Step 1: 이슈 키 확인

인자로 전달된 `ISSUE_KEY` 확인:
- 없음 → **"이슈 키를 입력해 주세요. 예: /han-dev:han-issue-check AIAGENT-123"** 후 중단

---

## Step 2: 이슈 조회

→ `mcp__atlassian__getJiraIssue` MCP 직접 호출:
- `issueIdOrKey`: {ISSUE_KEY}
- `fields`: summary, status, issuetype, priority, assignee, description, parent, components
- `responseContentFormat`: "markdown"

반환된 결과에서 다음 정보를 추출하여 표시한다:
- 이슈 키, 제목, 상태, 유형, 우선순위, 담당자, 설명(마크다운 형식)

**에러 처리**:
| HTTP 상태 | 대응 |
|-----------|------|
| 404 (이슈 없음) | "이슈를 찾을 수 없습니다: {ISSUE_KEY}" 출력. **독립 실행 시**: "새로 생성하시겠습니까? [Y/n]" 제시 → Y이면 han-issue-create 위임. **han-start에서 위임받은 경우**: 404 상태를 반환하고 han-start가 분기 처리(→ 분기 B-2) |
| 401/403 (권한 오류) | "인증 실패. JIRA_USER/JIRA_TOKEN 환경변수를 확인하세요." |
| 기타 오류 | "Jira 조회 오류: {오류 메시지}" 출력 후 중단 |

---

## Step 3: 결과 표시

```
────────────────────────────────────────
📋 [{issue_key}] {summary}
────────────────────────────────────────
유형: {issuetype} | 상태: {status} | 우선순위: {priority}
담당자: {assignee} | 상위 Epic: {parent_key}
컴포넌트: {components}

**할 일**
{description}
────────────────────────────────────────
```

---

## 반환값

이 스킬이 완료되면 다음 값이 확정된다:

| 변수 | 값 | 용도 |
|------|-----|------|
| `ISSUE_KEY` | 예: `AIAGENT-123` | 컨텍스트 저장, Jira 상태 전환 |
| `ISSUE_TYPE` | `Bug` / `작업` 등 | han-code에서 브랜치 prefix 결정 |
