---
name: han-dev-setup
description: 한컴 AI 개발 환경 초기 설정. ~/.config/han/han-config.md 파일을 대화형으로 생성·수정한다. "han 설정", "한컴 설정", "setup", "환경 설정", "초기 설정", "han-setup" 등에 반응한다.
user_invocable: true
argument: "(없음) — 대화형으로 설정을 진행합니다"
---

# 한컴 개발 환경 설정 마법사

전역 설정 파일(`~/.config/han/han-config.md`)을 생성하거나 수정한다.
모든 han-* 스킬은 이 파일에서 URL, 개인 정보, 인증 정보를 읽는다.

---

## Step 1: 기존 설정 확인

```bash
cat ~/.config/han/han-config.md 2>/dev/null
```

- 파일이 존재하면 → 현재 설정을 출력하고 **수정 메뉴**로 이동 (Step 2)
- 파일이 없으면 → **최초 설정**으로 이동 (Step 2 최초)

---

## Step 2: 최초 설정 (파일 없을 때)

사용자에게 아래 항목을 순서대로 질문한다.
`AskUserQuestion` 도구를 사용하여 각 항목을 입력받는다.
빈 값이면 괄호 안의 기본값을 사용한다.

| 항목 | 질문 | 기본값 |
|------|------|--------|
| Atlassian Base URL | Atlassian Base URL을 입력하세요 | `https://hancom.atlassian.net` |
| GitLab Base URL | GitLab Base URL을 입력하세요 | `https://gitlab.hancom.io` |
| GitLab 기본 브랜치 | GitLab 기본 브랜치명을 입력하세요 | `develop` |
| 이름 | 이름을 입력하세요 (예: 홍길동) | `{이름}` |
| 소속 | 소속(사업부/본부)을 입력하세요 (예: AI사업부) | `{소속}` |
| 부서 | 부서(팀)를 입력하세요 (예: AI개발팀) | `{부서}` |
| 이메일 | 회사 이메일을 입력하세요 (예: user@hancom.com) | `{이메일}` |
| 마감 경고 기준일 | 마감 임박 경고 기준일 (숫자) | `7` |
| 개발 모드 (dev_mode) | 코드 구현 전 승인 요구 여부. `manual`=구현 전 계획 승인 필요, `auto`=자동 구현 | `manual` |
| Jira 이메일 (JIRA_USER) | Jira/Atlassian REST API 인증용 이메일을 입력하세요. 이메일과 동일하면 Enter. | `{이메일}` |
| Jira API 토큰 (JIRA_TOKEN) | Atlassian API 토큰을 입력하세요. 발급: https://id.atlassian.com/manage-profile/security/api-tokens | `{API_TOKEN}` |

모든 입력을 받은 후 아래 순서로 파일을 생성한다:

```bash
mkdir -p ~/.config/han
```

**파일 1** — `~/.config/han/han-config.md`:

```markdown
# 한컴 AI 개발 환경 설정
<!-- han-dev 전역 설정 파일 — han-setup으로 관리 -->

## Atlassian

| 항목 | 값 |
|------|-----|
| Base URL | {입력된 Atlassian Base URL} |

## GitLab

| 항목 | 값 |
|------|-----|
| Base URL | {입력된 GitLab Base URL} |
| 기본 브랜치 | {입력된 기본 브랜치} |

## 개인 정보

| 항목 | 값 |
|------|-----|
| 이름 | {입력된 이름} |
| 소속 | {입력된 소속} |
| 부서 | {입력된 부서} |
| 이메일 | {입력된 이메일} |

## 기본 설정

| 항목 | 값 |
|------|-----|
| 마감 경고 기준일 | {입력된 기준일} |
| 개발 모드 | {입력된 dev_mode (기본: manual)} |
| 응답 언어 | 한국어 |
```

**파일 2** — `~/.config/han/.env` (REST API 인증 정보):

```bash
export JIRA_USER="{입력된 Jira 이메일}"
export JIRA_TOKEN="{입력된 API 토큰}"
```

두 파일 생성 후 현재 셸에 환경변수를 즉시 적용하고 shell profile 안내를 출력한다:

```bash
source ~/.config/han/.env
```

