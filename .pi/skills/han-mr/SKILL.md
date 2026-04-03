---
name: han-mr
description: GitLab Merge Request 생성 전용 sub-skill. 이슈 정보를 자동 추출하여 MR 제목/설명을 생성하고 glab CLI로 MR을 생성한다. 독립 단독 실행 지원. "MR", "MR 생성", "MR 만들어", "MR 올려줘", "머지 리퀘스트", "merge request", "MR 생성해줘" 등에 반응한다.
user_invocable: true
argument: "[ISSUE_KEY] — 예: 'AIAGENT-123'. 생략 시 세션 컨텍스트 또는 현재 브랜치명에서 자동 추출한다."
---

# GitLab MR 생성 워크플로우

개발 컨텍스트의 브랜치/이슈 정보를 기반으로 GitLab Merge Request를 생성한다.
han-close(3단계)에서 위임받거나, 독립적으로 단독 실행할 수 있다.

```
[이 스킬의 범위]
✅ 원격 push 확인 및 자동 push
✅ MR 제목 자동 생성 (한컴 컨벤션: [{ISSUE_KEY}] {요약})
✅ MR 설명 자동 생성 (변경 내용, 테스트, 관련 이슈)
✅ 타겟 브랜치 결정 (config의 DEFAULT_BRANCH)
✅ 사용자 확인 후 glab mr create 실행
✅ 기존 MR 존재 시 재사용
❌ 커밋 (→ han-close 담당)
❌ 컨텍스트 파일 업데이트 (→ han-close Step 7이 처리)
❌ Jira 상태 전환 (→ han-close 담당)
```

---

## Step 0: 환경 설정 로드

> **중요**: GitLab 관련 모든 작업은 반드시 `glab` CLI를 통해 수행한다.
> GITLAB_TOKEN, PRIVATE_TOKEN 등 환경변수 탐색이나 curl/REST API 직접 호출은 절대 시도하지 않는다.

`~/.config/han/han-config.md` 읽기:
- 파일 없음 → **"/han-dev:han-dev-setup 을 먼저 실행하세요."** 출력 후 중단

추출 값:

| 변수 | 섹션 | 키 |
|------|------|----|
| `GITLAB_BASE` | GitLab | Base URL |
| `DEFAULT_BRANCH` | GitLab | 기본 브랜치 |

GitLab 인증 확인 (`glab` 단독 사용):
```bash
if ! glab auth status &>/dev/null; then
  echo "GitLab 인증이 필요합니다."
  echo "실행: glab auth login --hostname gitlab.hancom.io"
  # 중단
fi
```

---

## Step 1: 컨텍스트 로드

3단계 우선순위로 `ISSUE_KEY`, `ISSUE_TITLE`, `BRANCH_NAME`을 결정한다.
먼저 매칭되는 단계에서 확정하고 이후 단계는 건너뛴다.

### 1-1. 인자 우선 (사용자 직접 전달)

스킬 인자로 이슈 키가 전달된 경우:

```
/han-dev:han-mr AIAGENT-123
```

- `ISSUE_KEY` = 인자값
- `BRANCH_NAME` = `git branch --show-current`
- Atlassian MCP로 이슈 제목 조회:
  ```
  → mcp__atlassian__get_issue(issueIdOrKey: ISSUE_KEY, fields: "summary")
  ```
  `ISSUE_TITLE` = 조회된 summary 값
- Jira 조회 실패 시 → `AskUserQuestion`으로 MR 제목 직접 입력

### 1-2. 세션 컨텍스트 (오케스트레이션 환경)

인자가 없으면 세션 컨텍스트 파일을 시도한다:

```bash
SESSION_ID="${CLAUDE_SESSION_ID:-default}"
CTX_PATH=".han/state/sessions/${SESSION_ID}.json"
```

파일이 존재하면 → `issue_key`, `issue_title`, `branch_name` 추출:

```bash
CTX=$(cat "$CTX_PATH")
ISSUE_KEY=$(echo "$CTX" | python3 -c "import json,sys; print(json.load(sys.stdin)['issue_key'])")
ISSUE_TITLE=$(echo "$CTX" | python3 -c "import json,sys; print(json.load(sys.stdin)['issue_title'])")
BRANCH_NAME=$(echo "$CTX" | python3 -c "import json,sys; print(json.load(sys.stdin).get('branch_name',''))")
```

### 1-3. 브랜치명 추론 (standalone, 인자 없음)

인자도 없고 세션 컨텍스트 파일도 없으면 현재 브랜치에서 추론한다:

```bash
BRANCH_NAME=$(git branch --show-current)
```

**브랜치명에서 이슈 키 추출:**

한컴 브랜치 컨벤션 `{type}/{ISSUE_KEY}-{설명}` 에서 이슈 키를 파싱한다:

