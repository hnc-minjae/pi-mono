# 한컴 개발 3단계 워크플로우

han-dev의 핵심인 3단계 개발 워크플로우(han-dev 하네스)를 상세히 설명합니다.

---

## 전체 흐름 시각화

```
┌─────────────────────────────────────────────────────────────────┐
│                     han-dev (전체 하네스)                       │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    [1단계] han-start                             │
│                  (이슈 파악 + Jira 준비)                        │
│                                                                 │
│  ├─ 이슈 조회 또는 신규 생성                                    │
│  ├─ Jira 상태: To Do로 전환                                     │
│  └─ 개발 컨텍스트 저장 (.han/state/han-dev-context.json)       │
│                                                                 │
│  ✓ 완료 → stage = pre_done                                     │
│  ↓ 사용자 확인 (Enter/n)                                       │
└──────────────────────────────────────────────────────────────────┘
                          ↓ Enter
┌──────────────────────────────────────────────────────────────────┐
│                    [2단계] han-code                              │
│              (브랜치 생성 + 개발 + 보안 검토)                   │
│                                                                 │
│  ├─ Step A: 브랜치 생성 (→ han-branch 위임)                    │
│  │           Jira: To Do → In Progress                         │
│  │                                                              │
│  ├─ Step B: 코드 분석 (→ han-analyze 위임)                     │
│  │           의존성 파악, side-effect 영향 범위 도출           │
│  │                                                              │
│  ├─ Step C: TDD 사이클 (→ han-tdd 위임)                        │
│  │           테스트 작성 → 구현 → 리팩토링 → 통과 확인        │
│  │                                                              │
│  ├─ Step D: 보안 검토 (→ han-security 위임)                    │
│  │           취약점 검토 → PASS/BLOCKED 판정                   │
│  │                                                              │
│  │  ⚠️ BLOCKED 감지 → stage = security_blocked (중단)         │
│  │  ✓ PASS → stage = code_done                                 │
│  │                                                              │
│  ✓ 완료 → stage = code_done                                    │
│  ↓ 사용자 확인 (Enter/n)                                       │
└──────────────────────────────────────────────────────────────────┘
                          ↓ Enter
┌──────────────────────────────────────────────────────────────────┐
│                    [3단계] han-close                             │
│            (커밋 + MR + Jira 완료 + 요약 코멘트)               │
│                                                                 │
│  ├─ Step A: 변경사항 커밋                                       │
│  │           커밋 메시지 자동 생성 + 사용자 확인               │
│  │                                                              │
│  ├─ Step B: GitLab MR 생성 (선택적, → han-mr 위임)            │
│  │           [1] MR 생성 / [2] 건너뛰기                       │
│  │                                                              │
│  ├─ Step C: Jira Worklog 기록                                  │
│  │           start_time ~ code_done_time 자동 계산            │
│  │                                                              │
│  ├─ Step D: Jira 상태 전환                                      │
│  │           In Progress → Resolved (또는 설정된 상태)        │
│  │                                                              │
│  ├─ Step E: 작업 요약 코멘트 (ADF 형식)                        │
│  │           - 브랜치, 커밋, MR, 작업시간                     │
│  │           - 변경 내용 요약                                  │
│  │           - 변경 파일 통계                                  │
│  │                                                              │
│  ✓ 완료 → stage = close_done                                   │
│                                                                 │
│  ✅ 전체 사이클 완료                                             │
│     새 이슈: /han-dev:han-dev NEW_ISSUE_KEY                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Stage 기반 자동 진입 및 재개

han-dev는 `.han/state/han-dev-context.json`의 `stage` 필드를 읽어 자동으로 진입 단계를 결정합니다.

### Stage 진입 테이블

| stage 값 | 파일 상태 | han-dev 동작 | 사용자 경험 |
|----------|---------|------------|----------|
| (없음) | 파일 없음 | 1단계부터 전체 실행 | 처음 시작 |
| `pre_done` | Step 1 완료 | 2단계(han-code)부터 재개 | 1단계 중단 후 재개 |
| `tdd_done` | TDD 완료 | 2단계의 보안 검토(Step D)부터 재개 | TDD 중단 후 보안만 다시 |
| `security_blocked` | 보안 차단 | **중단**, 해결 안내 | 보안 이슈 수정 필요 |
| `code_done` | 2단계 완료 | 3단계(han-close)부터 재개 | 2단계 중단 후 재개 |
| `close_done` | 완료 | "이미 완료" 안내 후 종료 | 새 이슈 시작 유도 |

### 사용자 n 입력 시 동작

각 단계 완료 후 "다음 단계로 진행하시겠습니까? Enter/n" 확인에서 **n을 입력**하면:

- 현재 stage 값 유지
- han-dev 종료 (완전 중단 아님)
- 나중에 `/han-dev:han-dev` 재실행하면 해당 stage부터 자동 재개

예시:
```bash
# 1단계 후 n 입력
→ stage: pre_done 유지
→ 나중에 /han-dev:han-dev 실행 시 2단계부터 시작

