---
name: han-code
description: 한컴 개발 2단계(개발). 브랜치 생성, 코드 분석, TDD, 보안 검토, 커밋, MR 생성, Worklog, 코멘트까지 개발 전 과정을 오케스트레이션한다. 사용자가 이슈 키 또는 Jira URL(hancom.atlassian.net/browse/PROJ-123)과 함께 개발 의도를 표현하면 이 스킬을 호출한다. "개발", "개발합니다", "구현", "구현합니다", "코딩", "코딩할게요", "작업합니다", "작업하겠습니다", "개발 시작", "구현 시작" 등에 반응한다.
user_invocable: true
argument: "[ISSUE_KEY] — 예: 'AIAGENT-123'. 생략 시 세션 컨텍스트에서 자동으로 읽는다."
---

# 개발 워크플로우 (2단계)

브랜치 생성부터 코드 구현, 보안 검토, 커밋, MR 생성, Worklog, 코멘트까지의 개발 전 과정을 오케스트레이션한다.
han-start(1단계)가 저장한 컨텍스트를 기반으로 하위 스킬들을 순서대로 위임한다.

```
[이 스킬의 범위]
✅ 환경 설정 로드 (Jira + GitLab)
✅ 컨텍스트 로드 및 검증
✅ 브랜치 생성 (→ han-branch 위임)
✅ Jira 상태 → In Progress 전환
✅ 코드 분석 (→ han-analyze 위임)
✅ 구현 계획 승인 (manual 모드 시 EnterPlanMode)
✅ TDD 사이클 (→ han-tdd 위임)
✅ 보안 검토 (→ han-security 위임)
✅ 커밋 전 코드 리뷰 (→ han-code-review 위임)
✅ 변경사항 커밋 (메시지 자동 생성 + 사용자 확인)
✅ GitLab MR 생성 (→ han-mr 위임)
✅ Jira Worklog 기록 (start_time 기반 자동 계산)
✅ Jira 작업 요약 코멘트 (→ han-comment 위임, MR URL 포함)
✅ 컨텍스트 업데이트
❌ 이슈 파악/생성 (→ han-start 담당)
❌ Jira 상태 전환 (→ han-close 담당)
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
    API_BASE       = ctx['api_base']
    GITLAB_BASE    = ctx['gitlab_base']
    DEFAULT_BRANCH = ctx['default_branch']
    DEV_MODE       = ctx.get('dev_mode', 'manual')
    JIRA_USER      = os.environ.get('JIRA_USER', '') or ctx.get('user_email', '')
    JIRA_TOKEN     = os.environ.get('JIRA_TOKEN', '')
    # API_BASE에서 SITE_HOST 추출 (예: "https://hancom.atlassian.net" → "hancom.atlassian.net")
    from urllib.parse import urlparse
    SITE_HOST      = urlparse(API_BASE).hostname
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
| `SITE_HOST` | API_BASE에서 추출 | 호스트명 (예: `hancom.atlassian.net`) |
| `GITLAB_BASE` | GitLab | Base URL |
| `DEFAULT_BRANCH` | GitLab | 기본 브랜치 |
| `JIRA_USER` | 환경변수 | — |
| `JIRA_TOKEN` | 환경변수 | — |

환경변수 확인:
```bash
[ -z "$JIRA_USER" ] || [ -z "$JIRA_TOKEN" ] → 설정 방법 안내 후 중단
```

GitLab 인증 확인:
```bash
if ! glab auth status &>/dev/null; then
  echo "GitLab 인증이 필요합니다."
  echo "실행: glab auth login --hostname gitlab.hancom.io"
  # 중단