```bash
# 예: fix/AIAGENT-123-hangul-font → AIAGENT-123
# 예: feat/AIAGENT-456-new-feature → AIAGENT-456
ISSUE_KEY=$(echo "$BRANCH_NAME" | grep -oP '[A-Z][A-Z0-9]+-\d+' | head -1)
```

- **추출 성공** → Atlassian MCP로 이슈 제목 조회하여 `ISSUE_TITLE` 획득
- **추출 실패** → `AskUserQuestion`으로 이슈 키 입력 요청:
  > 이슈 키를 입력하세요 (예: AIAGENT-123). 없으면 Enter:

  - 입력 있음 → Jira 조회하여 `ISSUE_TITLE` 획득
  - 입력 없음 → `AskUserQuestion`으로 MR 제목 직접 입력받기 (`ISSUE_KEY` = 빈 문자열)

### 1-4. BRANCH_NAME 최종 확인

`BRANCH_NAME`이 비어있으면 `git branch --show-current`로 대체.
`BRANCH_NAME`이 `DEFAULT_BRANCH`와 동일하면 → "기본 브랜치에서는 MR을 생성할 수 없습니다." 출력 후 **중단**.

---

## Step 2: 원격 push 확인

```bash
# 현재 브랜치의 원격 추적 확인
REMOTE_BRANCH=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null)

if [ -z "$REMOTE_BRANCH" ]; then
  echo "원격 브랜치가 없습니다. push합니다..."
  git push -u origin "$BRANCH_NAME"
else
  # 로컬 커밋이 원격보다 앞서 있으면 push
  LOCAL_SHA=$(git rev-parse HEAD)
  REMOTE_SHA=$(git rev-parse "origin/$BRANCH_NAME" 2>/dev/null || echo "")

  if [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then
    echo "원격에 push되지 않은 커밋이 있습니다. push합니다..."
    git push origin "$BRANCH_NAME"
  else
    echo "원격 브랜치 최신 상태 확인 완료"
  fi
fi
```

push 실패 시: 권한 확인 안내, `glab auth status` 출력 후 **중단**.

---

## Step 3: MR 제목/설명 생성

### MR 제목

이슈 키 유무에 따라 제목 형식이 달라진다:

- **이슈 키 있음** → 한컴 MR 제목 컨벤션: `[{ISSUE_KEY}] {ISSUE_TITLE}`
  ```bash
  MR_TITLE="[${ISSUE_KEY}] ${ISSUE_TITLE}"
  ```
  예시: `[AIAGENT-123] [PDF] 한글 폰트 렌더링 오류`

- **이슈 키 없음** (standalone, 이슈 미연결) → `ISSUE_TITLE`만 사용:
  ```bash
  MR_TITLE="${ISSUE_TITLE}"
  ```
  예시: `한글 폰트 렌더링 오류 수정`

### MR 설명

AI가 다음 정보를 기반으로 생성한다:

**입력**:
- `git log --oneline origin/$DEFAULT_BRANCH..HEAD` — 커밋 목록
- `git diff --stat origin/$DEFAULT_BRANCH..HEAD` — 변경 파일 통계
- `ISSUE_KEY`, `ISSUE_TITLE` — 이슈 정보

**생성 형식** (마크다운):

```markdown
## 변경 내용

{AI가 커밋 목록 + diff stat 기반으로 3~5줄 요약}

## 변경 파일

{git diff --stat 출력}

## 테스트

- {han-tdd 결과 또는 테스트 방법 요약}

## 관련 이슈

- Closes {ISSUE_KEY}
- Jira: {API_BASE}/browse/{ISSUE_KEY}
```

> 설명은 `/tmp/han-mr-description.md`에 임시 저장

---

## Step 4: 사용자 확인

```
MR 정보:
────────────────────────────────────────
제목: [{ISSUE_KEY}] {ISSUE_TITLE}
소스: {BRANCH_NAME}
타겟: {DEFAULT_BRANCH}
────────────────────────────────────────
{MR 설명 미리보기 (처음 20줄)}
────────────────────────────────────────
Enter → 그대로 진행 / 수정할 제목 입력:
```

- Enter(빈 입력) → 생성된 제목으로 진행
- 텍스트 입력 → 입력값을 MR 제목으로 사용

---

## Step 5: glab mr create 실행

```bash
MR_OUTPUT=$(glab mr create \
  --title "$MR_TITLE" \
  --description "$(cat /tmp/han-mr-description.md)" \
  --source-branch "$BRANCH_NAME" \
  --target-branch "$DEFAULT_BRANCH" \
  --output json 2>&1)

EXIT_CODE=$?
rm -f /tmp/han-mr-description.md
```

### 기존 MR 존재 시 처리

glab이 "already exists" 오류를 반환하면:

