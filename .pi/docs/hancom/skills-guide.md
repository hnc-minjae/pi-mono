# 한컴 스킬 레퍼런스 가이드

han-dev의 모든 스킬에 대한 상세 레퍼런스입니다. 각 스킬의 호출 방법, 용도, 인자, 연관 스킬을 정리했습니다.

---

## 개발 하네스 (4개 스킬)

### 1. han-dev — 3단계 전체 오케스트레이터

#### 개요
한컴 개발의 3단계 사이클(han-start → han-code → han-close)을 자동으로 오케스트레이션합니다. 각 단계 완료 후 사용자 확인을 거치고, stage 기반으로 중단된 워크플로우를 자동 재개합니다.

#### 호출 방법

```bash
# 이슈 키로 직접 시작
/han-dev:han-dev AIAGENT-123

# 새로 시작하거나 중단된 워크플로우 재개
/han-dev:han-dev
```

#### 인자

| 인자 | 필수 | 형식 | 설명 |
|------|------|------|------|
| `ISSUE_KEY` | 선택 | `PRJKEY-123` | han-start에 전달할 이슈 키 |

#### 한국어 트리거

```
개발 전체
전체 개발 사이클
```

#### 주요 기능

- **Stage 관리**: `.han/state/han-dev-context.json`의 stage 필드로 상태 추적
- **자동 재개**: stage별로 해당 단계부터 시작
- **사용자 확인**: 각 단계 완료 후 Enter(진행)/n(중단) 선택
- **에러 처리**: 보안 차단 시 자세한 해결 절차 안내

#### Stage 값

| stage | 의미 | 다음 실행 | 재개 위치 |
|-------|------|---------|----------|
| (없음) | 초기 상태 | 1→2→3 | 1단계부터 |
| `pre_done` | 1단계 완료 | 2→3 | 2단계부터 |
| `tdd_done` | TDD 완료 | 보안 검토 | 2단계 보안부터 |
| `security_blocked` | 보안 차단 | 중단 | (수동 해결 필요) |
| `code_done` | 2단계 완료 | 3 | 3단계부터 |
| `close_done` | 완료 | (없음) | (새 이슈 시작) |

#### 연관 스킬

```
han-dev (오케스트레이터)
├── han-start (1단계 위임)
├── han-code (2단계 위임)
└── han-close (3단계 위임)
```

#### 사용 예시

```bash
# 처음 시작
$ /han-dev:han-dev AIAGENT-123
[1단계 실행] → [사용자 확인] → [2단계 실행] → ...

# 중단된 워크플로우 재개
$ /han-dev:han-dev
stage=code_done 감지 → 3단계부터 재개
```

---

### 2. han-start — 1단계 개발 전단계

#### 개요
Jira 이슈를 파악하거나 신규 생성하고, 상태를 To Do로 설정한 뒤 개발 컨텍스트를 저장합니다. 브랜치 생성은 하지 않습니다(2단계 담당).

#### 호출 방법

```bash
# 이슈 키로 직접 조회
/han-dev:han-start AIAGENT-123

# 대화형으로 이슈 선택 또는 생성
/han-dev:han-start
```

#### 인자

| 인자 | 필수 | 형식 | 설명 |
|------|------|------|------|
| `ISSUE_KEY` | 선택 | `PRJKEY-123` | 조회할 Jira 이슈 키 |

#### 한국어 트리거

```
개발 시작
작업 시작
이슈 시작
```

#### 주요 기능

- **이슈 조회**: 제공된 이슈 키 확인
- **이슈 선택**: 내 할당 이슈 목록에서 선택
- **이슈 생성**: 새 Task/Epic 신규 생성
- **상태 전환**: 현재 상태 → To Do
- **컨텍스트 저장**: `.han/state/han-dev-context.json` 생성

#### 저장 데이터

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

#### 이슈 선택 흐름

```
[분기 A] ISSUE_KEY 제공
  ↓
  han-issue-check 호출 (조회)

[분기 B] ISSUE_KEY 미제공
  ↓
  사용자 선택:
    [1] 내 할당 이슈 목록 → han-issue-list
    [2] 새 이슈 생성 → han-issue-create
```

