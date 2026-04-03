---
name: han-security
description: 한컴 개발 보안 검토 sub-skill. OWASP Top 10 기반 보안 취약점을 검토하고 제품 타입별 특화 위험 항목을 점검한다. 독립 단독 실행 지원. "보안", "보안 검토", "보안 검토해줘", "보안 점검", "취약점 검토", "security", "OWASP" 등에 반응한다.
user_invocable: true
argument: "(없음) — /han-dev:han-security 로 직접 재실행 가능"
---

# 보안 검토 워크플로우

코드 구현 완료 후 han-close(3단계) 진행 전 보안 취약점을 점검한다.
han-code에서 내부 위임으로 실행되며, 보안 이슈 수정 후 `/han-dev:han-security`로 직접 재실행할 수도 있다.

```
[이 스킬의 범위]
✅ 변경 파일 기반 보안 취약점 탐지
✅ OWASP Top 10 기반 체크리스트 적용
✅ 제품 타입별 특화 보안 위험 검토
✅ Critical/High 취약점 발견 시 han-close 차단
✅ 보안 검토 결과 요약 출력
❌ 취약점 자동 수정 (→ executor 에이전트 담당)
❌ 정적 분석 도구 직접 실행 (→ 에이전트 판단에 위임)
❌ 운영 환경 침투 테스트 (→ 별도 보안 전문 프로세스)
```

---

## Step 0: 프로젝트 타입 감지

변경 파일 확장자와 디렉토리 구조로 제품 타입을 결정한다.

```bash
# 변경 파일 목록 수집 (staged + unstaged 포함)
CHANGED_FILES=$(git diff --name-only HEAD 2>/dev/null; git diff --name-only --cached 2>/dev/null)

# 확장자 기반 타입 감지
HAS_CPP=$(echo "$CHANGED_FILES" | grep -E '\.(cpp|h|cc|cxx)$' | wc -l)
HAS_CS=$(echo "$CHANGED_FILES" | grep -E '\.cs$' | wc -l)
HAS_PY=$(echo "$CHANGED_FILES" | grep -E '\.py$' | wc -l)
HAS_JS=$(echo "$CHANGED_FILES" | grep -E '\.(js|ts|jsx|tsx)$' | wc -l)
HAS_JAVA=$(echo "$CHANGED_FILES" | grep -E '\.java$' | wc -l)
```

타입 판정 우선순위:

| 조건 | 감지 타입 | 적용 특화 위험 목록 |
|------|-----------|-------------------|
| `.cpp` / `.h` / `.cs` 포함 | `cpp-office` | 한글/한컴오피스 C++/C# |
| `.py` / `.js` / `.ts` 포함, AI 관련 경로 | `ai-assistant` | 한컴어시스턴트/피디아 |
| `.py` / `.js` / `.ts` 포함, 그 외 | `dataloader` | 데이터로더 |
| 복합 (여러 타입 혼재) | `mixed` | 해당 타입 모두 적용 |

AI 관련 경로 판정 기준: `assistant`, `pedia`, `llm`, `ai`, `agent`, `prompt` 디렉토리/파일명 포함 여부

---

## Step 1: 변경된 파일 목록 확인

```bash
# HEAD 대비 변경 파일 (신규 포함)
git diff --name-only HEAD

# staged 변경 파일
git diff --name-only --cached

# 중복 제거 후 최종 목록
REVIEW_FILES=$(git diff --name-only HEAD; git diff --name-only --cached | sort -u)

echo "보안 검토 대상 파일 (${REVIEW_FILES_COUNT}건):"
echo "$REVIEW_FILES"
```

변경 파일 분류:

```bash
# staged 파일만 별도 확인
STAGED_FILES=$(git diff --name-only --cached)
# 아직 staged 안 된 수정 파일
UNSTAGED_FILES=$(git status --short | grep -E "^ M|^M " | awk '{print $2}')
```

