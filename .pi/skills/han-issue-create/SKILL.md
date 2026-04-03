---
name: han-issue-create
description: Jira에 새 이슈(Task 또는 Bug)를 생성한다. 상위 Epic이 없으면 Epic도 먼저 생성한다. 독립 단독 실행 지원. "이슈 생성", "이슈 만들어", "새 이슈", "이슈 등록", "이슈 추가", "태스크 만들어", "버그 등록", "issue create" 등에 반응한다.
user_invocable: true
argument: "(없음 또는 작업 설명 힌트) — 예: /han-dev:han-issue-create 'PDF 내보내기 개선'"
---

# 이슈 생성 워크플로우

사용자와 대화하며 Task(또는 Bug)를 생성한다. 모든 Task는 반드시 Epic에 속해야 하므로
상위 Epic을 확인하고, 없으면 Epic을 먼저 생성한다.

> **이슈 작성 원칙**:
> - 제목: `[컴포넌트명] 업무 요약` 형식. 기술 용어보다 업무 맥락 중심.
> - description: "이 이슈에서 무엇을 할 것인가" 위주. 개조식. `#` `##` heading 절대 금지 — 섹션 구분은 `###`만 허용, 강조는 `**bold**` 사용.
> - 모든 Task는 반드시 상위 Epic에 속해야 함.

---

## Step 0: 환경 설정 로드

`~/.config/han/han-config.md` 읽기:
- 파일 없음 → **"/han-dev:han-dev-setup 을 먼저 실행하세요."** 출력 후 중단

추출 값:

| 변수 | 섹션 | 키 |
|------|------|----|
| `API_BASE` | Atlassian | Base URL |

JIRA_USER, JIRA_TOKEN 환경변수 확인 (미설정 시 "/han-dev:han-dev-setup 을 먼저 실행하세요." 후 중단)

### PROJECT_KEY 결정

- han-start에서 위임받은 경우: 호출 컨텍스트에서 `PROJECT_KEY`가 전달된다 (han-start가 이슈 키 또는 AskUserQuestion으로 확정한 값).
- 독립 실행 시: `AskUserQuestion`으로 입력받는다:
  > Jira Project Key를 입력하세요 (예: AIAGENT):

---

## Step 1: 이슈 유형 결정

```
어떤 유형의 이슈를 생성하시겠습니까?
  [1] 작업 (Task)       — 기능 개발, 개선 작업
  [2] 버그 (Bug)        — 오류 수정
  [3] 서브태스크 (Sub-task) — Epic/Task 하위 세부 작업
  [4] 스토리 (Story)    — 사용자 관점의 요구사항
```

사용자 선택 → `ISSUE_TYPE` 확정 (`작업` / `버그` / `서브태스크` / `스토리`)

> **Sub-task 선택 시**: Step 4에서 반드시 상위 Task(또는 Epic) 키를 지정한다.
> Sub-task는 Task 하위에 바로 생성되며, Epic 하위에 직접 생성할 수 없다.

---

## Step 2: 이슈 제목 작성

**컨벤션**:
- 형식: `[컴포넌트명] 업무 요약`
- 기술 용어(파일명, 함수명, API 경로) 지양 → 업무 맥락 중심
- 담당자가 아닌 사람도 이해할 수 있는 표현

AI가 초안을 제시하고 사용자가 확인:
```
이슈 제목 초안:
  [컴포넌트명] {AI가 제안한 업무 요약}

수정 사항이 있으면 입력하세요 (없으면 Enter):
```

사용자 수정 입력 시 반영 → `ISSUE_SUMMARY` 확정

---

## Step 3: Description 작성

**컨벤션**:
- **"이 이슈에서 무엇을 할 것인가"** 위주 — 목표, 요구사항, 해결할 문제 중심
- 완료된 작업 내용, 변경 파일 목록, 구현 세부사항, 커밋 내용 → **description 절대 금지** (MR description 또는 이슈 코멘트에 작성)
- arguments나 힌트로 "이미 완료된 작업"이 전달되더라도 description은 반드시 미래/목표 관점으로 재작성
- 개조식 bullet-point
- 섹션 구분이 필요하면 `### 소제목` 사용, 인라인 강조는 `**bold**` 사용
- `#`, `##` heading 절대 금지
- Markdown 형식으로 작성 (MCP createJiraIssue에 contentFormat: "markdown"으로 직접 전달)

**잘못된 예 (금지)**:
```
- src/core/session/transport.py: create_streamable_http_app() 추가함
- main.py: v1 SSE + v2 Streamable HTTP 동시 마운트 완료
```