#### 환경 요구사항

- `~/.config/han/han-config.md` (han-setup 필수)
- `JIRA_USER`, `JIRA_TOKEN` 환경변수

#### 연관 스킬

```
han-start
├── han-issue-check (이슈 조회, 분기 A)
├── han-issue-list (이슈 목록, 분기 B-1)
└── han-issue-create (이슈 생성, 분기 B-2)
```

#### 에러 처리

| 상황 | 대응 |
|------|------|
| han-config.md 없음 | "/han-dev:han-dev-setup 먼저 실행" 후 중단 |
| 환경변수 미설정 | 설정 방법 안내 후 중단 |
| 이슈 조회 실패 (404) | 새 생성 여부 확인 |
| To Do 전환 불가 | 가능한 상태 목록 제시 후 선택 |

---

### 3. han-code — 2단계 개발

#### 개요
브랜치 생성부터 코드 구현, TDD 사이클, 보안 검토까지 개발 전 과정을 오케스트레이션합니다. han-start가 저장한 컨텍스트를 기반으로 실행됩니다.

#### 호출 방법

```bash
# 인자 없음 (자동으로 컨텍스트 로드)
/han-dev:han-code
```

#### 한국어 트리거

```
개발
코딩
구현 시작
```

#### 주요 기능

- **환경 설정 로드**: Jira + GitLab 설정 확인
- **컨텍스트 검증**: han-start의 컨텍스트 필드 검증
- **Stage 기반 재개**: `tdd_done`이면 보안 검토부터 시작
- **브랜치 생성**: han-branch로 위임
- **코드 분석**: han-analyze로 위임
- **TDD 사이클**: han-tdd로 위임
- **보안 검토**: han-security로 위임 (BLOCKED 시 중단)

#### 내부 Step

| Step | 작업 | 위임 스킬 |
|------|------|---------|
| Step 2 | GitLab 브랜치 생성 | han-branch |
| Step 3 | Jira 상태 To Do → In Progress | (인라인) |
| Step 4 | 코드 의존성 분석 | han-analyze |
| Step 5 | TDD 사이클 | han-tdd |
| Step 6 | 보안 검토 | han-security |
| Step 7 | 컨텍스트 업데이트 | (인라인) |

#### 저장/업데이트 데이터

```json
{
  "branch_name": "fix/AIAGENT-123-hangul-font-rendering",
  "code_done_time": "2026-03-22T15:30:00+09:00",
  "stage": "code_done"
}
```

#### Stage 검증

| stage | 대응 |
|-------|------|
| `pre_done` | 정상 진행 (Step 2부터) |
| `tdd_done` | 보안 검토(Step 6)부터 재개 |
| `security_blocked` | "보안 이슈 해결 후 /han-dev:han-security 재실행" 안내 후 중단 |
| `code_done` | "이미 완료. /han-dev:han-close 실행" 안내 후 중단 |
| 그 외 | 경고 후 사용자 확인 |

#### 환경 요구사항

- `~/.config/han/han-config.md`
- `JIRA_USER`, `JIRA_TOKEN`
- GitLab 인증: `glab auth status` ✓

#### 연관 스킬

```
han-code
├── han-branch (브랜치 생성)
├── han-analyze (코드 분석)
├── han-tdd (TDD 사이클)
└── han-security (보안 검토)
```

#### 보안 차단 처리

```
han-security BLOCKED 감지
  ↓
stage = security_blocked
  ↓
중단 + 해결 절차 안내:
  1. .han/state/security-findings.json 확인
  2. 코드 수정
  3. /han-dev:han-security 재실행
  4. /han-dev:han-dev 재개 (3단계로 자동 진행)
```

---

### 4. han-close — 3단계 마무리

#### 개요
변경사항 커밋, GitLab MR 생성, Jira Worklog 기록, 상태 전환, 작업 요약 코멘트 작성을 순서대로 처리합니다.

#### 호출 방법

```bash
# 인자 없음 (자동으로 컨텍스트 로드)
/han-dev:han-close
```

#### 한국어 트리거