| 상태 | 대응 |
|------|------|
| staged + unstaged 파일 있음 | `REVIEW_FILES` 전체 대상으로 Step 2 진행 |
| staged 없음, unstaged 있음 | **"다음 파일이 staged 되지 않았습니다. `git add <파일>` 후 재실행하세요."** 출력 후 SKIP |
| 아무 변경도 없음 | `SECURITY_STATUS=SKIP` — Step 4로 이동 |

> unstaged 파일만 있을 때 무시하지 않는다 — 보안 검토 누락을 방지하기 위해 명시적으로 git add를 요구한다.

---

## Step 2: `security-reviewer` 에이전트 위임

변경 파일 목록과 제품 타입별 특화 위험 목록을 포함하여 보안 검토를 위임한다.

### 위임 요청 형식

```
security-reviewer 에이전트에 다음 내용을 포함하여 위임:

[검토 대상]
- 파일 목록: {REVIEW_FILES}
- 프로젝트 타입: {PROJECT_TYPE}

[OWASP Top 10 체크 항목]
1. A01 - 접근 제어 취약점 (Broken Access Control)
2. A02 - 암호화 실패 (Cryptographic Failures)
3. A03 - 인젝션 (Injection): SQL, OS, LDAP, XPath
4. A04 - 안전하지 않은 설계 (Insecure Design)
5. A05 - 보안 설정 오류 (Security Misconfiguration)
6. A06 - 취약하고 오래된 컴포넌트 (Vulnerable Components)
7. A07 - 인증 및 식별 실패 (Identification/Authentication Failures)
8. A08 - 소프트웨어 및 데이터 무결성 실패 (Software/Data Integrity Failures)
9. A09 - 보안 로깅 및 모니터링 실패 (Security Logging/Monitoring Failures)
10. A10 - 서버 사이드 요청 위조 (SSRF)

[제품 타입별 특화 위험 목록 — {PROJECT_TYPE}에 해당하는 섹션 적용]

cpp-office (한글/한컴오피스 C++/C#):
- 버퍼 오버플로우: 고정 크기 배열, strcpy/sprintf 사용 여부
- 정수 오버플로우: 파일 크기/인덱스 계산 시 오버플로우 가능성
- Use-After-Free: 동적 할당 해제 후 포인터 재사용
- 포맷 스트링 취약점: printf 계열 함수의 사용자 입력 직접 전달
- 파일 경로 조작: 상대 경로, Path Traversal (../../) 가능성
- 악성 문서 파싱: HWP/HWPX 파일 파서의 입력 검증 미흡
- 임시 파일 경쟁 조건: TOCTOU (Time-of-Check-Time-of-Use)
- DLL 하이재킹: 상대 경로 DLL 로드

dataloader (데이터로더 Python/JS/TS):
- SQL Injection: 동적 쿼리 생성 시 파라미터 바인딩 미사용
- Path Traversal: 파일 경로에 사용자 입력 직접 포함
- XSS: 사용자 입력을 HTML에 비이스케이프 출력
- API 인증 누락: 엔드포인트별 인증/인가 체크 부재
- 민감 데이터 노출: 로그, 에러 메시지에 API 키/비밀번호 포함
- SSRF: 외부 URL 페치 시 내부 네트워크 접근 가능성
- 안전하지 않은 역직렬화: pickle, eval, exec 사용
- 하드코딩된 시크릿: 소스 코드 내 API 키, 토큰, 비밀번호

ai-assistant (한컴어시스턴트/피디아):
- 프롬프트 인젝션: 사용자 입력이 LLM 시스템 프롬프트를 변조 가능한지 여부
- LLM API 키 노출: 환경변수 미사용, 코드 내 하드코딩
- 에이전트 권한 과잉: 에이전트가 필요 이상의 파일시스템/네트워크 권한 보유
- 출력 검증 미흡: LLM 응답을 검증 없이 실행 (코드 실행, 명령어 수행)
- 컨텍스트 오염: 사용자 간 대화 컨텍스트 격리 미흡
- 모델 응답 로깅: 민감 정보가 포함된 대화 내용 무단 저장
- 레이트 리밋 미적용: API 남용으로 인한 비용 폭증 방지 장치 부재
- 안전하지 않은 역직렬화: LLM 응답의 JSON/도구 호출 파싱 취약점

mixed (복합 타입):
- 해당 파일 확장자에 맞는 위 섹션을 모두 적용한다.

[심각도 분류 기준]
- Critical: 즉시 악용 가능, 데이터 유출/시스템 장악 직결 → han-close **차단**
- High: 악용 가능성 높음, 인증 우회/권한 상승 → han-close **차단**
- Medium: 조건부 악용 가능, 정보 노출/서비스 영향 → 경고 (차단 없음)
- Low: 잠재적 위험, 모범 사례 위반 → 정보 출력 (차단 없음)
```

