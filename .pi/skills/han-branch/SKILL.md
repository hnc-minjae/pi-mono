---
name: han-branch
description: 브랜치 생성 전용 sub-skill. 이슈 정보를 기반으로 컨벤션에 맞는 브랜치를 생성한다. 독립 단독 실행 지원. "브랜치", "브랜치 생성", "브랜치 만들어", "브랜치 따줘", "branch", "branch 생성" 등에 반응한다.
user_invocable: true
argument: "[ISSUE_KEY] — 예: 'AIAGENT-123'. 생략 시 세션 컨텍스트 또는 사용자 입력으로 결정한다."
---

# 브랜치 생성 워크플로우

개발 컨텍스트의 이슈 정보를 기반으로 컨벤션에 맞는 브랜치를 생성한다.
han-code(2단계)에서 위임받거나, 독립적으로 실행할 수 있다.

```
[이 스킬의 범위]
✅ 이슈 타입 → 브랜치 prefix 매핑
✅ 이슈 제목 → 영문 slug 자동 생성
✅ 브랜치 생성 및 원격 push
✅ 사용자 확인 후 진행
❌ 컨텍스트 파일 생성 (→ han-start 담당)
❌ 컨텍스트 업데이트 (→ han-code 담당)
❌ Jira 상태 전환 (→ han-code 담당)
```

---

## Step 0: 환경 설정 로드

`~/.config/han/han-config.md` 읽기:
- 파일 없음 → **"/han-dev:han-dev-setup 을 먼저 실행하세요."** 출력 후 중단

추출 값:

| 변수 | 섹션 | 키 |
|------|------|----|
| `GITLAB_BASE` | GitLab | Base URL |
| `DEFAULT_BRANCH` | GitLab | 기본 브랜치 |

GitLab 인증 확인:
```bash
if ! glab auth status &>/dev/null; then
  echo "GitLab 인증이 필요합니다."
  echo "실행: glab auth login --hostname gitlab.hancom.com"
  # 중단
fi
```

---

## Step 1: 컨텍스트 로드

3단계 우선순위로 `ISSUE_KEY`, `ISSUE_TITLE`, `ISSUE_TYPE`을 결정한다.
먼저 매칭되는 단계에서 확정하고 이후 단계는 건너뛴다.

### 1-1. 인자 우선 (사용자 직접 전달)

스킬 인자로 이슈 키가 전달된 경우:

```
/han-dev:han-branch AIAGENT-123
```

- `ISSUE_KEY` = 인자값
- Atlassian MCP로 이슈 정보 조회:
  ```
  → mcp__atlassian__get_issue(issueIdOrKey: ISSUE_KEY, fields: "summary,issuetype")
  ```
  `ISSUE_TITLE` = summary, `ISSUE_TYPE` = issuetype.name

### 1-2. 세션 컨텍스트 (오케스트레이션 환경)

인자가 없으면 세션 컨텍스트 파일을 시도한다:

```bash
SESSION_ID="${CLAUDE_SESSION_ID:-default}"
CTX_PATH=".han/state/sessions/${SESSION_ID}.json"
```

파일이 존재하면 → `issue_key`, `issue_title`, `issue_type` 추출:

```bash
CTX=$(cat "$CTX_PATH")
ISSUE_KEY=$(echo "$CTX" | python3 -c "import json,sys; print(json.load(sys.stdin)['issue_key'])")
ISSUE_TITLE=$(echo "$CTX" | python3 -c "import json,sys; print(json.load(sys.stdin)['issue_title'])")
ISSUE_TYPE=$(echo "$CTX" | python3 -c "import json,sys; print(json.load(sys.stdin)['issue_type'])")
```

### 1-3. 사용자 입력 (standalone, 인자 없음)

인자도 없고 세션 컨텍스트 파일도 없으면 `AskUserQuestion`으로 입력받는다:

> 브랜치를 생성할 이슈 키를 입력하세요 (예: AIAGENT-123):

- 입력 있음 → Atlassian MCP로 이슈 정보 조회 (`ISSUE_TITLE`, `ISSUE_TYPE` 획득)
- Jira 조회 실패 시 → `AskUserQuestion`으로 이슈 제목과 타입(Bug/Task) 직접 입력