```
완료
마무리
PR
```

#### 주요 기능

- **커밋 메시지 자동 생성**: AI 기반, Closes 트레일러 포함
- **MR 생성 (선택적)**: han-mr로 위임
- **작업 시간 자동 계산**: start_time ~ code_done_time
- **Jira 상태 전환**: In Progress → Resolved
- **작업 요약 코멘트**: ADF 형식으로 자동 생성

#### 내부 Step

| Step | 작업 | 형식 |
|------|------|------|
| Step 2 | 변경사항 커밋 | git commit + 메시지 생성 |
| Step 3 | MR 생성 (선택) | han-mr 위임 |
| Step 4 | Worklog 기록 | Jira REST API |
| Step 5 | 상태 전환 | Jira REST API |
| Step 6 | 코멘트 작성 | Jira REST API + ADF |
| Step 7 | 컨텍스트 업데이트 | JSON 저장 |

#### 커밋 메시지 형식

```
{type}({component}): {한글 요약}

상세 설명 (2~4줄)
- 첫 번째 항목
- 두 번째 항목

Closes: ISSUE_KEY
Confidence: high|medium|low
Scope-risk: narrow|moderate|broad
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

#### 저장/업데이트 데이터

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

#### Worklog 시간 계산

```
start_time (1단계) ~ code_done_time (2단계)
분 단위 반올림 (30초 이상 올림)

예:
  6시간 29분 45초 → 6시간 30분 (23400초)
```

#### MR 생성 선택

```
[1] MR 생성 (han-mr 호출)
[2] 건너뛰기 (나중에 /han-dev:han-mr 로 생성 가능)
```

MR 생성 실패 시 경고 후 best-effort로 계속 진행.

#### Stage 검증

| stage | 대응 |
|-------|------|
| `code_done` | 정상 진행 |
| `close_done` | "이미 마무리 완료" 안내 후 중단 |
| `pre_done` | "코드 작업 미완료" 안내 후 중단 |
| `tdd_done` | "보안 검토 미완료" 안내 후 중단 |
| `security_blocked` | "보안 이슈 차단" 안내 후 중단 |
| 그 외 | 경고 후 사용자 확인 |

#### 환경 요구사항

- `~/.config/han/han-config.md`
- `JIRA_USER`, `JIRA_TOKEN` (또는 `USER_EMAIL` 폴백)
- GitLab 인증: `glab auth status` ✓

#### 연관 스킬

```
han-close
└── han-mr (MR 생성, 선택적)
```

#### 에러 처리

| 상황 | 중단 | 대응 |
|------|------|------|
| 환경 미설정 | **예** | 설정 방법 안내 |
| pre-commit hook 실패 | **예** | 오류 내용 출력 + 수정 안내 |
| MR 생성 실패 | **아니오** | 경고 후 계속 (best-effort) |
| Worklog API 실패 | **아니오** | 1초 후 1회 재시도, 실패 시 경고 |
| 상태 전환 실패 | **아니오** | 가능 상태 제시 후 선택/스킵 |
| 코멘트 API 실패 | **아니오** | 경고 후 계속 |

---

## 2단계 하위 스킬 (4개 스킬)

### 5. han-branch — GitLab 브랜치 생성

#### 개요
Jira 이슈 정보를 기반으로 규칙에 맞게 GitLab 브랜치를 생성합니다. 형식: `{type}/{issue_key}-{slug}`

#### 호출 방법

```bash
# 일반적으로 han-code에서 자동 호출됨
# 수동 호출 (필요 시)
/han-dev:han-branch
```

#### 한국어 트리거

```
브랜치 생성
브랜치 만들기
```

#### 주요 기능

- **이슈 타입 기반 타입 결정**: Bug → `fix`, Task → `feat`
- **자동 slug 생성**: 이슈 제목에서 공백/특수문자 제거
- **중복 확인**: 기존 브랜치 존재 여부 확인
- **원격 push**: 로컬 생성 후 자동 원격 push

#### 브랜치 명명 규칙

| 이슈 타입 | 브랜치 타입 | 예시 |
|----------|-----------|------|
| Bug | `fix` | `fix/AIAGENT-123-hangul-font-rendering` |
| Task | `feat` | `feat/AIAGENT-456-hwp-export-speed` |
| Epic | `feat` | `feat/AIAGENT-789-document-security` |

#### 환경 요구사항

- GitLab 인증: `glab auth status` ✓
- 로컬 git 저장소 (`git status` ✓)

#### 에러 처리

| 상황 | 대응 |
|------|------|
| 브랜치 중복 | "이미 존재합니다. 다른 이름 또는 기존 브랜치 사용?" |
| GitLab 접근 실패 | "glab auth login --hostname gitlab.hancom.io" |
| git push 실패 | 오류 메시지 출력 후 수동 push 안내 |

---

### 6. han-analyze — 코드 의존성 분석

#### 개요
이슈 관련 코드를 탐색하여 의존성을 파악하고 side-effect 영향 범위를 분석합니다.

#### 호출 방법

```bash
# 일반적으로 han-code에서 자동 호출됨
/han-dev:han-analyze
```

#### 한국어 트리거

```
코드 분석
영향 범위
```

#### 주요 기능

- **이슈 관련 코드 탐색**: clangd LSP 또는 grep 기반
- **의존성 파악**: 함수/클래스/변수 의존도 맵핑
- **side-effect 분석**: 변경 영향 범위 도출
- **변경 대상 파일 목록**: 수정 필요 파일 제시

#### 출력 예시

```
이슈: AIAGENT-123 (한글 폰트 렌더링 오류)
관련 컴포넌트: PDF Renderer