```
✅ 한컴 개발 환경 설정 완료
📁 설정 파일: ~/.config/han/han-config.md
🔑 인증 파일: ~/.config/han/.env

⚠️  터미널 재시작 후에도 인증 정보를 유지하려면 shell profile에 추가하세요:
   echo 'source ~/.config/han/.env' >> ~/.zshrc   # zsh
   echo 'source ~/.config/han/.env' >> ~/.bashrc  # bash

다음 한컴 스킬을 사용할 수 있습니다:
- /han-mgmt:han-sprint-report — 스프린트 보고서 생성
- /han-mgmt:han-report — 주간업무 보고서 작성 → Confluence 발행
```

---

## Step 2b: 수정 메뉴 (파일 있을 때)

현재 설정을 출력한 후 수정할 항목을 선택받는다:

```
📋 현재 설정:
{han-config.md 내용 표시}
🔑 API 인증: ~/.config/han/.env {존재 여부}

수정할 항목을 선택하세요:
1. Atlassian 설정 (URL)
2. GitLab 설정 (URL, 기본 브랜치)
3. API 인증 설정 (JIRA_USER, JIRA_TOKEN)
4. 개인 정보 (이름, 소속, 부서, 이메일)
5. 기본 설정 (마감 경고 기준일, 개발 모드)
6. 전체 재설정
0. 취소
```

`AskUserQuestion`으로 선택받아 해당 섹션만 업데이트한다.
항목 3(API 인증) 선택 시: `~/.config/han/.env` 파일의 JIRA_USER/JIRA_TOKEN 값만 업데이트한다.

---

## Step 3: Atlassian MCP 등록

Jira 이슈 조회/상태 전환 등 Atlassian 연동은 MCP 서버를 직접 호출하므로 Atlassian MCP 서버가 필요하다.

### 3-1. 등록 여부 확인

```bash
claude mcp list 2>/dev/null | grep -i "^atlassian" | head -1
```

출력이 있으면 이미 등록된 것 → `✅ Atlassian MCP 등록됨` 출력 후 다음 Step으로.

### 3-2. 미등록 시 — 자동 등록

```bash
claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp
```

성공 시:
```
✅ Atlassian MCP 등록 완료
   서버: https://mcp.atlassian.com/v1/mcp
   최초 사용 시 브라우저 OAuth 인증이 요청될 수 있습니다.
```

실패 시:
```
⚠️  Atlassian MCP 등록 실패. 수동으로 실행하세요:
  claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp
```

---

## Step 4: glab CLI 확인

GitLab 작업(브랜치 생성, MR 생성, 코드 리뷰)에 glab CLI가 필요하다. 설치 및 인증 상태를 확인한다.

### 4-1. 설치 여부 확인

```bash
command -v glab &>/dev/null && echo "✅ glab 설치됨: $(glab version)" || echo "NOT_INSTALLED"
```

미설치 시:
```
⚠️  glab CLI가 설치되지 않았습니다.
    GitLab 연동 스킬(han-code, han-mr, han-close 등)을 사용하려면 설치가 필요합니다.

설치 방법:
  # Linux (Homebrew)
  brew install glab

  # 또는 공식 릴리즈: https://gitlab.com/gitlab-org/cli/-/releases
  # 설치 후 /han-dev:han-dev-setup 을 다시 실행하세요.
```

### 4-2. 인증 상태 확인 (설치된 경우만)

```bash
glab auth status 2>&1
```

미인증 시:
```
⚠️  glab 인증이 필요합니다.
    아래 명령을 실행하여 GitLab에 로그인하세요:

  glab auth login --hostname {GITLAB_BASE의 호스트 (예: gitlab.hancom.com)}

    로그인 후 /han-dev:han-dev-setup 을 다시 실행하면 인증 상태를 재확인합니다.
```

인증 완료 시:
```
✅ glab 인증됨
```

---

## Step 5: Han-ax Hooks 등록

han-ax 전용 hooks를 `~/.claude/settings.json`에 병합한다.
기존 hooks는 보존하며, 이미 등록된 han-ax hooks는 중복 추가하지 않는다.

### 5-1. 스크립트 경로 탐색