fi
```

> han-start와 달리 Jira + GitLab 모두 로드한다.

---

## Step 1: 컨텍스트 로드

3단계 우선순위로 이슈 정보를 결정한다.
먼저 매칭되는 단계에서 확정하고 이후 단계는 건너뛴다.

### 1-1. 인자 우선 (사용자 직접 전달)

스킬 인자로 이슈 키가 전달된 경우:

```
/han-dev:han-code AIAGENT-123
```

- `ISSUE_KEY` = 인자값
- Atlassian MCP로 이슈 정보 조회:
  ```
  → mcp__atlassian__getJiraIssue(cloudId: SITE_HOST, issueIdOrKey: ISSUE_KEY, fields: "summary,issuetype")
  ```
  `ISSUE_TITLE` = summary, `ISSUE_TYPE` = issuetype.name
- `STAGE` = `pre_done` (기본값 — 처음부터 시작)
- `FAST_MODE` = `False`
- `DEV_MODE` = han-config.md의 개발 모드 값

### 1-2. 세션 컨텍스트 (오케스트레이션 환경)

인자가 없으면 세션 컨텍스트 파일을 시도한다:

```bash
SESSION_ID="${CLAUDE_SESSION_ID:-default}"
CTX_PATH=".han/state/sessions/${SESSION_ID}.json"
```

파일이 존재하면 → 모든 필드 추출:

```bash
CTX=$(cat "$CTX_PATH")
ISSUE_KEY=$(echo "$CTX" | python3 -c "import json,sys; print(json.load(sys.stdin)['issue_key'])")
ISSUE_TITLE=$(echo "$CTX" | python3 -c "import json,sys; print(json.load(sys.stdin)['issue_title'])")
ISSUE_TYPE=$(echo "$CTX" | python3 -c "import json,sys; print(json.load(sys.stdin)['issue_type'])")
STAGE=$(echo "$CTX" | python3 -c "import json,sys; print(json.load(sys.stdin)['stage'])")
FAST_MODE=$(echo "$CTX" | python3 -c "import json,sys; print(json.load(sys.stdin).get('fast_mode', False))")
DEV_MODE=$(echo "$CTX" | python3 -c "import json,sys; print(json.load(sys.stdin).get('dev_mode', 'manual'))")
```

### 1-3. 사용자 입력 (standalone, 인자 없음)

인자도 없고 세션 컨텍스트 파일도 없으면 `AskUserQuestion`으로 이슈 키를 입력받는다:

> 개발할 이슈 키를 입력하세요 (예: AIAGENT-123):

- 입력 있음 → Atlassian MCP로 이슈 정보 조회 (`ISSUE_TITLE`, `ISSUE_TYPE` 획득)
- Jira 조회 실패 시 → 이슈 제목과 타입(Bug/Task) 직접 입력
- `STAGE` = `pre_done`, `FAST_MODE` = `False`, `DEV_MODE` = han-config.md 값

### 1-4. 공통 후처리

```bash
# issue_key에서 PROJECT_KEY 추출 (예: AIAGENT-123 → AIAGENT)
PROJECT_KEY=$(echo "$ISSUE_KEY" | python3 -c "import sys; key=sys.stdin.read().strip(); print(key.rsplit('-',1)[0])")

# start_time 없으면 현재 시각으로 보완
START_TIME=$(echo "$CTX" | python3 -c "import json,sys; print(json.load(sys.stdin).get('start_time',''))")
if [ -z "$START_TIME" ]; then
  echo "⚠️  start_time이 없습니다. 현재 시각을 작업 시작 시간으로 기록합니다."
  python3 -c "
import json, os, datetime
KST = datetime.timezone(datetime.timedelta(hours=9))
now = datetime.datetime.now(KST).isoformat()
with open(ctx_path, 'r') as f:
    ctx = json.load(f)
ctx['start_time'] = now
with open(ctx_path, 'w') as f:
    json.dump(ctx, f, ensure_ascii=False, indent=2)
print(f'start_time 기록: {now}')
"
fi
```

stage 검증:

| stage 값 | 대응 |
|-----------|------|
| `pre_done` | 정상 진행 (Step 2로) |
| `tdd_done` | "TDD 완료 상태. 보안 검토 단계(Step 6)부터 재개합니다." 출력 → Step 6로 점프 |
| `security_blocked` | "보안 이슈 수정 후 재개합니다. `/han-dev:han-security` 를 먼저 재실행하세요." 출력 → 중단 |
| `code_done` | "이미 완료된 이슈입니다. `/han-dev:han-close` 를 실행하세요." 출력 → 중단 |
| 그 외 | 경고 출력 후 계속 진행할지 사용자 확인 |

---

## Step 2: han-branch 위임

```
→ han-branch 위임
```

han-branch 실행 → `BRANCH_NAME` 반환

- 예: `fix/AIAGENT-123-hangul-font-rendering`

> han-branch가 브랜치 생성, 사용자 확인, 원격 push까지 처리

---

## Step 3: Jira 상태 → In Progress

현재 상태를 먼저 확인한다:
```
→ mcp__atlassian__getJiraIssue(cloudId: SITE_HOST, issueIdOrKey: ISSUE_KEY, fields: "status")
  CURRENT_STATUS = response.fields.status.name
