---
name: han-start
description: 한컴 개발 1단계(개발 전단계). 이슈/Task를 파악하거나 생성하고, Jira 상태를 To Do로 전환한 뒤 개발 컨텍스트를 저장한다. 브랜치 생성/GitLab 접근 없음 — Jira 세계만 다룸. "이슈 시작", "이슈 시작합니다", "작업 준비", "개발 시작", "작업 시작", "이슈 파악", "이슈부터 시작" 등에 반응한다.
user_invocable: true
argument: "[ISSUE_KEY] — 예: /han-dev:han-start AIAGENT-123 (생략 시 이슈 목록 선택 또는 신규 생성)"
---

# 개발 전단계 워크플로우 (1단계)

개발을 시작하기 전에 Jira 이슈를 확정하고 To Do 상태로 설정한다.
브랜치 생성은 han-code(2단계)에서 처리한다.

```
[이 스킬의 범위]
✅ Jira 이슈 파악 또는 생성
✅ Jira 상태 → To Do 전환
✅ 개발 컨텍스트 파일 저장
❌ 브랜치 생성 (→ han-code 담당)
❌ GitLab 접근 (→ han-code 담당)
```

---

## Step 0: 환경 설정 로드

`.han/state/sessions/{SESSION_ID}.json`에 `han_dev_managed: true`가 있으면 han-dev가 이미 설정을 로드했으므로 이 Step을 스킵한다:

```python
import json, os
SESSION_ID = os.environ.get('CLAUDE_SESSION_ID', 'default')
ctx_path = f".han/state/sessions/{SESSION_ID}.json"
os.makedirs(".han/state/sessions", exist_ok=True)
ctx = json.load(open(ctx_path)) if os.path.exists(ctx_path) else {}

if ctx.get('han_dev_managed'):
    API_BASE   = ctx['api_base']
    JIRA_USER  = os.environ.get('JIRA_USER', '') or ctx.get('user_email', '')
    JIRA_TOKEN = os.environ.get('JIRA_TOKEN', '')
    # Step 0 완료 — Step 1로 진행
else:
    # 독립 실행: han-config.md에서 직접 로드
    pass
```

**독립 실행 시** (han_dev_managed 없음):

`~/.config/han/han-config.md` 읽기:
- 파일 없음 → **"/han-dev:han-dev-setup 을 먼저 실행하세요."** 출력 후 중단

추출 값:

| 변수 | 섹션 | 키 |
|------|------|----|
| `API_BASE` | Atlassian | Base URL |

JIRA_USER, JIRA_TOKEN 환경변수 확인 (미설정 시 "/han-dev:han-dev-setup 을 먼저 실행하세요." 후 중단)

> GitLab 설정은 로드하지 않음 — 브랜치 생성은 han-code에서 처리
> 인증 테스트 없음 — han-setup에서 1회 처리

---

## Step 1: 이슈 특정

### [분기 A] 이슈 키가 인자로 제공된 경우

```
→ han-issue-check {ISSUE_KEY} 위임
```

han-issue-check 실행 → `ISSUE_KEY`, `ISSUE_TYPE` 반환
- 조회 성공 시: 이슈 키에서 PROJECT_KEY 추출 (`AIAGENT-123` → `PROJECT_KEY=AIAGENT`)
- 조회 실패(404) 시: "이슈를 찾을 수 없습니다. 새로 생성하시겠습니까? [Y/n]"
  - Y → 분기 B-2로

### [분기 B] 이슈 키 없이 호출된 경우

```
무엇을 하시겠습니까?
  [1] 내 할당 이슈 목록에서 선택
  [2] 새 Task 생성
```

**[분기 B-1] 목록 선택**:
```
→ han-issue-list 위임
```
han-issue-list 실행 → `ISSUE_KEY`, `ISSUE_TYPE` 반환
반환된 `ISSUE_KEY`에서 PROJECT_KEY 추출 (`AIAGENT-123` → `PROJECT_KEY=AIAGENT`)

**[분기 B-2] 새 Task 생성**:

이슈 키가 없으므로 `AskUserQuestion`으로 Project Key를 입력받는다:
> Jira Project Key를 입력하세요 (예: AIAGENT):

입력값 → `PROJECT_KEY` 확정

```
→ han-issue-create 위임
```
han-issue-create 실행 → `ISSUE_KEY`, `ISSUE_TYPE` 반환

---

## Step 2: Jira 상태 → To Do

### 2-0. cloudId 준비

API_BASE에서 호스트를 추출하여 MCP의 cloudId로 사용한다:
```
SITE_HOST = API_BASE에서 호스트 추출 (예: https://hancom.atlassian.net → hancom.atlassian.net)
```

### 2-1. 현재 상태 확인

→ `mcp__atlassian__getJiraIssue` 호출:
  - cloudId: SITE_HOST
  - issueIdOrKey: ISSUE_KEY
  - fields: "status"

