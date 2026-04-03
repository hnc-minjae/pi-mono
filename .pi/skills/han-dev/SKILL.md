---
name: han-dev
description: |
  한컴 Team 기반 개발 하네스. start-agent → code-agent → close-agent를
  각각 독립 컨텍스트 에이전트로 순차 spawn하여 실행한다.
  각 단계가 격리된 컨텍스트에서 실행되므로 컨텍스트 절약 및 전문가 에이전트 실제 활용 가능.
  기존 han-start/han-code/han-close 스킬과 동일한 .han/state/sessions/{SESSION_ID}.json을 사용.
  "이슈 작업 시작", "개발 전체", "개발 하네스", "전체 워크플로우", "AIAGENT-123 개발", "처음부터 끝까지", "개발 시작부터 완료까지", "start to close", "full dev" 등에 반응.
user_invocable: true
argument: "[ISSUE_KEY] [--auto] [--full] — ISSUE_KEY: 이슈 키(선택); --auto: 단계 간 자동 진행(기본: confirm); --full: han-analyze/han-tdd/han-security 포함(기본: fast)"
---

# han-dev — Team 기반 개발 하네스

start-agent(1단계) → code-agent(2단계) → close-agent(3단계)를
각각 독립 컨텍스트 에이전트로 순차 실행하는 오케스트레이터.

**핵심 설계:**
- 각 단계가 독립 컨텍스트(Agent 도구)에서 실행 → 컨텍스트 창 절약
- TeamCreate/TaskCreate로 단계별 진행 상황 추적
- 단계 완료 후 confirm 또는 auto 모드로 다음 단계 진행
- `.han/state/sessions/{SESSION_ID}.json`으로 단계 간 상태 공유

---

## Step 0: 환경 설정 로드 및 컨텍스트 초기화

### 0-1. 인자 파싱

```
ISSUE_KEY = 첫 번째 위치 인자 (없으면 빈 문자열)
AUTO_MODE = '--auto' in 인자 목록
FAST_MODE = '--full' not in 인자 목록
```

### 0-2. 재개 감지

`.han/state/sessions/{SESSION_ID}.json`이 존재하고 `stage`가 이미 진행된 상태이면 → 재개 모드:

| stage | 동작 |
|-------|------|
| `pre_done` | 2단계(code-agent)부터 재개 |
| `code_done` | 3단계(close-agent)부터 재개 |
| `close_done` | 완료 안내 후 종료 |
| `security_blocked` | 보안 이슈 해결 안내 후 중단 |

재개 시 컨텍스트 파일의 `team_name`이 있으면 해당 팀을 재사용한다.

### 0-3. 설정 파일 로드

`~/.config/han/han-config.md` 읽기:
- 파일 없음 → `"/han-dev:han-dev-setup 을 먼저 실행하세요."` 출력 후 중단

추출 값:

| 변수 | 섹션 | 키 |
|------|------|----|
| `API_BASE` | Atlassian | Base URL |
| `GITLAB_BASE` | GitLab | Base URL |
| `DEFAULT_BRANCH` | GitLab | 기본 브랜치 |
| `USER_EMAIL` | 개인 정보 | 이메일 |
| `DEV_MODE` | 기본 설정 | 개발 모드 (기본: manual) |

`JIRA_USER`, `JIRA_TOKEN` 환경변수 확인 — 미설정 시 중단.

AUTO_MODE 최종 결정:
```python
# --auto 플래그 > han-config.md의 dev_mode
AUTO_MODE = AUTO_MODE or (DEV_MODE == 'auto')
```

### 0-4. 컨텍스트 초기화

