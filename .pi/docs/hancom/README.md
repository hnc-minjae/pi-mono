# han-dev 개요

**han-dev**는 한컴 개발자 특화 AI 오케스트레이션 Claude Code 플러그인입니다. 한컴 개발 환경(C++17, Qt6, HWP 문서 포맷)과 협업 도구(Jira, GitLab, Confluence)에 최적화되어 있으며, 개발자의 반복적인 작업을 자동화하고 질 높은 코드 작성을 지원합니다.

---

## 주요 기능

### 1. 3단계 개발 하네스 (han-dev 생태계)

개발 전 과정을 체계적으로 관리하는 자동 오케스트레이션:

- **1단계: 개발 전단계 (han-start)**
  - Jira 이슈 파악 또는 신규 생성
  - 이슈 상태를 To Do로 전환
  - 개발 컨텍스트 저장

- **2단계: 개발 (han-code)**
  - GitLab 브랜치 생성
  - 코드 변경 사항 분석 (의존성, side-effect 파악)
  - TDD 사이클 자동 실행 (테스트 선 작성)
  - 보안 검토 (취약점 식별 및 차단)

- **3단계: 마무리 (han-close)**
  - 변경 사항 자동 커밋
  - GitLab Merge Request 생성 (선택적)
  - Jira Worklog 기록
  - Jira 상태를 Resolved로 전환
  - 작업 요약 코멘트 작성

**Stage 기반 자동 재개**: 중단된 워크플로우를 마지막 완료 단계부터 자동으로 재개합니다.

### 2. 이슈 관리 스킬

Jira와의 통합으로 이슈 관리를 간소화:

- **han-issue-check**: 특정 이슈 조회 및 상태 확인
- **han-issue-list**: 현재 사용자의 할당 이슈 목록 조회
- **han-issue-create**: 새 Task 또는 Epic 생성
- **han-collect**: 스프린트 데이터 수집 및 분석

### 3. 보고서 및 문서화 스킬

개발 활동을 자동으로 기록하고 보고:

- **han-report**: 개발 활동 보고서 생성
- **han-sprint-report**: 스프린트 단위 성과 요약
- **han-issue-report**: 이슈별 상세 리포트
- **han-confluence-publish**: Confluence에 자동 게시
- **han-mbo**: 업무 목표와 실적 동기화

### 4. 협업 및 검토

코드 품질과 팀 협업 강화:

- **han-mr**: 자동 MR 생성 및 관리
- **han-security**: 보안 검토 및 취약점 분석

### 5. 개발 보조 도구

개발 생산성 향상:

- **han-branch**: 규칙 기반 브랜치 생성
- **han-analyze**: 코드 의존성 및 영향 범위 분석
- **han-tdd**: Test-Driven Development 자동 지원
- **han-feature-workspace**: 다중 피처 추적

### 6. 환경 설정

- **han-setup**: 초기 환경 설정 및 인증 구성

---

## 빠른 시작

### 1단계: 한번-time 설정

```bash
/han-dev:han-dev-setup
```

다음 정보를 입력하세요:
- **Jira**: Atlassian 계정, 프로젝트 키, API 토큰
- **GitLab**: 저장소 URL, 개인 액세스 토큰
- **이메일**: 작업 시간 기록용

### 2단계: 첫 개발 사이클 시작

```bash
/han-dev:han-dev AIAGENT-123
```

또는 대화형으로 이슈 선택:

```bash
/han-dev:han-start
```

### 3단계: 단계별 진행

han-dev는 각 단계 완료 후 사용자 확인을 요청합니다:
- **Enter**: 다음 단계로 진행
- **n**: 현재 단계에서 중단 (나중에 `han-dev` 재실행으로 이어서 진행)

### 4단계: 중단된 워크플로우 재개

```bash
# 자동으로 마지막 완료 단계부터 재개
/han-dev:han-dev
```

---

## 스킬 목록 개요

### 개발 하네스 (3단계 + 오케스트레이터)

| 스킬 | 용도 | 호출 |
|------|------|------|
| **han-dev** | 3단계 전체 오케스트레이션 | `/han-dev:han-dev [ISSUE_KEY]` |
| **han-start** | 1단계: 이슈 파악 + Jira 준비 | `/han-dev:han-start [ISSUE_KEY]` |
| **han-code** | 2단계: 브랜치 + 개발 + 보안 | `/han-dev:han-code` |
| **han-close** | 3단계: 커밋 + MR + Jira 완료 | `/han-dev:han-close` |

### 2단계 하위 스킬

| 스킬 | 용도 | 호출 |
|------|------|------|
| **han-branch** | GitLab 브랜치 생성 | (han-code에서 자동) |
| **han-analyze** | 코드 의존성 분석 | (han-code에서 자동) |
| **han-tdd** | TDD 사이클 자동 실행 | (han-code에서 자동) |
| **han-security** | 보안 검토 | (han-code에서 자동) |