# 2단계 후 n 입력
→ stage: code_done 유지 (TDD 완료 + 보안 검토 완료)
→ 나중에 /han-dev:han-dev 실행 시 3단계부터 시작
```

---

## 1단계: han-start (개발 전단계)

### 목적

- Jira 이슈를 파악하거나 신규 생성
- 이슈 상태를 To Do로 설정
- 개발 컨텍스트 저장

### 입출력

**입력**:
- (선택적) `ISSUE_KEY` — 직접 지정한 이슈 키

**출력**:
- `issue_key`, `issue_title`, `issue_type`
- `stage: pre_done` 저장

### 이슈 선택 흐름

```
[분기 A] 이슈 키가 제공된 경우
  → han-issue-check로 조회

[분기 B] 이슈 키 없이 호출된 경우
  사용자 선택:
  [1] 내 할당 이슈 목록에서 선택 → han-issue-list 호출
  [2] 새 Task 생성 → han-issue-create 호출
```

### 상태 전환

```
이전 상태 (Open/In Review 등)
         ↓
      To Do ← han-start에서 자동 전환
```

### 저장 데이터 구조

```json
{
  "issue_key": "AIAGENT-123",
  "issue_title": "[PDF] 한글 폰트 렌더링 오류",
  "issue_type": "버그",
  "project_key": "AIAGENT",
  "start_time": "2026-03-22T09:00:00+09:00",
  "stage": "pre_done"
}
```

---

## 2단계: han-code (개발)

### 목적

브랜치 생성부터 코드 구현, 보안 검토까지 전 개발 과정을 오케스트레이션합니다.

### 내부 Step 구조

#### Step A: 브랜치 생성 (→ han-branch 위임)

| 항목 | 내용 |
|------|------|
| 역할 | GitLab 저장소에서 develop 기반 새 브랜치 생성 |
| 입력 | issue_key, issue_type |
| 브랜치 규칙 | `{type}/{issue_key}-{slug}` |
| 예시 | `fix/AIAGENT-123-hangul-font-rendering` |
| 출력 | `BRANCH_NAME` |

#### Step B: Jira 상태 전환

```
To Do
  ↓
In Progress ← han-code에서 자동 전환
```

#### Step C: 코드 분석 (→ han-analyze 위임)

| 항목 | 내용 |
|------|------|
| 역할 | 이슈 관련 코드 탐색, 의존성 파악 |
| 출력 | 변경 대상 파일 목록, side-effect 영향 범위 |

#### Step D: TDD 사이클 (→ han-tdd 위임)

```
테스트 작성 (Red)
    ↓
구현 코드 작성 (Green)
    ↓
리팩토링 (Refactor)
    ↓
전체 테스트 통과 확인 (Verify)
```

TDD 완료 후 `stage: tdd_done` 설정.

#### Step E: 보안 검토 (→ han-security 위임)

| 항목 | 내용 |
|------|------|
| 검토 대상 | 변경된 코드 (입력 검증, 메모리 안전성 등) |
| 결과 판정 | PASS / SKIP / BLOCKED |
| BLOCKED 시 | stage = security_blocked로 설정 후 **중단** |

### Stage 검증 로직

han-code 실행 시 현재 stage를 읽고:

| stage 값 | 동작 |
|----------|------|
| `pre_done` | 정상 진행 (Step A부터) |
| `tdd_done` | 보안 검토(Step E)부터 재개 |
| `security_blocked` | "보안 이슈 해결 후 재실행" 안내 후 중단 |
| 그 외 | 경고 후 계속 진행할지 확인 |

### 완료 데이터 업데이트

```json
{
  "branch_name": "fix/AIAGENT-123-hangul-font-rendering",
  "code_done_time": "2026-03-22T15:30:00+09:00",
  "stage": "code_done"
}
```

---

## 3단계: han-close (마무리)

### 목적

커밋 생성부터 Jira 완료 처리까지 마무리 전 과정을 처리합니다.

### 내부 Step 구조

#### Step A: 변경사항 커밋

```
[상태 확인]
  ├─ staged 파일 있음 → 그대로 커밋
  ├─ unstaged / untracked 있음 → 포함 여부 확인
  └─ 변경사항 없음 → 기존 HEAD SHA 사용