```python
import json, os
from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))
SESSION_ID = os.environ.get('CLAUDE_SESSION_ID', 'default')
ctx_path = f".han/state/sessions/{SESSION_ID}.json"
os.makedirs(".han/state/sessions", exist_ok=True)

ctx = json.load(open(ctx_path)) if os.path.exists(ctx_path) else {}
ctx.update({
    'han_dev_managed':    True,
    'auto_mode':          AUTO_MODE,
    'fast_mode':          FAST_MODE,
    'api_base':           API_BASE,
    'gitlab_base':        GITLAB_BASE,
    'default_branch':     DEFAULT_BRANCH,
    'user_email':         USER_EMAIL,
    'dev_mode':           DEV_MODE,
    'harness_start_time': datetime.now(KST).isoformat(),
})
if ISSUE_KEY:
    ctx['issue_key'] = ISSUE_KEY
json.dump(ctx, open(ctx_path, 'w'), ensure_ascii=False, indent=2)
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
han-dev — Team 기반 개발 하네스
모드: {AUTO_MODE ? "자동" : "확인"} / {FAST_MODE ? "fast" : "full"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 1: Team 생성 및 태스크 등록

재개 시 컨텍스트에 `team_name`이 있으면 TeamCreate 스킵, 기존 팀 재사용.

```python
import re
from datetime import datetime, timezone, timedelta
KST = timezone(timedelta(hours=9))

team_slug = ctx.get('team_name') or (
    f"handev-{re.sub(r'[^a-z0-9]', '-', ISSUE_KEY.lower())}"
    if ISSUE_KEY else
    f"handev-{datetime.now(KST).strftime('%m%d%H%M')}"
)
```

**TeamCreate** (신규 실행 시만):
```json
{
  "team_name": "{team_slug}",
  "description": "han-dev 하네스: {ISSUE_KEY or '신규 이슈'}"
}
```

**TaskCreate x3** (신규 실행 시만):

```json
{ "subject": "[1단계] start-agent — Jira 이슈 파악",
  "description": "Jira 이슈 조회/생성, 상태 → To Do, 컨텍스트 저장",
  "activeForm": "Jira 이슈 파악 중" }

{ "subject": "[2단계] code-agent — 브랜치·코드·보안",
  "description": "브랜치 생성, Jira In Progress, 코드 구현, 보안 검토",
  "activeForm": "코드 개발 중" }

{ "subject": "[3단계] close-agent — 커밋·MR·Jira 완료",
  "description": "커밋, MR 생성, Jira Worklog·상태·코멘트 처리",
  "activeForm": "마무리 처리 중" }
```

반환된 task ID를 `TASK_ID_1`, `TASK_ID_2`, `TASK_ID_3`으로 저장.

team_name + task_ids를 컨텍스트 파일에 추가 저장:
```python
ctx['team_name'] = team_slug
ctx['task_ids']  = [TASK_ID_1, TASK_ID_2, TASK_ID_3]
json.dump(ctx, open(ctx_path, 'w'), ensure_ascii=False, indent=2)
```

---

## Step 2: start-agent 실행 (1단계)

### 스킵 조건

stage가 `pre_done`, `code_done`, `close_done` 중 하나이면:
```
[1단계] start-agent ✅ 스킵 (stage={stage})
```

### 실행

```
Agent(
  subagent_type="han-dev:start-agent",
  team_name=team_slug,
  prompt="""
[han-dev 1단계] start-agent로 실행합니다.

컨텍스트 파일: .han/state/sessions/{SESSION_ID}.json (han_dev_managed=true, 설정 기저장)
담당 태스크 ID: {TASK_ID_1}
이슈 키(있으면): {ISSUE_KEY}

완료 후:
1. TaskUpdate(task_id={TASK_ID_1}, status="completed")
2. SendMessage(to="team-lead@{team_slug}", content=JSON 결과)
  """
)
```

완료 후 컨텍스트 재확인:
```python
ctx   = json.load(open(ctx_path))
stage = ctx.get('stage')
```
`stage != 'pre_done'` → "start-agent가 정상 완료되지 않았습니다." 후 중단.

### 단계 간 확인

AUTO_MODE가 False:
```
────────────────────────────────────────
[1단계 완료] 이슈: [{issue_key}] {issue_title}
             stage: pre_done ✅
