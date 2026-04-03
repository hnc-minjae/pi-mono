---
name: han-close
description: 한컴 개발 3단계(마무리). Jira 이슈 상태를 Resolved로 전환한다. 커밋/MR/Worklog/코멘트는 han-code가 처리하므로, 이 스킬은 이슈의 최종 상태 전환만 담당한다. "완료", "완료합니다", "마무리", "마무리할게요", "이슈 닫기", "Resolved", "끝났습니다", "다 했습니다" 등에 반응한다.
user_invocable: true
argument: "[없음] — han-code가 저장한 컨텍스트(.han/state/sessions/{SESSION_ID}.json)를 자동으로 읽는다."
---

# 마무리 워크플로우 (3단계)

Jira 이슈 상태를 Resolved로 전환하는 마무리 스킬이다.
커밋/MR/Worklog/코멘트는 han-code(2단계)에서 이미 처리했으므로, 이 스킬은 이슈의 최종 상태 전환만 담당한다.

```
[이 스킬의 범위]
✅ 환경 설정 로드
✅ 컨텍스트 로드
✅ Jira 상태 전환 (→ Resolved, 사용자 확인 후)
✅ 컨텍스트 업데이트 (stage=close_done)
❌ 커밋 (→ han-code 담당)
❌ MR 생성 (→ han-code 담당)
❌ Worklog (→ han-code 담당)
❌ 코멘트 (→ han-code 담당)
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
    API_BASE     = ctx['api_base']
    USER_EMAIL   = ctx.get('user_email', '')
    JIRA_USER    = os.environ.get('JIRA_USER', '') or USER_EMAIL
    JIRA_TOKEN   = os.environ.get('JIRA_TOKEN', '')
    # Step 0 완료 — Step 1로 진행
else:
    # 독립 실행: han-config.md에서 직접 로드
    pass
```

**독립 실행 시** (han_dev_managed 없음):

`~/.config/han/han-config.md` 읽기:
- 파일 없음 → **"/han-dev:han-dev-setup 을 먼저 실행하세요."** 출력 후 중단

추출 값:

| 변수 | 섹션 | 키 | 기본값 |
|------|------|----|--------|
| `API_BASE` | Atlassian | Base URL | — |
| `USER_EMAIL` | 개인 정보 | 이메일 | — |

JIRA_USER, JIRA_TOKEN 환경변수 확인:
- `[ -z "$JIRA_USER" ] && JIRA_USER="$USER_EMAIL"` (이메일 폴백)
- `JIRA_USER` 또는 `JIRA_TOKEN`이 비어있으면 "/han-dev:han-dev-setup 을 먼저 실행하세요." 후 중단

> han-close는 Jira 상태 전환만 수행하므로 GitLab 인증은 불필요하다.

---

## Step 1: 컨텍스트 로드

`.han/state/sessions/{SESSION_ID}.json` 읽기:

```bash
SESSION_ID="${CLAUDE_SESSION_ID:-default}"
CTX_PATH=".han/state/sessions/${SESSION_ID}.json"

if [ ! -f "$CTX_PATH" ]; then
  echo "⚠️  세션 컨텍스트가 없습니다."
  ISSUE_KEY=""
  STAGE=""
else
  CTX=$(cat "$CTX_PATH")
  STAGE=$(echo "$CTX" | python3 -c "import json,sys; print(json.load(sys.stdin).get('stage',''))")
  ISSUE_KEY=$(echo "$CTX" | python3 -c "import json,sys; print(json.load(sys.stdin).get('issue_key',''))")
  ISSUE_TITLE=$(echo "$CTX" | python3 -c "import json,sys; print(json.load(sys.stdin).get('issue_title',''))")
  BRANCH_NAME=$(echo "$CTX" | python3 -c "import json,sys; print(json.load(sys.stdin).get('branch_name',''))")
fi
```

`ISSUE_KEY`가 비어있으면 사용자에게 직접 입력받는다:

> 이슈 키를 입력하세요 (예: AIAGENT-123, 없으면 엔터로 스킵):

- 입력 시 → ISSUE_KEY 설정
- 스킵 시 → "이슈 없이 계속합니다." 출력 후 Step 2로 (상태 전환 스킵)

stage 검증:

| stage 값 | 대응 |
|-----------|------|
| `code_done` | 정상 진행 (Step 2로) |
| `close_done` | "이미 마무리 완료된 이슈입니다. 새 이슈를 시작하려면 `/han-dev:han-start` 를 실행하세요." 출력 → 중단 |
| `pre_done` | "코드 작업이 완료되지 않았습니다. `/han-dev:han-code` 를 먼저 실행하세요." 출력 → 중단 |
| `tdd_done` | "보안 검토가 완료되지 않았습니다. `/han-dev:han-code` 를 재실행하세요." 출력 → 중단 |
| `security_blocked` | "보안 이슈가 차단 중입니다. `/han-dev:han-security` 로 해결 후 `/han-dev:han-code` 를 재실행하세요." 출력 → 중단 |
| 그 외 | 경고 출력 후 계속 진행할지 사용자 확인 (Y/n) |

---

## Step 2: Jira 상태 전환