[커밋 메시지 생성]
  git diff --cached --stat 기반 AI 생성

  형식:
  fix(component): 한글 요약

  상세 설명 (2~4줄)

  Closes: ISSUE_KEY
  Confidence: high|medium|low
  Scope-risk: narrow|moderate|broad

[사용자 확인]
  Enter → 생성된 메시지로 커밋
  텍스트 입력 → 해당 내용으로 커밋
```

#### Step B: GitLab MR 생성 (선택적, → han-mr 위임)

```
MR 생성 여부 선택:
  [1] MR 생성 (han-mr 위임)
  [2] 건너뛰기 (나중에 /han-dev:han-mr 로 생성 가능)

[1] 선택 시:
  → han-mr 실행 (MR_IID, MR_URL 반환)

[2] 선택 시:
  MR_IID = null, MR_URL = null (Step C 계속)
```

MR 생성 실패 시 경고 후 best-effort로 계속 진행.

#### Step C: Jira Worklog 기록

```
[시간 계산]
  start_time (1단계 저장) ~ code_done_time (2단계 저장)
  분 단위 반올림

  예: 6시간 30분

[사용자 확인]
  Jira Worklog 기록:
    작업 시간: 6시간 30분
    진행하시겠습니까? [Y/n]

[기록]
  Y → Jira REST API로 worklog 등록
  n → 스킵 (worklog_seconds = 0)
```

#### Step D: Jira 상태 전환

```
In Progress
    ↓
Resolved (또는 설정된 JIRA_DONE_STATUS)

전환 불가능 시:
  → 가능한 상태 목록 제시
  → 사용자 선택 또는 스킵
```

#### Step E: 작업 요약 코멘트 (ADF 형식)

Jira에 자동으로 다음 정보를 코멘트로 작성:

```
[작업 완료 요약]
- 브랜치: fix/AIAGENT-123-hangul-font-rendering
- 커밋: a1b2c3d
- MR: https://gitlab.hancom.io/.../merge_requests/42
- 작업 시간: 6시간 30분

[변경 내용]
- PDF 변환 시 한글 폰트 매핑 테이블에서
  특수문자 범위 누락 문제 수정

[변경 파일]
- src/hwp/pdf/CPdfRenderer.cpp (+45 -12)
- src/hwp/pdf/CPdfRenderer_test.cpp (+78 -0)
```

> ADF(Atlassian Document Format) 자동 생성. 참조: `skills/han-shared/references/adf-convert.md`

### Stage 검증 로직

han-close 실행 시 현재 stage를 읽고:

| stage 값 | 동작 |
|----------|------|
| `code_done` | 정상 진행 (Step A부터) |
| `close_done` | "이미 완료된 이슈" 안내 후 중단 |
| `pre_done` | "코드 작업 미완료" 안내 후 중단 |
| `tdd_done` | "보안 검토 미완료" 안내 후 중단 |
| `security_blocked` | "보안 이슈 차단 중" 안내 후 중단 |
| 그 외 | 경고 후 계속 진행할지 확인 |

추가 검증:
- `branch_name` 비어있으면 중단
- `code_done_time` 비어있으면 중단

### 완료 데이터 업데이트

```json
{
  "commit_sha": "a1b2c3d",
  "mr_iid": 42,
  "mr_url": "https://gitlab.hancom.io/ai-native/assistant/merge_requests/42",
  "worklog_seconds": 23400,
  "close_done_time": "2026-03-22T16:00:00+09:00",
  "stage": "close_done"
}
```

---

## 사용자 입력 흐름 (Enter/n 확인)

각 단계 완료 후:

```
────────────────────────────────────────
[{단계} 완료] 이슈: [{ISSUE_KEY}] {ISSUE_TITLE}
             상태: {이전} → {현재}
────────────────────────────────────────
→ {다음 단계}로 진행하시겠습니까?
  Enter → 진행  /  n → 여기서 중단
  (중단 시 나중에 /han-dev:han-dev 로 재개 가능)