---

## Step 2: 브랜치명 생성

### 2-1. prefix 결정

`issue_type` 매핑 (한국어/영어 모두 처리):

| issue_type | prefix |
|------------|--------|
| `버그` 또는 `Bug` | `fix` |
| `작업` 또는 `Task` | `feature` |
| 그 외 | `feature` (기본값) |

```bash
case "$ISSUE_TYPE" in
  "버그"|"Bug")  PREFIX="fix" ;;
  "작업"|"Task") PREFIX="feature" ;;
  *)             PREFIX="feature" ;;
esac
```

### 2-2. slug 생성

AI가 이슈 제목에서 영문 slug을 생성한다:

- 한글 키워드를 의미 있는 영문으로 변환
- 3~5단어, 하이픈(`-`) 구분
- 소문자만 사용
- `[컴포넌트]` 태그는 slug에서 제외

변환 예시:

| 이슈 제목 | slug |
|-----------|------|
| `[PDF] 한글 폰트 렌더링 오류` | `hangul-font-rendering` |
| `[UI] 내보내기 옵션 추가` | `add-export-options` |
| `[Core] 문서 저장 시 메모리 누수` | `memory-leak-on-save` |

### 2-3. 최종 브랜치명 조합

```
{PREFIX}/{ISSUE_KEY}-{slug}
```

예시:
- `fix/AIAGENT-123-hangul-font-rendering`
- `feature/AIAGENT-456-add-export-options`

---

## Step 3: 사용자 확인

브랜치명 초안을 출력하고 사용자 확인을 받는다:

```
🌿 브랜치명: fix/AIAGENT-123-hangul-font-rendering
   Enter → 그대로 진행 / 수정할 이름 입력:
```

- Enter(빈 입력) → 초안 그대로 사용
- 텍스트 입력 → 입력값을 브랜치명으로 사용

---

## Step 4: 브랜치 생성 및 push

```bash
# 최신 원격 정보 가져오기
git fetch origin

# 기본 브랜치 기반으로 새 브랜치 생성
git checkout -b "$BRANCH_NAME" "origin/$DEFAULT_BRANCH"
```

브랜치가 이미 존재하는 경우:
```bash
# 로컬에 이미 존재
if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
  echo "로컬 브랜치가 이미 존재합니다. checkout합니다."
  git checkout "$BRANCH_NAME"
fi

# 원격에 이미 존재
if git ls-remote --heads origin "$BRANCH_NAME" | grep -q "$BRANCH_NAME"; then
  echo "원격 브랜치가 이미 존재합니다. checkout합니다."
  git checkout -b "$BRANCH_NAME" "origin/$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
fi
```

원격 push:
```bash
git push -u origin "$BRANCH_NAME"
```

---

## Step 5: 결과 반환

```
✅ 브랜치 생성 완료: fix/AIAGENT-123-hangul-font-rendering
```

`BRANCH_NAME` 값을 호출자(han-code)에게 반환한다.

> 컨텍스트 파일 업데이트는 하지 않음 — han-code가 Step 7에서 처리

---

## 에러 처리

| 상황 | 대응 |
|------|------|
| 세션 컨텍스트 파일 없음 | standalone 모드로 전환 — 인자 또는 사용자 입력으로 진행 |
| han-config.md 없음 | "/han-dev:han-dev-setup 을 먼저 실행하세요." 후 중단 |
| git 저장소 아님 | "git 저장소가 아닙니다. 프로젝트 루트로 이동하세요." 후 중단 |
| glab 인증 실패 | "glab auth login --hostname gitlab.hancom.com" 안내 후 중단 |
| 브랜치 이미 존재 (로컬) | 기존 브랜치 checkout 후 계속 진행 |
| 브랜치 이미 존재 (원격) | 원격 브랜치 기반 checkout 후 계속 진행 |
| git fetch 실패 | 네트워크 확인 안내 후 중단 |
| git push 실패 | 권한 확인 안내, `glab auth status` 출력 후 중단 |