> **중요**: 코드 수정 완료가 이슈 완료를 의미하지 않는다. 다른 작업이 남아있을 수 있으므로 상태 전환은 **반드시 사용자 확인 후** 진행한다.
> Done(종료)는 절대 자동 전환하지 않는다. 전환 대상은 **Resolved(해결됨)**까지만 허용한다.

`ISSUE_KEY`가 비어있으면 이 Step을 스킵한다.

### 2-1. 사용자 확인

`AskUserQuestion`으로 상태 전환 여부를 묻는다:

> 이슈 상태를 Resolved로 전환할까요?
> - 이 이슈에 다른 작업이 남아있으면 '아니오'를 선택하세요.

- **예** → 2-2로 진행
- **아니오** → "상태 전환을 건너뜁니다." 출력 후 Step 3으로 스킵

### 2-2. cloudId 준비

API_BASE에서 호스트를 추출하여 MCP의 cloudId로 사용한다:
```
SITE_HOST = API_BASE에서 호스트 추출 (예: https://hancom.atlassian.net → hancom.atlassian.net)
```

### 2-3. 현재 상태 확인

→ `mcp__atlassian__getJiraIssue` 호출:
  - cloudId: SITE_HOST
  - issueIdOrKey: ISSUE_KEY
  - fields: "status"

CURRENT_STATUS = 응답의 status.name 값

이미 `Resolved` 또는 `해결됨`이면 → "이미 Resolved 상태입니다." 출력 후 Step 3으로 스킵.

### 2-4. 전환 가능 목록 조회

→ `mcp__atlassian__getTransitionsForJiraIssue` 호출:
  - cloudId: SITE_HOST
  - issueIdOrKey: ISSUE_KEY

반환된 transitions에서 to.name이 `Resolved` 또는 `해결됨`인 항목의 id 추출 → `RESOLVED_ID`

### 2-5. 상태 전환 실행

`RESOLVED_ID`가 있으면:
→ `mcp__atlassian__transitionJiraIssue` 호출:
  - cloudId: SITE_HOST
  - issueIdOrKey: ISSUE_KEY
  - transition: {"id": RESOLVED_ID}
- 출력: "상태 전환 완료: {CURRENT_STATUS} → Resolved"

`RESOLVED_ID`가 없으면:
```
Resolved로 직접 전환할 수 없습니다. 가능한 전환 상태:
  [1] {전환명1}
  [2] {전환명2}
번호 선택 (건너뛰려면 0):
```
- 사용자 선택 → 선택한 전환의 id를 사용하여 `mcp__atlassian__transitionJiraIssue` 호출:
    - cloudId: SITE_HOST
    - issueIdOrKey: ISSUE_KEY
    - transition: {"id": 선택한 전환의 id}
- 0 입력 시: "⚠️ 상태 전환은 수동으로 진행하세요." 출력

실패 시: 경고 출력 후 계속 진행 (best-effort).

---

## Step 3: 컨텍스트 업데이트

```bash
python3 -c "
import json, os
from datetime import datetime, timezone, timedelta

SESSION_ID = os.environ.get('CLAUDE_SESSION_ID', 'default')
ctx_path = f'.han/state/sessions/{SESSION_ID}.json'

KST = timezone(timedelta(hours=9))
now = datetime.now(KST).isoformat()

ctx = json.load(open(ctx_path)) if os.path.exists(ctx_path) else {}
ctx['close_done_time'] = now
ctx['stage'] = 'close_done'

with open(ctx_path, 'w') as f:
    json.dump(ctx, f, ensure_ascii=False, indent=2)

print('컨텍스트 업데이트 완료')
"
```

---

## Step 4: 결과 요약

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ han-close (3단계: 마무리) 완료
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 이슈:   [{ISSUE_KEY}] {ISSUE_TITLE}
🌿 브랜치: {BRANCH_NAME}
🔄 Jira:   {이전 상태} → Resolved (또는 스킵됨)
────────────────────────────────────────
  한 사이클 완료. 새 이슈를 시작하려면:
  → /han-dev:han-start
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 에러 처리

| 상황 | 중단 여부 | 대응 |
|------|-----------|------|
| han-config.md 없음 | **중단** | "/han-dev:han-dev-setup 을 먼저 실행하세요." |
| 세션 컨텍스트 없음 | **계속** | 이슈 키 직접 입력 요청 |
| stage != code_done | **중단** | stage별 안내 메시지 |
| issue_key 비어있음 | **계속** | 사용자 직접 입력 또는 스킵 (상태 전환 생략) |
| Jira 상태 전환 실패 | **계속** | 가능 상태 목록 제시 → 선택 또는 스킵 |
| 서버 오류 (5xx) | **계속** | 1초 후 1회 재시도. 재실패 시 해당 Step 스킵 |

---

## 하위 스킬 위임 관계

```
han-close
└── [MCP 직접 호출] Jira 상태 전환 — mcp__atlassian__* (Step 2, 사용자 확인 후)

[위임 없음 — 커밋/MR/Worklog/코멘트는 han-code가 처리]
```

---

## 참조

- Jira REST API — MCP Atlassian 도구 직접 호출 (mcp__atlassian__getJiraIssue, mcp__atlassian__getTransitionsForJiraIssue, mcp__atlassian__transitionJiraIssue)
- glab CLI — GitLab MR/파이프라인 조회 (`glab mr create`, `glab ci status` 등)
