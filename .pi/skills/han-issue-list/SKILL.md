---
name: han-issue-list
description: 현재 사용자에게 할당된 미완료 Jira 이슈 목록을 조회한다. 독립 단독 실행 지원. "이슈 목록", "내 이슈", "할당된 이슈", "이슈 뭐 있어", "할 일 목록", "내 할 일", "이슈 리스트", "issue list" 등에 반응한다.
user_invocable: true
argument: "(없음) — 인자 없이 호출"
---

# 할당 이슈 목록 워크플로우

현재 사용자에게 할당된 미완료 이슈를 Jira JQL로 조회하고, 번호를 입력해 이슈를 선택한다.

---

## Step 0: 환경 설정 로드

`~/.config/han/han-config.md` 읽기:
- 파일 없음 → **"/han-dev:han-dev-setup 을 먼저 실행하세요."** 출력 후 중단

추출 값:

| 변수 | 섹션 | 키 |
|------|------|----|
| `API_BASE` | Atlassian | Base URL |

JIRA_USER, JIRA_TOKEN 환경변수 확인 (미설정 시 "/han-dev:han-dev-setup 을 먼저 실행하세요." 후 중단)

---

## Step 1: 할당 이슈 조회

### Step 1-1: 현재 사용자 조회

→ `mcp__atlassian__atlassianUserInfo` MCP 직접 호출 (파라미터 없음)
DISPLAY_NAME 확보 (목록 표시에 사용)

### Step 1-2: 할당 이슈 조회 (JQL)

→ `mcp__atlassian__searchJiraIssuesUsingJql` MCP 직접 호출:
- `jql`: "assignee = currentUser() AND resolution = Unresolved ORDER BY duedate ASC, updated DESC"
- `fields`: summary, status, issuetype, priority, duedate, updated
- `maxResults`: 30
- `responseContentFormat`: "markdown"

결과를 번호 목록으로 표시하고 사용자가 이슈를 선택하도록 한다.

**에러 처리**:
| 상황 | 대응 |
|------|------|
| 결과 0건 | "현재 할당된 미완료 이슈가 없습니다." 출력 후 중단 |
| 401/403 (권한 오류) | "인증 실패. JIRA_USER/JIRA_TOKEN 환경변수를 확인하세요." |
| 기타 오류 | "Jira 조회 오류: {오류 메시지}" 출력 후 중단 |

---

## Step 2: 목록 표시 및 선택

MCP 결과에서 각 이슈의 key, issuetype, summary, status, duedate를 파싱하여 **상태별 그룹화 형식**으로 표시한다 (DISPLAY_NAME은 Step 1-1에서 확보):

```
{현재 사용자 이름}님의 할당 이슈 목록:

● 진행 중 (In Progress)
  [ 1] AIAGENT-123 | [버그] PDF 한글 폰트 깨짐             | 마감: 03/25

● 할 일 (To Do)
  [ 2] AIAGENT-456 | [작업] 내보내기 옵션 추가              | 마감: 04/01
  [ 3] AIAGENT-789 | [작업] 로그인 화면 개선                | 마감: 없음

번호 선택 (1-{총 개수}):
```

상태 그룹 우선순위: `In Progress` → `To Do` → `Review` → 기타 순으로 정렬.
이슈가 모두 동일 상태인 경우 그룹 헤더 없이 번호 목록만 표시해도 된다.

사용자가 번호 입력 → 해당 이슈 선택
- 범위 밖 입력 → "올바른 번호를 입력해 주세요." 재입력 요청

---

## 반환값

이 스킬이 완료되면 다음 값이 확정된다:

| 변수 | 값 | 용도 |
|------|-----|------|
| `ISSUE_KEY` | 예: `AIAGENT-123` | 컨텍스트 저장, Jira 상태 전환 |
| `ISSUE_TYPE` | `Bug` / `작업` 등 | han-code에서 브랜치 prefix 결정 |