분석 결과:
  [직접 관련]
    - src/hwp/pdf/CPdfRenderer.cpp (폰트 렌더링 로직)
    - src/hwp/pdf/CFont.h (폰트 매핑 테이블)

  [side-effect 영향]
    - src/hwp/render/CRenderEngine.cpp (렌더링 엔진)
    - include/hwp/export/CPdfExporter.h (PDF 내보내기)

변경 대상: CPdfRenderer.cpp, CFont.h
영향 범위: narrow (PDF 렌더링만 영향)
```

#### 환경 요구사항

- clangd LSP (C++ 분석용)
- grep / ripgrep
- git 저장소

#### 에러 처리

| 상황 | 대응 |
|------|------|
| clangd 미설치 | "clangd 설치 필요" 안내 + grep 폴백 |
| 이슈 키 미지정 | "컨텍스트에서 issue_key 읽기 실패" |

---

### 7. han-tdd — Test-Driven Development 자동 지원

#### 개요
Test-Driven Development 사이클을 자동으로 관리합니다: 테스트 작성 (Red) → 구현 (Green) → 리팩토링 (Refactor) → 검증 (Verify).

#### 호출 방법

```bash
# 일반적으로 han-code에서 자동 호출됨
/han-dev:han-tdd
```

#### 한국어 트리거

```
TDD
테스트 먼저
```

#### 주요 기능

- **테스트 생성**: 이슈 관련 테스트 코드 생성
- **Red 상태 확인**: 테스트 실행 (실패 확인)
- **구현 가이드**: 구현 필요 사항 제시
- **Green 상태 확인**: 테스트 통과 확인
- **리팩토링 가이드**: 코드 개선 사항 제시
- **Verify**: 전체 테스트 통과 확인

#### TDD 사이클

```
1. 테스트 작성 (Red)
   ├─ 테스트 파일 생성
   ├─ 테스트 케이스 작성
   └─ 첫 실행 (실패 확인)

2. 구현 (Green)
   ├─ 구현 파일 작성
   ├─ 테스트 실행 (통과)
   └─ 통과 메시지 출력

3. 리팩토링 (Refactor)
   ├─ 코드 개선 제시
   ├─ 개선 사항 구현
   └─ 테스트 재실행 (통과 확인)

4. 검증 (Verify)
   └─ 전체 테스트 스위트 통과 확인
```

#### 출력 예시

```
═══════════════════════════════════════
[Red] 테스트 작성 및 실행
═══════════════════════════════════════
테스트 파일: src/hwp/pdf/CPdfRenderer_test.cpp