```

이미 `진행 중` 또는 `In Progress`이면 스킵:
```
echo "이미 In Progress 상태입니다. (스킵)"
```

그 외:
```
# 1. 가능한 전환 목록 조회하여 transition ID 획득
→ mcp__atlassian__getTransitionsForJiraIssue(cloudId: SITE_HOST, issueIdOrKey: ISSUE_KEY)
  TARGET_NAME = "In Progress" 또는 "진행 중"과 일치하는 transition을 찾음
  TRANSITION_ID = 해당 transition의 id

# 2. 전환 실행
→ mcp__atlassian__transitionJiraIssue(cloudId: SITE_HOST, issueIdOrKey: ISSUE_KEY, transition: {id: TRANSITION_ID})
  전환 불가 시 가능한 상태 목록을 출력하고 사용자 선택을 요청함
```

---

## Step 4: han-analyze 위임

`FAST_MODE=True`이면 스킵:
```
⚡ fast 모드: han-analyze 스킵
```

그 외:
```
→ han-analyze 위임
```

han-analyze 실행 → 코드 분석 결과 반환

- 이슈 관련 코드 탐색 및 의존성 파악
- side-effect 영향 범위 분석
- 변경 대상 파일 목록 도출

---

## Step 4b: 구현 계획 승인 (DEV_MODE == manual 시)

`DEV_MODE != 'manual'`이면 스킵:
```
⚡ auto 모드: 계획 승인 단계 스킵 → 바로 구현
```

`DEV_MODE == 'manual'`이면 **`EnterPlanMode`** 도구를 호출하여 플랜 모드로 진입한다.

플랜 모드에서 아래 내용을 구조화하여 제시한다:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 구현 계획 — [{ISSUE_KEY}] {ISSUE_TITLE}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌿 브랜치: {BRANCH_NAME}

📂 변경 대상 파일:
  - {파일 경로} : {변경 이유}
  - ...

🔧 구현 접근법:
  1. {구현 단계 1}
  2. {구현 단계 2}
  ...

⚠️  예상 Side-effect:
  - {영향 받는 모듈/함수}
  - ...

────────────────────────────────────────
승인하면 구현을 시작합니다.
거부하면 여기서 중단합니다.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

> **fast 모드(FAST_MODE=True)이더라도 DEV_MODE=manual이면 이 Step을 실행한다.**
> fast 모드에서 han-analyze를 스킵했다면 이슈 정보와 파일 탐색 결과만으로 계획을 작성한다.

사용자가 승인하면 `ExitPlanMode` 도구를 호출하여 플랜 모드를 해제하고 Step 5로 진행한다.
사용자가 거부하면 "구현 취소. `/han-dev:han-code` 재실행 시 이 단계부터 다시 시작합니다." 출력 후 중단.

---

## Step 5: han-tdd 위임

`FAST_MODE=True`이면 스킵:
```
⚡ fast 모드: han-tdd 스킵
```

그 외:
```
→ han-tdd 위임
```

han-tdd 실행 → TDD 사이클 완료

- 테스트 先 작성 (Red)
- 구현 코드 작성 (Green)
- 리팩토링 (Refactor)
- 전체 테스트 통과 확인

---

## Step 6: han-security 위임

`FAST_MODE=True`이면 스킵:
```
⚡ fast 모드: han-security 스킵
```

그 외:
```
→ han-security 위임
```

han-security 실행 → 보안 검토 완료

- 변경 코드 대상 보안 취약점 검토
- 입력 검증, 메모리 안전성, 권한 관리 확인

### 보안 게이트 판정

han-security가 반환한 `SECURITY_STATUS`에 따라 진행 여부를 결정한다:

| SECURITY_STATUS | 대응 |
|-----------------|------|
| `PASS` | Step 7로 정상 진행 |
| `SKIP` | Step 7로 정상 진행 (경고 기록) |
| `BLOCKED` | stage를 `security_blocked`로 저장 후 **중단** |

`BLOCKED` 시 처리:

```bash
python3 -c "
import json, os
SESSION_ID = os.environ.get('CLAUDE_SESSION_ID', 'default')
ctx_path = f'.han/state/sessions/{SESSION_ID}.json'
with open(ctx_path, 'r') as f:
    ctx = json.load(f)