### 이슈 관리

| 스킬 | 용도 | 호출 |
|------|------|------|
| **han-issue-check** | Jira 이슈 조회 | (han-start에서 자동) |
| **han-issue-list** | 할당 이슈 목록 조회 | (han-start에서 자동) |
| **han-issue-create** | 새 이슈 생성 | (han-start에서 자동) |

### 보고서 및 문서화

| 스킬 | 용도 | 호출 |
|------|------|------|
| **han-report** | 개발 활동 보고서 | `/han-mgmt:han-report` |
| **han-sprint-report** | 스프린트 성과 요약 | `/han-mgmt:han-sprint-report` |
| **han-issue-report** | 이슈별 상세 리포트 | `/han-mgmt:han-issue-report` |
| **han-confluence-publish** | Confluence 자동 게시 | `/han-mgmt:han-confluence-publish` |
| **han-mbo** | 목표 동기화 | `/han-mgmt:han-mbo` |
| **han-collect** | 데이터 수집 | `/han-mgmt:han-collect` |

### 협업 및 검토

| 스킬 | 용도 | 호출 |
|------|------|------|
| **han-mr** | MR 생성/관리 | (han-close에서 선택) |

### 설정 및 초기화

| 스킬 | 용도 | 호출 |
|------|------|------|
| **han-setup** | 환경 설정 | `/han-dev:han-dev-setup` |

---

## 한국어 트리거 키워드

편의상 한국어로도 스킬을 호출할 수 있습니다:

```
개발 시작      # → han-start
작업 시작      # → han-start
개발           # → han-code
코딩           # → han-code
완료           # → han-close
마무리         # → han-close
개발 전체      # → han-dev
브랜치 생성    # → han-branch
코드 분석      # → han-analyze
TDD            # → han-tdd
보안 검토      # → han-security
MR 생성        # → han-mr
```

---

## 상태 추적 및 재개

han-dev는 `.han/state/han-dev-context.json`에 개발 상태를 저장합니다:

```json
{
  "issue_key": "AIAGENT-123",
  "issue_title": "[PDF] 한글 폰트 렌더링 오류",
  "branch_name": "fix/AIAGENT-123-hangul-font-rendering",
  "stage": "code_done",
  "start_time": "2026-03-22T09:00:00+09:00",
  "code_done_time": "2026-03-22T15:30:00+09:00"
}
```

**stage 값**:
- `pre_done`: 1단계(han-start) 완료
- `tdd_done`: TDD 완료 (보안 검토 대기)
- `security_blocked`: 보안 이슈 차단 (해결 필요)
- `code_done`: 2단계(han-code) 완료
- `close_done`: 3단계(han-close) 완료

---

## 외부 연동 구성

### Jira (hancom.atlassian.net)

```bash
export JIRA_USER="your-email@hancom.com"
export JIRA_TOKEN="your-api-token"
```

### GitLab (사내 GitLab)

```bash
glab auth login --hostname gitlab.hancom.io
```

### Confluence (선택적)

han-confluence-publish 스킬 사용 시 설정:
```bash
export CONFLUENCE_SPACE="AINATIVE"
export CONFLUENCE_BASE_URL="https://hancom.atlassian.net/wiki"
```

---

## 다음 단계

- **첫 설정**: `/han-dev:han-dev-setup` 실행
- **개발 시작**: `/han-dev:han-dev ISSUE_KEY` 실행
- **스킬 상세 가이드**: [skills-guide.md](skills-guide.md) 참고
- **워크플로우 상세**: [workflow-overview.md](workflow-overview.md) 참고

---

## 문제 해결

### 환경 설정이 로드되지 않음

```bash
# 설정 파일 생성
/han-dev:han-dev-setup

# 또는 수동으로
cat ~/.config/han/han-config.md
```

### 중단된 워크플로우 초기화

```bash
# 컨텍스트 파일 삭제 (처음부터 시작)
rm .han/state/han-dev-context.json

# 새 이슈로 시작
/han-dev:han-dev NEW_ISSUE_KEY
```

### 보안 이슈로 차단됨

```bash
# 1. 취약점 확인
cat .han/state/security-findings.json

# 2. 코드 수정

# 3. 보안 재검토
/han-dev:han-security

# 4. 워크플로우 재개
/han-dev:han-dev
```

---

## 문서 및 참조

- **[workflow-overview.md](workflow-overview.md)**: 3단계 워크플로우 상세 설명
- **[skills-guide.md](skills-guide.md)**: 모든 스킬 레퍼런스 가이드
- **설정 파일**: `~/.config/han/han-config.md`
- **컨텍스트**: `.han/state/han-dev-context.json`

---

## 라이선스 및 기여

han-dev는 한컴 개발자 커뮤니티 기여를 환영합니다.