테스트 케이스:
  - test_hangul_font_mapping_special_chars
  - test_cjk_compatibility_area
  - test_font_fallback

실행 결과: FAIL (예상대로)
  - 2개 테스트 실패
  - 함수 CPdfRenderer::renderCJKText() 구현 필요

═══════════════════════════════════════
[Green] 구현 및 테스트 통과
═══════════════════════════════════════
구현 파일: src/hwp/pdf/CPdfRenderer.cpp

구현 내용:
  + CJK Compatibility 영역(0xF900-0xFAFF) 매핑 추가
  + 특수문자 폴백 로직 구현

테스트 실행: PASS ✓
  - 2개 테스트 통과

═══════════════════════════════════════
[Refactor] 코드 개선
═══════════════════════════════════════
개선 제시:
  - 매핑 테이블 상수로 추출
  - 폴백 로직 별도 함수로 분리

개선 후 테스트: PASS ✓

═══════════════════════════════════════
[Verify] 전체 테스트 통과
═══════════════════════════════════════
전체 테스트 스위트: PASS ✓
  - 기존 테스트: 42개 통과
  - 신규 테스트: 2개 통과
  - 총 44개 통과

stage: tdd_done ✅
```

#### 환경 요구사항

- CMake / qmake (빌드 시스템)
- C++ 컴파일러 (g++ / clang)
- 테스트 프레임워크 (Google Test 등)

#### 에러 처리

| 상황 | 대응 |
|------|------|
| 테스트 작성 실패 | "테스트 생성 불가 — 요구사항 명확히 필요" |
| 빌드 실패 | 컴파일 오류 출력 + 수정 안내 |
| 테스트 미통과 | 실패한 테스트 목록 + 수정 가이드 |
| 전체 테스트 실패 | regression 확인 + 기존 코드 검토 안내 |

---

### 8. han-security — 보안 검토

#### 개요
변경된 코드를 검토하여 보안 취약점을 식별합니다. PASS / SKIP / BLOCKED 중 하나를 판정합니다.

#### 호출 방법

```bash
# 일반적으로 han-code에서 자동 호출됨
/han-dev:han-security

# 재검토 (보안 차단 후 수정)
/han-dev:han-security
```

#### 한국어 트리거

```
보안 검토
보안 검사
```

#### 주요 기능

- **코드 분석**: 변경된 코드 대상 정적 분석
- **취약점 검출**: CWE 기반 취약점 식별
- **심각도 판정**: Critical / High / Medium / Low
- **remediation 제시**: 수정 방법 안내
- **최종 판정**: PASS / SKIP / BLOCKED

#### 검토 대상

| 카테고리 | 검토 항목 |
|---------|---------|
| 입력 검증 | SQL injection, XSS, command injection |
| 메모리 안전성 | buffer overflow, use-after-free, memory leak |
| 권한 관리 | 권한 검증, 접근 제어 |
| 암호화 | weak cipher, hardcoded key |
| 에러 처리 | 정보 유출, 예외 처리 미흡 |

#### 판정 기준

| 판정 | 조건 | 동작 |
|------|------|------|
| PASS | Critical/High 없음 | 2단계 정상 완료 → 3단계 진행 |
| SKIP | 분석 불가능 (external library 등) | 경고 후 2단계 정상 완료 |
| BLOCKED | Critical/High 존재 | stage = security_blocked, 중단 |

#### 결과 저장

```json
{
  "status": "BLOCKED",
  "findings": [
    {
      "severity": "Critical",
      "type": "CWE-89: SQL Injection",
      "location": "src/db/query.cpp:45",
      "description": "사용자 입력을 쿼리에 직접 연결",
      "remediation": "Parameterized query 사용"
    }
  ]
}
```

파일: `.han/state/security-findings.json`

#### BLOCKED 시 해결 절차

```
1. .han/state/security-findings.json 확인
   → Critical/High 항목 확인

2. 코드 수정
   → 제시된 remediation 따라 수정

3. /han-dev:han-security 재실행
   → PASS 또는 SKIP 확인

4. /han-dev:han-dev 재개
   → stage: tdd_done 또는 code_done으로 업데이트 후 3단계 진행