**올바른 예**:
```
- 기존 SSE 방식 MCP 서버에 Streamable HTTP 트랜스포트를 추가하여 두 방식 병행 지원
- /v1/* 기존 SSE 엔드포인트 하위 호환성 유지 및 /v2/* 신규 엔드포인트 추가
```

AI가 초안을 제시하고 사용자가 확인:
```
Description 초안:
  - {항목 1}
  - {항목 2}
  ...

수정 사항이 있으면 입력하세요 (없으면 Enter):
```

→ `ISSUE_DESCRIPTION` 확정 (Markdown 형식)

---

## Step 4: 상위 이슈 처리

**Sub-task 선택 시** (ISSUE_TYPE = 서브태스크):

상위 Task 키를 확인한다:
```
상위 Task 키를 입력하세요 (예: AIAGENT-123):
```
- 입력한 Task 키 → `PARENT_KEY` 확정 → Step 5로
- 유효하지 않은 키 → "해당 이슈를 찾을 수 없습니다." 후 재입력 요청

**Task/Bug/Story 선택 시**: 반드시 상위 Epic에 속해야 한다.

### 4-1: 사용자가 Epic 키를 직접 제공한 경우

```
상위 Epic 키: {EPIC_KEY}
→ 해당 Epic 하위에 Task 생성 (Step 5로)
```

### 4-2: Epic 키 미제공 — 진행 중 Epic 목록 조회

→ `mcp__atlassian__searchJiraIssuesUsingJql` MCP 직접 호출:
- `jql`: "project={PROJECT_KEY} AND issuetype=에픽 AND resolution = Unresolved ORDER BY created DESC"
- `fields`: summary, status
- `maxResults`: 10
- `responseContentFormat`: "markdown"

Epic이 1개 이상 있을 경우 목록 표시:
```
진행 중인 Epic 목록:
  [1] AIAGENT-100 | AI 어시스턴트 기능 개선
  [2] AIAGENT-050 | PDF 처리 고도화
  [3] 새 Epic 생성
번호 선택:
```

- 기존 Epic 선택 → `PARENT_KEY` 확정
- "새 Epic 생성" 선택 또는 Epic 0건 → Step 4-3으로

### 4-3: Epic 생성

Epic도 동일한 이슈 작성 컨벤션 적용:
```
Epic 제목 입력 (예: [컴포넌트명] 기능군 이름):
Epic description 입력 (생략 가능, Enter로 건너뜀):
```

→ `mcp__atlassian__createJiraIssue` MCP 직접 호출:
- `projectKey`: {PROJECT_KEY}
- `issueTypeName`: "에픽"
- `summary`: {EPIC_SUMMARY}
- `description`: {EPIC_DESCRIPTION}
- `contentFormat`: "markdown"

성공 시: `Epic 생성 완료: {PARENT_KEY}`

**에러 처리**:
| 상황 | 대응 |
|------|------|
| 400 | "Epic 생성 실패: {오류 메시지}" 출력 후 Epic 재입력 요청 |
| 401/403 (권한 오류) | "인증 실패. JIRA_USER/JIRA_TOKEN 환경변수를 확인하세요." |
| 기타 오류 | 오류 메시지 출력 후 중단 |

---

## Step 5: 이슈 생성

→ `mcp__atlassian__createJiraIssue` MCP 직접 호출:
- `projectKey`: {PROJECT_KEY}
- `issueTypeName`: {ISSUE_TYPE}
- `summary`: {ISSUE_SUMMARY}
- `description`: {ISSUE_DESCRIPTION}
- `parent`: {PARENT_KEY}
- `contentFormat`: "markdown"

**에러 처리**:
| 상황 | 대응 |
|------|------|
| 400 (parentId 오류) | "Task 하위에 Task를 직접 넣을 수 없습니다." 안내 후 Epic 재선택 |
| 401/403 (권한 오류) | "인증 실패. JIRA_USER/JIRA_TOKEN 환경변수를 확인하세요." |
| 기타 오류 | 오류 메시지 출력 후 중단 |

---

## Step 6: 결과 표시

```
────────────────────────────────────────
✅ 이슈 생성 완료
────────────────────────────────────────
📋 [{ISSUE_KEY}] {ISSUE_SUMMARY}
   유형: {ISSUE_TYPE} | 상위 이슈: {PARENT_KEY}
   URL: https://hancom.atlassian.net/browse/{ISSUE_KEY}
────────────────────────────────────────
```

---

## 반환값

| 변수 | 값 | 용도 |
|------|-----|------|
| `ISSUE_KEY` | 예: `AIAGENT-124` | 컨텍스트 저장, Jira 상태 전환 |
| `ISSUE_TYPE` | `작업` / `버그` / `서브태스크` / `스토리` | han-code에서 브랜치 prefix 결정 |