────────────────────────────────────────
→ 2단계(code-agent)로 진행하시겠습니까?
  Enter → 진행  /  n → 여기서 중단
```
- `n` → "나중에 `/han-dev:han-dev`를 실행하면 2단계부터 재개됩니다." 후 종료

AUTO_MODE가 True: 바로 Step 3 진행.

---

## Step 3: code-agent 실행 (2단계)

### 스킵 조건

stage가 `code_done` 또는 `close_done`이면:
```
[2단계] code-agent ✅ 스킵 (stage={stage})
```

### 실행

```
Agent(
  subagent_type="han-dev:code-agent",
  team_name=team_slug,
  prompt="""
[han-dev 2단계] code-agent로 실행합니다.

컨텍스트 파일: .han/state/sessions/{SESSION_ID}.json (han_dev_managed=true)
담당 태스크 ID: {TASK_ID_2}
fast_mode: {FAST_MODE}

완료 후:
1. TaskUpdate(task_id={TASK_ID_2}, status="completed")
2. SendMessage(to="team-lead@{team_slug}", content=JSON 결과)
  """
)
```

완료 후 컨텍스트 재확인:
- `stage == 'security_blocked'` → 보안 차단 안내:
  ```
  ⛔ 보안 이슈가 차단 중입니다.
  .han/state/sessions/{SESSION_ID}.json의 security_findings 확인 후
  수정 완료 시 `/han-dev:han-dev`를 재실행하세요.
  ```
- `stage != 'code_done'` → "code-agent가 정상 완료되지 않았습니다." 후 중단.

### 단계 간 확인

```
────────────────────────────────────────
[2단계 완료] 브랜치: {branch_name}
             stage: code_done ✅
────────────────────────────────────────
→ 3단계(close-agent)로 진행하시겠습니까?
  Enter → 진행  /  n → 여기서 중단
```

---

## Step 4: close-agent 실행 (3단계)

### 스킵 조건

stage가 `close_done`이면:
```
✅ 이미 완료된 이슈입니다. 새 이슈는 /han-dev:han-dev 로 시작하세요.
```

### 실행

```
Agent(
  subagent_type="han-dev:close-agent",
  team_name=team_slug,
  prompt="""
[han-dev 3단계] close-agent로 실행합니다.

컨텍스트 파일: .han/state/sessions/{SESSION_ID}.json (han_dev_managed=true)
담당 태스크 ID: {TASK_ID_3}

완료 후:
1. TaskUpdate(task_id={TASK_ID_3}, status="completed")
2. SendMessage(to="team-lead@{team_slug}", content=JSON 결과)
  """
)
```

---

## Step 5: 정리 및 결과 요약

```python
ctx = json.load(open(ctx_path))
worklog_seconds = ctx.get('worklog_seconds', 0)
hours, minutes  = worklog_seconds // 3600, (worklog_seconds % 3600) // 60
```

**TeamDelete:**
```json
{ "team_name": "{team_slug}" }
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ han-dev (Team 기반 하네스) 완료
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
이슈:     [{issue_key}] {issue_title}
브랜치:   {branch_name}
커밋:     {commit_sha}
MR:       {mr_url}
작업시간: {hours}시간 {minutes}분
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
새 이슈: /han-dev:han-dev [NEW_ISSUE_KEY]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 에러 처리

| 상황 | 대응 |
|------|------|
| han-config.md 없음 | "/han-dev:han-dev-setup 먼저 실행" 후 중단 |
| 에이전트 stage 불일치 | 오류 메시지 후 중단 (컨텍스트 보존, 재실행 가능) |
| `security_blocked` | 해결 절차 안내 후 중단 |
| 사용자 n 입력 | stage 유지. 재실행 시 해당 stage부터 자동 재개 |
| `close_done` 재실행 | "이미 완료" 안내 후 새 이슈 시작 방법 제시 |