```

#### 환경 요구사항

- Static analysis tool (clang-tidy, cppcheck 등)
- CWE database

---

## 이슈 관리 스킬 (3개 스킬)

### 9. han-issue-check — Jira 이슈 조회

#### 개요
Jira에서 특정 이슈를 조회하고 상태를 확인합니다.

#### 호출 방법

```bash
# 직접 호출
/han-dev:han-issue-check AIAGENT-123

# 또는 han-start에서 자동 호출
```

#### 인자

| 인자 | 필수 | 형식 |
|------|------|------|
| `ISSUE_KEY` | **예** | `PRJKEY-123` |

#### 출력

```
이슈 조회 결과:
─────────────────────────────────
키:         AIAGENT-123
제목:       [PDF] 한글 폰트 렌더링 오류
타입:       버그
상태:       To Do
담당자:     john.doe@hancom.com
우선순위:   높음
─────────────────────────────────
```

#### 에러 처리

| 상황 | 대응 |
|------|------|
| 이슈 없음 (404) | "이슈를 찾을 수 없습니다. 이슈 키 확인?" |
| 인증 실패 (401) | "Jira 인증 필요. export JIRA_TOKEN=..." |
| API 오류 (5xx) | "Jira 서버 오류. 잠시 후 재시도" |

---

### 10. han-issue-list — 할당 이슈 목록 조회

#### 개요
현재 사용자의 할당 이슈 목록을 조회하고 선택할 수 있습니다.

#### 호출 방법

```bash
# 직접 호출
/han-dev:han-issue-list

# 또는 han-start에서 자동 호출 (분기 B-1)
```

#### 출력

```
내 할당 이슈 (AIAGENT 프로젝트):
─────────────────────────────────────────
  [1] AIAGENT-123  [PDF] 한글 폰트 렌더링    (높음)    To Do
  [2] AIAGENT-456  HWPX 내보내기 최적화       (중간)    In Progress
  [3] AIAGENT-789  문서 보안 기능 추가        (낮음)    To Do

선택 (1-3 또는 0 취소):
```

#### 사용자 선택

- 번호 입력 (1-3): 해당 이슈 선택
- 0 입력: 취소 (다시 선택)

#### 에러 처리

| 상황 | 대응 |
|------|------|
| 할당 이슈 없음 | "할당된 이슈가 없습니다. 새로 생성?" |
| API 오류 | "Jira 오류. 잠시 후 재시도" |

---

### 11. han-issue-create — 이슈 신규 생성

#### 개요
Jira에서 새 Task 또는 Epic을 신규 생성합니다.

#### 호출 방법

```bash
# 직접 호출
/han-dev:han-issue-create

# 또는 han-start에서 자동 호출 (분기 B-2)
```

#### 이슈 타입 선택

```
생성할 이슈 타입:
  [1] Task (기본)
  [2] Epic
  [0] 취소

선택:
```

#### Task 생성 입력

```
이슈 제목: [PDF] 한글 폰트 렌더링 오류
설명 (선택):
  특수문자가 깨져서 표시됩니다.
  우선순위: 높음

생성되었습니다!
이슈 키: AIAGENT-123
```

#### Epic 생성 입력

```
Epic 이름: 한컴 PDF 렌더링 최적화
설명 (선택):
  PDF 렌더링 품질 및 성능 개선

생성되었습니다!
이슈 키: AIAGENT-999
```

#### 에러 처리

| 상황 | 대응 |
|------|-----|
| 필드 미입력 | "제목은 필수입니다" |
| API 오류 | "Jira 오류. 잠시 후 재시도" |

---

## 보고서 및 문서화 스킬 (6개 스킬)

### 12. han-report — 개발 활동 보고서

#### 개요
개발 활동을 수집하여 보고서로 생성합니다.

#### 호출 방법

```bash
/han-mgmt:han-report
```

#### 주요 기능

- **기간 선택**: 특정 기간의 활동 수집 (기본: 이번 주)
- **활동 통계**: 커밋, MR, Worklog, 이슈 완료
- **보고서 생성**: Markdown 또는 HTML 형식

#### 보고서 출력 예시

```
═══════════════════════════════════════
개발 활동 보고서
기간: 2026-03-16 ~ 2026-03-22
═══════════════════════════════════════