ctx['stage'] = 'security_blocked'
with open(ctx_path, 'w') as f:
    json.dump(ctx, f, ensure_ascii=False, indent=2)
"
```

출력:
```
🚫 보안 이슈가 해결되지 않았습니다.
취약점 수정 후 /han-dev:han-security 를 재실행하세요.
상세 결과: .han/state/security-findings.json
```

**Step 7~12로 진행하지 않는다.**

---

## Step 6b: han-code-review 위임

⚡ fast 모드: han-code-review 스킵

커밋 전 변경사항을 종합 리뷰한다.

→ han-code-review 위임

han-code-review가 반환한 `REVIEW_STATUS`에 따라 진행 여부를 결정한다:

| REVIEW_STATUS | 동작 |
|---------------|------|
| `pass` | Step 7로 진행 |
| `blocked` | 수정 요청 후 대기 — Step 7~12로 진행하지 않음 |

---

## Step 7: 변경사항 커밋

### 7-1. 변경 파일 확인

```bash
STAGED=$(git diff --cached --name-only)
UNSTAGED=$(git diff --name-only)
UNTRACKED=$(git ls-files --others --exclude-standard)
```

| 상태 | 대응 |
|------|------|
| 모두 없음 | "커밋할 변경사항이 없습니다. 이미 커밋된 상태입니다." 출력 → HEAD SHA 사용 후 Step 8으로 |
| staged만 있음 | staged 파일 목록 출력 → 7-3으로 진행 |
| unstaged / untracked 있음 | 전체 목록 출력 → 사용자 선택 |

### 7-2. 커밋 범위 선택 (unstaged / untracked 있을 때)

```
변경된 파일:
  [staged]
    M  src/hwp/pdf/CPdfRenderer.cpp
  [unstaged]
    M  src/hwp/pdf/CPdfRenderer_test.cpp
  [untracked]
    (없음)

모든 변경사항을 커밋하시겠습니까?
  [1] 전체 커밋 (staged + unstaged 모두 add)
  [2] staged만 커밋
  [3] 파일 선택 후 재실행 (직접 git add 후 재실행)
  [0] 커밋 건너뛰기 (기존 HEAD 커밋 사용)
```

- `[1]`: `git add -A` 실행 → 7-3으로
- `[2]`: staged 그대로 → 7-3으로
- `[3]`: "커밋할 파일을 `git add`한 후 `/han-dev:han-code`를 다시 실행하세요." → 중단
- `[0]`: `COMMIT_SHA=$(git rev-parse --short HEAD)` → Step 8으로

### 7-3. 커밋 메시지 자동 생성

이슈 타입에 따른 커밋 타입:

| issue_type | 커밋 타입 |
|------------|----------|
| `버그` / `Bug` | `fix` |
| `작업` / `Task` | `feat` |
| 그 외 | `feat` (기본값) |

AI가 `git diff --cached --stat` 결과와 이슈 정보를 기반으로 커밋 메시지를 생성한다:

```
{type}({component}): {한줄 요약 — 한국어}

{변경 내용 요약 — 2~4줄, 한국어}

Closes: {ISSUE_KEY}
Confidence: {high|medium|low}
Scope-risk: {narrow|moderate|broad}
```

예시:
```
fix(pdf): 한글 폰트 렌더링 시 특수문자 깨짐 수정

PDF 변환 시 한글 폰트 매핑 테이블에서 특수문자 범위가
누락되어 렌더링 결과에 깨진 문자가 표시되던 문제 수정.
CJK Compatibility 영역(0xF900-0xFAFF) 매핑 추가.

Closes: AIAGENT-123
Confidence: high
Scope-risk: narrow
```

### 7-4. 사용자 확인

```
커밋 메시지:
────────────────────────────────────────
fix(pdf): 한글 폰트 렌더링 시 특수문자 깨짐 수정
...
────────────────────────────────────────
Enter → 그대로 진행 / 수정할 내용 입력:
```

- Enter(빈 입력) → 생성된 메시지로 커밋
- 텍스트 입력 → 입력된 내용을 커밋 메시지로 사용

### 7-5. 커밋 실행

```bash
git commit -m "$(cat <<'EOF'
{커밋 메시지}
EOF
)"