---

## Step 3: 취약점 발견 시 처리

### 3-1. 심각도별 분류 및 대응

security-reviewer 에이전트로부터 결과를 받아 심각도별로 처리한다.

| 심각도 | 대응 | han-close 영향 |
|--------|------|---------------|
| Critical | 즉시 수정 후 재검토 | 수정 완료 전까지 **차단** |
| High | 즉시 수정 후 재검토 | 수정 완료 전까지 **차단** |
| Medium | 경고 출력, 진행 허용 | 차단 없음 (경고 기록) |
| Low | 정보 출력, 진행 허용 | 차단 없음 (정보 기록) |

### 3-2. Critical/High 발견 시 흐름

```
Critical/High 취약점 발견
  │
  ├── executor 에이전트에 수정 위임
  │     (취약점 상세 내용, 영향 파일, 수정 방향 포함)
  │
  ├── 수정 완료 후 → Step 2 재실행 (재검토)
  │
  ├── 재검토 결과 통과 → Step 4로 이동
  │
  └── 재검토 3회 후에도 Critical/High 존재
        → "자동 수정 한계 도달. 수동 보안 검토가 필요합니다." 출력
        → 취약점 상세 목록 파일 저장: .han/state/security-findings.json
        → han-close 차단 유지, 사용자에게 수동 검토 요청
```

### 3-3. 재검토 횟수 추적

```bash
RETRY_COUNT=0
MAX_RETRY=3

while [ $RETRY_COUNT -lt $MAX_RETRY ]; do
  # 재검토 실행
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "보안 재검토 ($RETRY_COUNT/$MAX_RETRY)..."

  # Critical/High 없으면 루프 종료
  if [ "$CRITICAL_HIGH_COUNT" -eq 0 ]; then
    break
  fi
done

if [ $RETRY_COUNT -ge $MAX_RETRY ] && [ "$CRITICAL_HIGH_COUNT" -gt 0 ]; then
  SECURITY_STATUS=BLOCKED
else
  SECURITY_STATUS=PASS
fi
```

### 3-4. 취약점 발견 내용 저장

Critical/High 발견 시 `.han/state/security-findings.json` 저장:

```json
{
  "reviewed_at": "2025-03-22T10:00:00+09:00",
  "project_type": "cpp-office",
  "status": "BLOCKED",
  "retry_count": 3,
  "findings": [
    {
      "severity": "Critical",
      "owasp_category": "A03 - Injection",
      "file": "src/parser/hwp_reader.cpp",
      "line": 142,
      "description": "strcpy 사용으로 인한 스택 버퍼 오버플로우 가능성",
      "recommendation": "strncpy 또는 std::string 사용으로 교체"
    }
  ]
}
```

### 3-5. 컨텍스트 업데이트

SECURITY_STATUS 결정 후 `.han/state/sessions/{SESSION_ID}.json`의 `stage` 필드를 업데이트한다:

| SECURITY_STATUS | stage 업데이트 값 |
|----------------|-----------------|
| `BLOCKED` | `"security_blocked"` |
| `PASS` | `"code_done"` (유지 또는 명시) |
| `SKIP` | 기존 stage 변경 없음 |

BLOCKED 시 업데이트 예시:
```json
{
  "stage": "security_blocked",
  "security_findings_path": ".han/state/security-findings.json"
}
```