요약:
  - 이슈 완료: 5개
  - 커밋: 12개
  - MR: 5개
  - 작업 시간: 38.5시간

상세:
  [완료 이슈]
    ✓ AIAGENT-123 [PDF] 한글 폰트 렌더링 오류 (6.5h)
    ✓ AIAGENT-456 HWPX 내보내기 최적화 (8h)
    ...

  [최근 커밋]
    a1b2c3d fix(pdf): 한글 폰트 렌더링 오류
    e4f5g6h feat(export): HWPX 성능 최적화
    ...
```

---

### 13. han-sprint-report — 스프린트 성과 요약

#### 개요
스프린트 단위의 팀 성과를 요약합니다.

#### 호출 방법

```bash
/han-mgmt:han-sprint-report
```

#### 보고서 항목

- 스프린트 기간
- 계획 대비 완료율
- 팀 활동 통계
- 주요 성과
- 이슈 및 개선사항

---

### 14. han-issue-report — 이슈별 상세 리포트

#### 개요
특정 이슈의 상세 정보를 리포트합니다.

#### 호출 방법

```bash
/han-mgmt:han-issue-report AIAGENT-123
```

#### 리포트 항목

- 이슈 정보 (키, 제목, 타입, 상태)
- 타임라인 (생성, 시작, 완료)
- 작업 기록 (Worklog, 커밋, MR)
- 코멘트 및 히스토리

---

### 15. han-confluence-publish — Confluence 자동 게시

#### 개요
개발 활동을 Confluence에 자동으로 게시합니다.

#### 호출 방법

```bash
/han-mgmt:han-confluence-publish
```

#### 게시 대상

- 개발 활동 보고서
- 스프린트 성과
- 기술 문서

#### 설정

Space Key와 상위 페이지 제목은 실행 시 대화형으로 입력합니다. 별도 환경변수 설정은 필요하지 않습니다.

Atlassian 인증 정보(`JIRA_USER`, `JIRA_TOKEN`)는 `~/.config/han/.env`에서 자동으로 읽어옵니다.

---

### 16. han-mbo — 업무 목표 동기화

#### 개요
개발 활동을 MBO(Management By Objectives) 목표와 동기화합니다.

#### 호출 방법

```bash
/han-mgmt:han-mbo
```

---

### 17. han-collect — 데이터 수집 및 분석

#### 개요
Jira, GitLab, Confluence에서 데이터를 수집하고 분석합니다.

#### 호출 방법

```bash
/han-mgmt:han-collect
```

#### 수집 대상

- Jira 이슈 데이터
- GitLab 커밋 및 MR
- Confluence 문서
- Worklog 및 시간 기록

---

## 협업 및 검토 스킬 (2개 스킬)


#### 개요
GitLab MR를 검토하고 피드백을 제공합니다.

#### 호출 방법

```bash
/han-dev:han-reviewer
```

#### 검토 항목

- 코드 품질
- 테스트 커버리지
- 보안 취약점
- 성능 영향

---

### 19. han-mr — MR 생성 및 관리

#### 개요
GitLab에 Merge Request를 생성하거나 관리합니다.

#### 호출 방법

```bash
# 직접 호출
/han-dev:han-mr

# 또는 han-close에서 자동 호출 (선택적)
```

#### 한국어 트리거

```
MR 생성
머지 리퀘스트
```

#### 주요 기능

- **MR 생성**: 현재 브랜치 기반 자동 생성
- **타이틀/설명 자동 생성**: 이슈 정보 기반
- **Reviewer 지정**: 팀 구성원 자동 선택
- **CI/CD 트리거**: MR 생성 시 자동 실행

#### MR 설명 템플릿

```
## 이슈
- AIAGENT-123

## 변경 내용
- 한글 폰트 매핑 테이블에서 특수문자 범위 추가
- CJK Compatibility 영역(0xF900-0xFAFF) 매핑