```bash
EXISTING_MR=$(glab mr list \
  --source-branch "$BRANCH_NAME" \
  --output json 2>/dev/null | \
  python3 -c "
import json, sys
try:
    mrs = json.load(sys.stdin)
    if mrs:
        print(mrs[0]['iid'])
except:
    pass
")

if [ -n "$EXISTING_MR" ]; then
  echo "이 브랜치에 이미 MR이 존재합니다: !$EXISTING_MR"
  echo "기존 MR을 사용합니다."
  MR_IID=$EXISTING_MR
  MR_URL=$(glab mr view "$EXISTING_MR" --output json | \
    python3 -c "import json,sys; print(json.load(sys.stdin)['web_url'])")
fi
```

그 외 실패 시: 1초 후 1회 재시도. 재실패 시 **중단**.

### 성공 시 결과 추출

```bash
MR_IID=$(echo "$MR_OUTPUT" | python3 -c "import json,sys; print(json.load(sys.stdin)['iid'])")
MR_URL=$(echo "$MR_OUTPUT" | python3 -c "import json,sys; print(json.load(sys.stdin)['web_url'])")
```

---

## Step 6: 결과 반환

```
✅ MR 생성 완료: !{MR_IID}
   {MR_URL}
```

반환값:

| 변수 | 예시 | 용도 |
|------|------|------|
| `MR_IID` | `42` | han-close Step 7에서 컨텍스트 저장 |
| `MR_URL` | `https://gitlab.hancom.com/.../merge_requests/42` | han-close 코멘트, 결과 출력 |

> 컨텍스트 파일 업데이트는 하지 않음 — han-close가 Step 7에서 처리 (han-branch와 동일한 패턴)

---

## 에러 처리

| 상황 | 대응 |
|------|------|
| 세션 컨텍스트 파일 없음 | standalone 모드로 전환 — 브랜치명에서 이슈 키 추론 |
| 브랜치명에서 이슈 키 추출 실패 | 사용자에게 이슈 키 입력 요청, 없으면 이슈 미연결로 진행 |
| Jira 이슈 조회 실패 | 사용자에게 MR 제목 직접 입력 요청 |
| han-config.md 없음 | "/han-dev:han-dev-setup 을 먼저 실행하세요." 후 중단 |
| glab 인증 실패 | "glab auth login --hostname {호스트}" 안내 후 중단 |
| git push 실패 | 권한 확인 안내, `glab auth status` 출력 후 중단 |
| MR 이미 존재 | 기존 MR 정보를 사용하여 계속 진행 |
| glab mr create 기타 실패 | 1초 후 1회 재시도. 재실패 시 에러 메시지 출력 후 중단 |
| branch_name 없음 | `git branch --show-current`로 대체 후 계속 진행 |
| DEFAULT_BRANCH와 현재 브랜치 동일 | "기본 브랜치에서는 MR을 생성할 수 없습니다." 후 중단 |

---

## 예시 실행 흐름

### Happy Path — 세션 컨텍스트 있음 (han-close 위임)

```
$ /han-dev:han-mr

[Step 0] 환경 설정 로드 완료
[Step 1] 세션 컨텍스트 로드: AIAGENT-123, 브랜치: fix/AIAGENT-123-hangul-font-rendering
[Step 2] 원격 브랜치 최신 상태 확인 완료

MR 정보:
────────────────────────────────────────
제목: [AIAGENT-123] [PDF] 한글 폰트 렌더링 오류
소스: fix/AIAGENT-123-hangul-font-rendering
타겟: develop
────────────────────────────────────────
## 변경 내용
PDF 변환 시 한글 폰트 매핑 테이블에서...
────────────────────────────────────────
Enter → 그대로 진행  ← 사용자 Enter

✅ MR 생성 완료: !42
   https://gitlab.hancom.com/ai-native/assistant/merge_requests/42
```

### Happy Path — standalone (세션 컨텍스트 없음)

```
$ /han-dev:han-mr

[Step 0] 환경 설정 로드 완료
[Step 1] 세션 컨텍스트 없음 → standalone 모드
         브랜치: fix/AIAGENT-456-search-bug
         이슈 키 추출: AIAGENT-456
         Jira 조회: "검색 결과 정렬 오류"
[Step 2] 원격 브랜치 최신 상태 확인 완료

MR 정보:
────────────────────────────────────────
제목: [AIAGENT-456] 검색 결과 정렬 오류
소스: fix/AIAGENT-456-search-bug
타겟: develop
────────────────────────────────────────
...

✅ MR 생성 완료: !45
   https://gitlab.hancom.io/.../merge_requests/45
```

### 예외: 기존 MR 존재

```
[Step 5] glab mr create 실행 중...
이 브랜치에 이미 MR이 존재합니다: !38
기존 MR을 사용합니다.

✅ MR 완료: !38 — https://gitlab.hancom.io/.../merge_requests/38
```