```

### Enter(빈 입력)

```
사용자 입력: [Enter]
  ↓
다음 단계 자동 실행
```

### n 입력

```
사용자 입력: n
  ↓
현재 stage 값 유지
  ↓
han-dev 종료 (완전 중단 아님)
  ↓
이후 /han-dev:han-dev 재실행 시 해당 stage부터 자동 재개
```

---

## 보안 차단 (security_blocked) 처리

han-security에서 BLOCKED 판정 시:

```
[han-code 실행]
  └─ han-security BLOCKED 감지
       ↓
     stage = security_blocked 저장
       ↓
     "🚫 보안 이슈가 해결되지 않았습니다.
        취약점 수정 후 /han-dev:han-security 를 재실행하세요."
       ↓
     중단

[사용자 대응]
  1. .han/state/security-findings.json 확인
  2. Critical/High 항목 수정
  3. /han-dev:han-security 재실행 (PASS 확인)
  4. /han-dev:han-code (stage: code_done 재설정)
  5. /han-dev:han-dev (3단계로 자동 진행)
```

---

## 에러 처리 및 재시도

### pre-commit hook 실패 (Step 2-5)

```
git commit 실패 (pre-commit hook)
  ↓
hook 오류 메시지 출력
  ↓
사용자 수정
  ↓
/han-dev:han-close 재실행 (Step 2부터)
```

### API 오류 (5xx)

```
API 호출 실패 (네트워크/서버 오류)
  ↓
1초 후 1회 자동 재시도
  ↓
재실패 시:
  - Worklog/Comment: best-effort (계속 진행)
  - 상태 전환: 선택 기회 제공 또는 스킵
  - 커밋/MR: 중단
```

---

## 전체 컨텍스트 최종 형태

3단계 완료 후:

```json
{
  "issue_key": "AIAGENT-123",
  "issue_title": "[PDF] 한글 폰트 렌더링 오류",
  "issue_type": "버그",
  "project_key": "AIAGENT",
  "start_time": "2026-03-22T09:00:00+09:00",
  "code_done_time": "2026-03-22T15:30:00+09:00",
  "close_done_time": "2026-03-22T16:00:00+09:00",
  "branch_name": "fix/AIAGENT-123-hangul-font-rendering",
  "commit_sha": "a1b2c3d",
  "mr_iid": 42,
  "mr_url": "https://gitlab.hancom.io/ai-native/assistant/merge_requests/42",
  "worklog_seconds": 23400,
  "stage": "close_done"
}
```

---

## 재개 예시

### 예시 1: 1단계 중단 → 2단계부터 재개

```bash
# 초기 실행
$ /han-dev:han-dev AIAGENT-123
... [1단계 실행] ...
→ 2단계로 진행하시겠습니까?
  Enter/n: n
  [stage: pre_done 유지하고 종료]

# 재개
$ /han-dev:han-dev
stage=pre_done 감지 → 2단계(han-code)부터 재개합니다.
... [2단계 실행] ...
```

### 예시 2: 보안 차단 → 해결 후 재개

```bash
# 2단계 실행 중 보안 차단
$ /han-dev:han-dev
... [2단계 실행] ...
⛔ 보안 이슈가 차단 중입니다.
   [stage: security_blocked]

# 보안 이슈 수정
$ /han-dev:han-security
... [취약점 수정 후 재검토] ...
✅ PASS

# 워크플로우 재개
$ /han-dev:han-dev
stage=tdd_done 감지 → 2단계(han-code) 보안 검토 단계부터 재개합니다.
... [보안 통과 후 3단계로 자동 진행] ...
```

### 예시 3: 2단계 완료 후 시간 경과 → 3단계 재개

```bash
# 2단계 완료 (같은 날)
$ /han-dev:han-dev
... [1단계, 2단계 완료] ...
→ 3단계로 진행하시겠습니까?
  Enter/n: n
  [stage: code_done 유지하고 종료]

# 다음 날 재개
$ /han-dev:han-dev
stage=code_done 감지 → 3단계(han-close)부터 재개합니다.
... [3단계 실행] ...
✅ 완료
```

---

## 참조

- **컨텍스트 파일**: `.han/state/han-dev-context.json`
- **기술 스택**: Jira REST API, glab CLI (GitLab), bash + Python
- **다음 문서**: [skills-guide.md](skills-guide.md) — 모든 스킬 상세 레퍼런스