COMMIT_SHA=$(git rev-parse --short HEAD)
echo "✅ 커밋 완료: $COMMIT_SHA"
```

**커밋 실패 시 중단** — pre-commit hook 실패면 hook 오류 내용 출력 후 수정 안내.

---

## Step 8: han-mr 위임 (선택적)

```
GitLab Merge Request를 생성하시겠습니까?
  [1] MR 생성
  [2] 건너뛰기 (나중에 /han-dev:han-mr 로 생성 가능)
```

- `[1]` 선택 시:
  ```
  → han-mr 위임
  ```
  han-mr 실행 → `MR_IID`, `MR_URL` 반환
- `[2]` 선택 시: `MR_IID=null`, `MR_URL=null` → Step 9로 이동
- han-mr 위임 **실패 시**: 경고 출력 후 `MR_IID=null`로 Step 9 계속 진행 (best-effort)

---

## Step 8-5: CI 파이프라인 상태 확인 (선택적)

MR 생성 후 파이프라인 상태를 확인한다:

```bash
glab ci status 2>/dev/null || echo "파이프라인 정보를 가져올 수 없습니다."
```

| 상태 | 표시 | 처리 |
|------|------|------|
| `passed` | ✅ CI 통과 | 정상 진행 |
| `running` | ⏳ 파이프라인 실행 중 | "나중에 GitLab에서 결과를 확인하세요." 안내 |
| `failed` | ❌ CI 실패 | "GitLab MR에서 실패 로그를 확인하고 수정하세요." 권고 |
| 조회 불가 | ⚠️ 확인 불가 | GitLab에서 직접 확인 안내 (glab 미인증 또는 파이프라인 없음) |

> MR을 생성하지 않은 경우(`MR_IID=null`) 이 단계를 건너뛴다.

---

## Step 9: Jira Worklog 기록

### 9-1. 작업 시간 계산

```python
from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))
start = datetime.fromisoformat(start_time)
end = datetime.fromisoformat(code_done_time)
delta = end - start

# 분 단위 반올림 (30초 이상 올림)
total_seconds = int(delta.total_seconds())
total_minutes = (total_seconds + 29) // 60
rounded_seconds = total_minutes * 60

hours = total_minutes // 60
minutes = total_minutes % 60
display = f"{hours}시간 {minutes}분" if hours > 0 else f"{minutes}분"
```

`start_time`이 비어있으면: Worklog 자동 계산 불가
→ "⚠️ start_time이 없습니다. 작업 시간을 직접 입력하시겠습니까? (예: 1h30m, 45m, 엔터로 스킵)"
→ 입력 시: 해당 값으로 ROUNDED_SECONDS 계산 후 계속 진행
→ 스킵 시: worklog_seconds=0 처리 → Step 10으로

### 9-2. 사용자 확인

```
Jira Worklog 기록:
  작업 시간: {display} ({start_time} ~ {code_done_time})
  기록 대상: {ISSUE_KEY}

진행하시겠습니까? [Y/n]
```

- Y → Worklog API 호출
- n → 스킵 (worklog_seconds=0 저장)

### 9-3. Worklog 기록

`started` 포맷 변환 (python3 계산은 유지):
```python
from datetime import datetime
dt = datetime.fromisoformat(start_time)
started = dt.strftime('%Y-%m-%dT%H:%M:%S.000+0900')
```

# ROUNDED_SECONDS를 timeSpent 형식으로 변환 (예: 5400초 → "1h 30m")
hours = total_minutes // 60
mins = total_minutes % 60
time_spent = (f"{hours}h " if hours > 0 else "") + (f"{mins}m" if mins > 0 else "")
if not time_spent:
    time_spent = "1m"  # 최소 1분

→ mcp__atlassian__addWorklogToJiraIssue(cloudId: SITE_HOST, issueIdOrKey: ISSUE_KEY, timeSpent: time_spent, started: started)

실패 시: 1초 후 1회 재시도. 재실패 시 경고 출력 후 계속 진행 (best-effort).

---

## Step 10: Jira 작업 요약 코멘트

→ **han-common:han-comment {ISSUE_KEY} 위임**

MR이 생성된 경우 MR URL을 포함하여 위임한다.
코멘트 형식 및 ADF 변환은 `han-common:han-comment` 스킬이 처리한다.
실패 시: 경고 출력 후 계속 진행 (best-effort).

---

## Step 11: 컨텍스트 업데이트

```bash
python3 -c "
import json, os
from datetime import datetime, timezone, timedelta