```bash
HAN_SCRIPTS=$(find ~/.claude/plugins -name "copyright-header.mjs" 2>/dev/null \
  | grep "han-dev" | head -1 | xargs dirname 2>/dev/null)
echo "SCRIPTS_PATH: $HAN_SCRIPTS"
```

경로를 찾지 못하면:
```
⚠️  han-dev 스크립트 경로를 찾을 수 없습니다.
    claude plugin install han-dev@han-ax 가 완료되었는지 확인하세요.
```
→ 경로 탐색 실패 시 이 단계를 건너뛰고 계속 진행한다.

### 5-2. settings.json에 hooks 병합

아래 Python 코드를 실행하여 han-ax hooks를 등록한다:

```python
import json, os

S = os.path.expanduser('~/.claude/settings.json')
scripts = 'HAN_SCRIPTS_VALUE'  # 5-1에서 탐색한 경로로 치환

cfg = {}
if os.path.exists(S):
    with open(S) as f:
        cfg = json.load(f)

hooks = cfg.setdefault('hooks', {})

def add_hook(event, matcher, cmd, **opts):
    evlist = hooks.setdefault(event, [])
    for entry in evlist:
        for h in entry.get('hooks', []):
            if h.get('command') == cmd:
                return  # 이미 등록됨 (idempotent)
    evlist.append({'matcher': matcher, 'hooks': [{'type': 'command', 'command': cmd, **opts}]})

add_hook('UserPromptSubmit', '*',
         f'bash "{scripts}/han-dev-context.sh"', timeout=3)
add_hook('PreToolUse', 'Bash',
         f'bash "{scripts}/secret-guard.sh"', timeout=5, blockOnError=True)
add_hook('PostToolUse', 'Write|Edit',
         f'node "{scripts}/copyright-header.mjs"', timeout=5)
add_hook('Stop', '*',
         f'bash "{scripts}/close-guard.sh"', timeout=3)
add_hook('SessionStart', '*',
         f'bash "{scripts}/session-start.sh"', timeout=5)

with open(S, 'w') as f:
    json.dump(cfg, f, indent=2, ensure_ascii=False)
print('✅ Han-ax hooks 등록 완료')
```

성공 시:
```
✅ Han-ax hooks 등록 완료
   - UserPromptSubmit : han-dev 컨텍스트 상태 표시
   - PreToolUse(Bash) : 민감 정보 커밋 차단
   - PostToolUse(Write|Edit) : 저작권 헤더 자동 삽입
   - Stop              : han-close 미완료 경고
   - SessionStart        : 이전 세션 미완료 작업 탐지
```

---

## Step 6: C++ 빌드 환경 확인 (C++ 프로젝트 감지 시만)

설정 완료 후 프로젝트 타입이 `cpp`인 경우 추가 확인을 수행한다:

### 6-1. compile_commands.json 존재 확인

clangd가 정상 동작하려면 `compile_commands.json`이 필수이다.

```bash
find . -name "compile_commands.json" -not -path "*/node_modules/*" 2>/dev/null
```

파일이 없으면:
```
⚠️  compile_commands.json이 없습니다. clangd LSP가 동작하지 않을 수 있습니다.

CMake로 생성하는 방법:
  cmake -S . -B build -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
  # 이후 build/compile_commands.json → 프로젝트 루트에 symlink 또는 복사

생성 후 clangd를 재시작하세요.
```

### 6-2. .clang-format 파일 존재 확인

```bash
[ -f ".clang-format" ] && echo "✅ .clang-format 존재" || echo "⚠️  .clang-format 없음"
```

파일이 없으면:
```
⚠️  .clang-format이 없습니다.
    한컴 C++ 스타일 파일 생성을 권장합니다.
    주의: 기존 코드베이스에 적용 전 팀원과 합의가 필요합니다.
```

> 이 단계는 C++ 프로젝트에서만 실행하며, 환경 확인 결과만 출력한다 (파일 자동 생성 없음).

---

## 에러 처리

| 상황 | 대응 |
|------|------|
| `~/.config/han/` 디렉토리 생성 실패 | `mkdir -p ~/.config/han` 실행 안내 |
| 파일 쓰기 실패 | 권한 확인 안내 |
| 잘못된 URL 형식 | `https://` 로 시작해야 함을 안내하고 재입력 요청 |