BLOCKED 시 Python 업데이트:
```python
import json, os
SESSION_ID = os.environ.get('CLAUDE_SESSION_ID', 'default')
ctx_path = f".han/state/sessions/{SESSION_ID}.json"
ctx = json.load(open(ctx_path)) if os.path.exists(ctx_path) else {}
ctx['stage'] = 'security_blocked'
ctx['security_findings_path'] = '.han/state/security-findings.json'
with open(ctx_path, 'w') as f:
    json.dump(ctx, f, ensure_ascii=False, indent=2)
```

> **중요**: 이 단계를 누락하면 han-close(Step 1)에서 `security_blocked` 상태를 감지하지 못해 보안 차단 흐름이 작동하지 않는다.

---

## Step 4: 보안 검토 결과 요약

### 통과 시

```
────────────────────────────────────────
보안 검토 결과
────────────────────────────────────────
✅ 심각한 취약점 없음
프로젝트 타입: {PROJECT_TYPE}
검토 파일 수: {FILE_COUNT}건
검토 기준: OWASP Top 10 + {PROJECT_TYPE} 특화 항목
────────────────────────────────────────
→ 다음: /han-dev:han-close (3단계: 마무리)
```

### Medium/Low 경고 포함 통과 시

```
────────────────────────────────────────
보안 검토 결과
────────────────────────────────────────
✅ Critical/High 취약점 없음 (진행 가능)
⚠️  Medium ({N}건):
  · [A09] src/utils/logger.cpp:88
    에러 메시지에 스택 트레이스 노출 가능성
    → 권고: 프로덕션 환경에서 상세 에러 비활성화
ℹ️  Low ({N}건):
  · [A05] config/app.config:12
    디버그 모드 플래그 활성화 상태
    → 권고: 배포 전 디버그 플래그 비활성화 확인
────────────────────────────────────────
→ 다음: /han-dev:han-close (3단계: 마무리)
```

### 차단 시 (Critical/High 미해결)

```
────────────────────────────────────────
보안 검토 결과
────────────────────────────────────────
🚫 보안 검토 실패 — han-close 진행 차단
Critical ({N}건) / High ({N}건) 취약점 미해결

미해결 항목:
  🔴 [Critical] A03 - Injection
     파일: src/parser/hwp_reader.cpp:142
     내용: strcpy 사용으로 인한 스택 버퍼 오버플로우
     조치: strncpy 또는 std::string으로 교체 필요

자동 수정 한계 도달 (3회 재시도). 수동 보안 검토가 필요합니다.
상세 결과: .han/state/security-findings.json
────────────────────────────────────────
han-close를 진행하려면 위 취약점을 수동으로 수정한 뒤
/han-dev:han-security 를 다시 실행하세요.
```

---

## 에러 처리

| 상황 | 대응 |
|------|------|
| git 명령 실패 (git 저장소 아님) | "git 저장소가 아닙니다. 프로젝트 루트에서 실행하세요." 후 `SECURITY_STATUS=SKIP` |
| security-reviewer 에이전트 응답 없음 | 30초 대기 후 1회 재시도. 재실패 시 "보안 검토 에이전트 응답 없음. 수동 검토 권장." 경고 후 `SECURITY_STATUS=SKIP` |
| 변경 파일 없음 | "변경 파일 없음. 보안 검토 건너뜀." 출력 후 `SECURITY_STATUS=PASS` |
| .han/state 디렉토리 없음 | `mkdir -p .han/state` 후 계속 진행 |
| 프로젝트 타입 감지 실패 | `mixed` 타입으로 폴백, 모든 특화 위험 목록 적용 |

---

## 위임 관계

```
han-code (2단계)
└── han-security  [이 스킬 — 내부 sub-skill]
      └── security-reviewer 에이전트  보안 취약점 탐지
            └── executor 에이전트     Critical/High 취약점 수정
```

반환값 (`SECURITY_STATUS`):

| 값 | 의미 |
|----|------|
| `PASS` | 취약점 없음 또는 Medium/Low만 존재. han-close 진행 허용 |
| `BLOCKED` | Critical/High 미해결. han-close 차단 |
| `SKIP` | 검토 불가(git 오류, 에이전트 응답 없음). 경고 후 han-close 허용 |