SESSION_ID = os.environ.get('CLAUDE_SESSION_ID', 'default')
ctx_path = f'.han/state/sessions/{SESSION_ID}.json'

KST = timezone(timedelta(hours=9))
now = datetime.now(KST).isoformat()

with open(ctx_path, 'r') as f:
    ctx = json.load(f)

ctx['branch_name'] = '$BRANCH_NAME'
ctx['code_done_time'] = now
ctx['commit_sha'] = '$COMMIT_SHA'
ctx['mr_iid'] = $MR_IID
ctx['mr_url'] = ${MR_URL:+\"$MR_URL\"}
ctx['worklog_seconds'] = $ROUNDED_SECONDS
ctx['stage'] = 'code_done'

with open(ctx_path, 'w') as f:
    json.dump(ctx, f, ensure_ascii=False, indent=2)

print('컨텍스트 업데이트 완료')
"
```


---

## Step 12: 결과 요약

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ han-code (2단계: 개발) 완료
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 이슈: [{ISSUE_KEY}] {ISSUE_TITLE}
🌿 브랜치: {BRANCH_NAME}
🔄 Jira: {이전 상태} → In Progress
🧪 TDD: 테스트 통과
🔒 보안: 검토 완료
📝 커밋: {COMMIT_SHA}
🔗 MR: {MR_URL 또는 "미생성 (/han-dev:han-mr 로 생성 가능)"}
⏱  작업시간: {display}
💬 코멘트: 작업 요약 기록 완료
────────────────────────────────────────
→ 이슈 완료 시: /han-dev:han-close  (Jira 상태 → Resolved)
```

---

## 에러 처리

| 상황 | 대응 |
|------|------|
| han-config.md 없음 | "/han-dev:han-dev-setup 을 먼저 실행하세요." 후 중단 |
| 환경변수 미설정 | `export JIRA_USER=...` 방법 안내 후 중단 |
| 세션 컨텍스트 파일 없음 | standalone 모드로 전환 — 인자 또는 사용자 입력으로 진행 |
| stage == tdd_done | "보안 검토 단계(Step 6)부터 재개" 안내 후 Step 6로 점프 |
| stage == security_blocked | "보안 이슈 수정 후 /han-dev:han-security 재실행" 안내 후 중단 |
| stage == code_done | "이미 완료. /han-dev:han-close 실행" 안내 후 중단 |
| stage가 위 외의 값 | 경고 출력 후 사용자 확인 (계속/중단 선택) |
| glab 인증 실패 | "glab auth login --hostname gitlab.hancom.com" 안내 후 중단 |
| Jira In Progress 전환 불가 | 가능한 상태 목록 출력 후 선택 요청 (0 입력 시 스킵) |
| han-branch 실패 | 에러 메시지 출력 후 중단 |
| han-analyze 실패 | 에러 메시지 출력 후 수동 분석 안내 |
| han-tdd 실패 | 테스트 실패 내용 출력 후 수정 안내 |
| han-security 실패 | 보안 이슈 목록 출력 후 수정 안내 |
| git commit 실패 | pre-commit hook 실패 시 수정 안내 후 중단 |
| han-mr 위임 실패 | 경고 출력 후 MR_IID=null로 Step 9 계속 진행 (best-effort) |
| Worklog API 실패 | 1초 후 1회 재시도. 재실패 시 경고 출력 후 계속 진행 |
| Jira 코멘트 실패 | 경고 출력 후 Step 11 진행 (best-effort) |
| 서버 오류 (5xx) | 1초 후 1회 재시도. 재실패 시 오류 코드 출력 후 중단 |

---

## 하위 스킬 위임 관계

```
han-code
├── han-branch     브랜치 생성 (Step 2)
├── han-analyze    코드 분석 + side-effect 파악 (Step 4)
├── han-tdd        TDD 사이클: 테스트 → 구현 → 리팩토링 (Step 5)
├── han-security   보안 검토 (Step 6)
├── han-mr         MR 생성 (Step 8)
└── han-comment    Jira 코멘트 (Step 10)
```