## 테스트
- 신규 테스트 2개 추가 (test_hangul_font_*)
- 기존 테스트 모두 통과 (44개)

## 검토 사항
- [ ] 코드 스타일 확인
- [ ] 테스트 커버리지 확인
- [ ] 보안 검토
```

#### 출력

```
MR 생성 완료:
  URL: https://gitlab.hancom.io/ai-native/assistant/merge_requests/42
  브랜치: fix/AIAGENT-123-hangul-font-rendering → develop
  상태: Draft / Ready for Review
```

---

## 설정 스킬 (1개 스킬)

### 20. han-setup — 환경 설정

#### 개요
한컴 개발 환경을 초기 설정합니다. Jira, GitLab, 개인 정보를 등록합니다.

#### 호출 방법

```bash
/han-dev:han-dev-setup
```

#### 설정 절차

```
═══════════════════════════════════════
한컴 개발 환경 설정 (초기화)
═══════════════════════════════════════

[1단계] Atlassian 설정
  Base URL: https://hancom.atlassian.net

[2단계] GitLab 설정
  Base URL: https://gitlab.hancom.io
  기본 브랜치: develop

[3단계] 개인 정보
  이름: 홍길동
  소속: AI사업부
  부서: AI개발팀
  이메일: user@hancom.com

[4단계] REST API 인증
  Jira 이메일: user@hancom.com
  API 토큰: *** (https://id.atlassian.com/manage-profile/security/api-tokens)

설정 저장: ~/.config/han/han-config.md ✓
인증 저장: ~/.config/han/.env ✓
```

#### 저장 위치

두 파일에 분리 저장됩니다:

**`~/.config/han/han-config.md`** — URL 및 개인 정보:

```markdown
## Atlassian
| Base URL | https://hancom.atlassian.net |

## GitLab
| Base URL | https://gitlab.hancom.io |
| 기본 브랜치 | develop |

## 개인 정보
| 이름 | 홍길동 |
| 소속 | AI사업부 |
| 부서 | AI개발팀 |
| 이메일 | user@hancom.com |
```

**`~/.config/han/.env`** — REST API 인증 정보:

```bash
export JIRA_USER="user@hancom.com"
export JIRA_TOKEN="your-api-token"
```

#### 환경변수 자동 적용

설정 완료 후 현재 셸에 자동으로 `source`됩니다. 터미널 재시작 후에도 유지하려면:

```bash
echo 'source ~/.config/han/.env' >> ~/.zshrc   # zsh
echo 'source ~/.config/han/.env' >> ~/.bashrc  # bash
```

#### GitLab CLI 인증

```bash
glab auth login --hostname gitlab.hancom.io
```

#### 재설정

```bash
# 설정 초기화
rm ~/.config/han/han-config.md

# 재실행
/han-dev:han-dev-setup
```

---

## 스킬 의존성 맵

```
han-dev (최상위 오케스트레이터)
├── han-start (1단계)
│   ├── han-issue-check (이슈 조회)
│   ├── han-issue-list (이슈 목록)
│   └── han-issue-create (이슈 생성)
├── han-code (2단계)
│   ├── han-branch (브랜치 생성)
│   ├── han-analyze (코드 분석)
│   ├── han-tdd (TDD 사이클)
│   └── han-security (보안 검토)
└── han-close (3단계)
    └── han-mr (MR 생성, 선택적)

[보고서/문서]
├── han-report (개발 활동)
├── han-sprint-report (스프린트)
├── han-issue-report (이슈별)
├── han-confluence-publish (Confluence)
├── han-mbo (목표)
└── han-collect (데이터 수집)

[협업]
└── han-mr (MR 관리)

[설정]
└── han-setup (초기 설정)
```

---

## 참조

- **한컴 환경**: C++17, Qt6, HWP/HWPX, GitLab, Jira, Confluence
- **설정 파일**: `~/.config/han/han-config.md`
- **컨텍스트**: `.han/state/han-dev-context.json`
- **보안 결과**: `.han/state/security-findings.json`
- **다음 문서**: [workflow-overview.md](workflow-overview.md) — 3단계 워크플로우 상세