CURRENT_STATUS = 응답의 status.name 값

이미 `할 일` 또는 `To Do`이면 → "이미 To Do 상태입니다." 출력 후 Step 3으로 스킵.

### 2-2. 전환 가능 목록 조회

→ `mcp__atlassian__getTransitionsForJiraIssue` 호출:
  - cloudId: SITE_HOST
  - issueIdOrKey: ISSUE_KEY

반환된 transitions에서 to.name이 `할 일` 또는 `To Do`인 항목의 id 추출 → `TODO_ID`

### 2-3. 상태 전환 실행

`TODO_ID`가 있으면:
- → `mcp__atlassian__transitionJiraIssue` 호출:
    - cloudId: SITE_HOST
    - issueIdOrKey: ISSUE_KEY
    - transition: {"id": TODO_ID}
- 출력: "상태 전환 완료: {CURRENT_STATUS} → To Do"

`TODO_ID`가 없으면 (To Do 직접 전환 불가):
- 가능한 전환 목록을 표시:
  ```
  To Do로 직접 전환할 수 없습니다. 가능한 전환 상태:
    [1] {전환명1}
    [2] {전환명2}
  번호 선택 (건너뛰려면 0):
  ```
- 사용자가 번호 선택 → 선택한 전환의 id를 사용하여 `mcp__atlassian__transitionJiraIssue` 호출:
    - cloudId: SITE_HOST
    - issueIdOrKey: ISSUE_KEY
    - transition: {"id": 선택한 전환의 id}
- 0 입력 시 → 전환 없이 Step 3으로 진행

---

## Step 3: 컨텍스트 저장

`.han/state/sessions/` 디렉토리 생성 후 컨텍스트 저장:

```bash
mkdir -p .han/state/sessions

python3 -c "
import json, os
from datetime import datetime, timezone, timedelta

SESSION_ID = os.environ.get('CLAUDE_SESSION_ID', 'default')
ctx_path = f'.han/state/sessions/{SESSION_ID}.json'

KST = timezone(timedelta(hours=9))
now = datetime.now(KST).isoformat()

existing = json.load(open(ctx_path)) if os.path.exists(ctx_path) else {}
ctx = {
    'issue_key': '$ISSUE_KEY',
    'issue_title': '$ISSUE_SUMMARY',
    'issue_type': '$ISSUE_TYPE',
    'project_key': '$PROJECT_KEY',
    'start_time': existing.get('start_time', now),
    'stage': 'pre_done'
}
json.dump(ctx, open(ctx_path, 'w'), ensure_ascii=False, indent=2)
print('컨텍스트 저장 완료')
"
```

저장 필드 설명:

| 필드 | 예시 | 용도 |
|------|------|------|
| `issue_key` | `AIAGENT-123` | han-code, han-close에서 Jira 작업 기준 |
| `issue_title` | `[PDF] 한글 폰트 렌더링 오류` | 커밋 메시지, MR 제목 자동 생성 |
| `issue_type` | `버그` / `작업` | han-code에서 브랜치 prefix 결정 |
| `project_key` | `AIAGENT` | Jira API 호출 시 프로젝트 식별 |
| `start_time` | ISO8601 KST | han-close에서 Worklog 시간 계산 |
| `stage` | `pre_done` | 단계 진행 상태 추적 |

> `branch_name` 없음 — 브랜치는 han-code에서 GitLab 저장소 확인 후 생성

---

## Step 4: 결과 요약

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ han-start (1단계: 개발 전단계) 완료
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 이슈: [{ISSUE_KEY}] {ISSUE_TITLE}
🔄 상태: {이전 상태} → To Do
💾 컨텍스트: .han/state/sessions/{SESSION_ID}.json
────────────────────────────────────────
→ 다음: /han-dev:han-code  (브랜치 생성 + 개발 시작)
```

---

## 에러 처리

| 상황 | 대응 |
|------|------|
| han-config.md 없음 | "/han-dev:han-dev-setup 을 먼저 실행하세요." 후 중단 |
| 이슈 없음 (404) | 이슈 키 확인 또는 신규 생성 여부 확인 |
| To Do 전환 불가 | 가능한 상태 목록 출력 후 선택 요청 (0 입력 시 스킵) |
| 서버 오류 (5xx) | 1초 후 1회 재시도. 재실패 시 오류 코드 출력 후 중단 |

---

## 하위 스킬 위임 관계

```
han-start
├── han-issue-check   이슈 키 → 조회·표시 (분기 A)
├── han-issue-list    내 할당 이슈 목록 조회·선택 (분기 B-1)
├── han-issue-create  새 Task/Epic 생성 (분기 B-2)
└── [MCP 직접 호출] Jira 상태 전환 — mcp__atlassian__* (Step 2)
```
