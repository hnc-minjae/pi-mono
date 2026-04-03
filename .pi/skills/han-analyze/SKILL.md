---
name: han-analyze
description: 이슈 기반 코드 분석 및 영향 범위 파악 전용 sub-skill. clangd LSP(C++), Grep/Read(기타)를 활용하여 수정 대상 코드와 side-effect 범위를 구조화하여 출력한다. han-code, han-tdd에서 위임받거나 단독으로 사용할 수 있다. 코드 수정·구현 전 영향 범위를 파악해야 할 때 반드시 이 스킬을 사용한다. "코드 분석", "영향 범위", "영향받는 파일", "어디를 수정", "어떤 코드가 관련", "어떤 파일이 관련", "의존성 파악", "수정 대상 파악", "side-effect 확인", "코드 탐색", "analyze" 등의 키워드·질문에 반응한다.
user_invocable: true
argument: "[ISSUE_KEY 또는 이슈 설명] — 예: /han-dev:han-analyze AIAGENT-123 또는 /han-dev:han-analyze 'PDF 한글 폰트 렌더링 오류'"
---

# 코드 분석 및 영향 범위 파악 워크플로우

이슈 제목/description을 기반으로 관련 코드를 탐색하고, 수정 시 영향받는 범위를 구조화하여 출력한다.
han-tdd(2단계)와 han-code(개발 단계)에서 분석 입력으로 사용한다.

```
[이 스킬의 범위]
✅ 프로젝트 타입 자동 감지 (C++, C#, Java, Python, JS/TS)
✅ 이슈 기반 관련 코드 탐색
✅ C++ — clangd LSP 우선 활용 (lsp_goto_definition, lsp_find_references, lsp_diagnostics)
✅ C# — clangd 미지원이므로 Grep + Read 방식으로 분석
✅ Non-C++ — Grep + Read로 탐색
✅ Side-effect 분석 (수정 예정 심볼을 참조하는 위치 파악)
✅ 구조화된 분석 결과 출력 (수정 파일 목록, 영향 범위, 구현 계획)
❌ 코드 수정 (→ executor 에이전트 담당)
❌ 테스트 작성 (→ han-tdd 담당)
❌ 빌드/실행 (→ han-tdd 또는 직접 실행)
```

---

## Step 0: 컨텍스트 로드

### 0-A: 이슈 정보 확인

인자가 Jira 이슈 키(`[A-Z]+-\d+` 패턴)이면 컨텍스트 파일에서 이슈 정보를 읽는다:

```bash
# 저장된 개발 컨텍스트 확인
SESSION_ID="${CLAUDE_SESSION_ID:-default}"
CTX_PATH=".han/state/sessions/${SESSION_ID}.json"
if [ -f "$CTX_PATH" ]; then
  cat "$CTX_PATH"
fi
```

컨텍스트 파일이 없거나 인자가 이슈 설명 텍스트이면 해당 텍스트를 분석 키워드로 사용한다.

### 0-B: 프로젝트 타입 감지

현재 디렉토리(또는 지정 경로)에서 빌드 파일 존재 여부로 프로젝트 타입을 판단한다.

빌드 파일 존재 여부로 프로젝트 타입을 자동 감지한다:

| 감지 조건 | 프로젝트 타입 |
|-----------|--------------|
| `CMakeLists.txt` 또는 `*.pro` 존재 | `cpp` |
| `*.csproj` 또는 `*.sln` 존재 | `csharp` |
| `pom.xml` 존재 | `java-maven` |
| `build.gradle` 또는 `build.gradle.kts` 존재 | `java-gradle` |
| `package.json` 존재 | `nodejs` |
| `requirements.txt` 또는 `pyproject.toml` 존재 | `python` |
| 위 어느 것도 없음 | `unknown` → 사용자에게 직접 선택 요청 |

| 감지 결과 | 분석 방법 | 테스트 프레임워크 |
|-----------|-----------|------------------|
| `cpp` | clangd LSP 우선, Grep 보조 | GTest |
| `csharp` | Grep + Read (clangd 미지원) | NUnit / xUnit |
| `java-maven` / `java-gradle` | Grep + Read | JUnit 5 |
| `nodejs` | Grep + Read | Jest |
| `python` | Grep + Read | pytest |
| `unknown` | Grep + Read (수동 판단) | 사용자 확인 |

---

## Step 1: 이슈 기반 키워드 추출

이슈 제목 또는 설명에서 탐색 키워드를 추출한다.

```
분석 대상 예시:
  이슈: "[PDF] 한글 폰트 렌더링 오류 — 특수문자 깨짐"
  → 키워드: PdfRender, FontRender, HwpFont, RenderFont, CFont, CPdf
  → 디렉토리 힌트: src/hwp/pdf/, include/hwp/
```

키워드 추출 기준:
- 이슈 제목의 `[컴포넌트]` prefix → 디렉토리 힌트
- 명사형 기술 용어 → 클래스/함수명 검색어
- 동사형 행위 → 함수명 검색어 (예: "렌더링" → Render, "저장" → Save, Export)

---

## Step 2: 코드 탐색

### 2-A: C++ 프로젝트 (clangd LSP 우선)

#### 초기 탐색 — Grep으로 후보 파일 식별

```bash
# 키워드로 헤더/소스 파일에서 후보 식별
grep -rn --include="*.h" --include="*.cpp" \
  -e "RenderFont" -e "CPdfRenderer" \
  src/ include/ \
  | head -40
```

#### LSP 심층 탐색

후보 파일을 식별한 후 LSP로 정확한 정의와 참조를 파악한다:

```
# 함수/클래스 정의 탐색
lsp_goto_definition(file_path, line, character)
→ 정의 위치(파일, 줄번호) 반환

# 참조 위치 전체 파악 (side-effect 핵심)
lsp_find_references(file_path, line, character)
→ 이 심볼을 사용하는 모든 위치 목록 반환

# 현재 진단 오류 확인
lsp_diagnostics(file_path)
→ 컴파일 경고/오류 목록 반환
```

탐색 순서:
1. Grep으로 수정 대상 클래스/함수가 있는 파일 식별
2. `lsp_goto_definition`으로 정의 위치 확정
3. `lsp_find_references`로 해당 심볼을 참조하는 모든 위치 수집
4. `lsp_diagnostics`로 현재 진단 오류 확인 (수정 전 baseline)

#### 설계 검토 위임 (선택)

수정 범위가 넓거나 아키텍처 결정이 필요한 경우:
```
→ architect 에이전트에 위임하여 설계 검토
```

### 2-B: 비 C++ 언어 분석

| 언어 | 분석 도구 | 방법 |
|------|---------|------|
| TypeScript/JS | tsserver LSP (활성화됨) | lsp_find_references, lsp_goto_definition 우선 → Grep 보완 |
| Java | Grep+Read + context7 | 클래스 탐색 후 라이브러리 API 문서 조회 시 context7 활용 |
| Python | Grep+Read + context7 | 모듈 탐색 후 외부 패키지 문서 조회 시 context7 활용 |
| C# | Grep+Read | Roslyn LSP 미통합 — Grep 표면 탐색 |

#### TypeScript/JS — tsserver LSP 우선

TypeScript/JS 프로젝트(`nodejs` 타입)에서는 tsserver LSP를 우선 활용한다:

```
# 타입 정의 탐색
lsp_goto_definition(file_path, line, character)
→ TypeScript 타입/인터페이스 정의 위치 반환

# 사용처 탐색 (side-effect 핵심)
lsp_find_references(file_path, line, character)
→ 이 심볼을 사용하는 모든 파일·위치 목록 반환

# 타입 오류 확인
lsp_diagnostics(file_path)
→ TypeScript 컴파일러 타입 오류 목록 반환
```

탐색 순서:
1. Grep으로 수정 대상 함수/타입/클래스 파일 식별
2. `lsp_goto_definition`으로 정의 위치 확정
3. `lsp_find_references`로 참조 위치 전체 수집
4. `lsp_diagnostics`로 현재 타입 오류 확인 (수정 전 baseline)
5. Grep으로 LSP 결과 보완 (import 패턴 등)

#### Java/Python — Grep + Read + context7

Grep+Read로 코드를 탐색하고, 외부 라이브러리 API 문서가 필요한 경우 context7 MCP를 활용한다:

```
# 외부 라이브러리 문서 조회 예시 (context7)
- Spring Boot 어노테이션: mcp__plugin_context7_context7__resolve-library-id 후 query-docs
- Java Stream API: context7로 java 문서 조회
- Python FastAPI: context7로 fastapi 문서 조회
- 기타 npm/pypi 패키지: 패키지명으로 resolve-library-id 후 query-docs
```

> `{KEYWORD}` 자리에 Step 1에서 추출한 키워드를 채워 실행한다.

언어별 grep 탐색 패턴 (C++ 이외):

```bash
# C# (clangd 미지원)
grep -rn --include="*.cs" -e "class {KEYWORD}" -e "{KEYWORD}" .

# Java
grep -rn --include="*.java" -e "class {KEYWORD}" -e "{keyword}" src/main/ src/test/

# Python
grep -rn --include="*.py" -e "def {keyword}" -e "class {KEYWORD}" .

# JS/TS
grep -rn --include="*.ts" --include="*.js" -e "{keyword}" -e "class {KEYWORD}" -e "export.*{KEYWORD}" src/
```

탐색 후 후보 파일을 Read로 읽어 함수 시그니처, 의존성 import, 호출 패턴을 파악한다.

---

## Step 3: Side-effect 분석

수정 예정 함수/클래스를 참조하는 모든 위치를 파악한다.

### C++ — LSP 기반

`lsp_find_references` 결과를 기준으로 참조 위치를 분류한다:

| 참조 위치 유형 | 설명 | 위험도 |
|----------------|------|--------|
| 같은 클래스 내 | 내부 호출 | 낮음 |
| 다른 클래스에서 직접 호출 | 외부 의존 | 중간 |
| 가상 함수 오버라이드 | 다형성 영향 | 높음 |
| 외부 모듈/라이브러리 경계 | ABI 변경 가능 | 높음 |

### Non-C++ — Grep 기반

```bash
# 수정 예정 심볼을 import/require/call하는 파일 목록
grep -rn "PdfRenderer\|renderFont" \
  --include="*.java" --include="*.py" --include="*.ts" \
  . | grep -v "^Binary"
```

---

## Step 4: 분석 결과 출력

```
────────────────────────────────────────────────────
  코드 분석 결과
  이슈: {ISSUE_KEY} — {ISSUE_TITLE}
  프로젝트 타입: {PROJECT_TYPE}
────────────────────────────────────────────────────

  주요 수정 대상:
  - {파일 경로} ({역할 설명})
    예) src/hwp/pdf/CPdfRenderer.cpp (렌더링 로직 구현)
  - {파일 경로} ({역할 설명})
    예) include/hwp/pdf/CPdfRenderer.h (클래스 선언)

  Side-effect 범위:
  - {호출자 클래스}::{함수명}() — {파일 경로}:{줄번호}  [위험도: 낮음|중간|높음]
    예) CHwpDocument::Export() — src/hwp/CHwpDocument.cpp:287  [위험도: 중간]
  - {호출자 클래스}::{함수명}() — {파일 경로}:{줄번호}  [위험도: 낮음|중간|높음]
    예) CPdfExporter::Run() — src/hwp/pdf/CPdfExporter.cpp:154  [위험도: 중간]

  현재 진단 오류: (C++ LSP 기준)
  - {파일 경로}:{줄번호} — {오류 내용}
    (없으면: "진단 오류 없음 — 수정 전 baseline 정상")

  구현 계획:
  1. {수정 대상 함수/클래스} — {작업 내용}
     예) CPdfRenderer::RenderFont() — 한글 폰트 인코딩 처리 추가
  2. {수정 대상 함수/클래스} — {작업 내용}
  ...

  추가 확인 필요:
  - {불확실한 사항 또는 설계 결정이 필요한 항목}
────────────────────────────────────────────────────
```

분석 결과는 `.han/state/han-analyze-result.json`에 저장한다:

```bash
python3 -c "
import json
from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))

result = {
    'issue_key': '$ISSUE_KEY',
    'project_type': '$PROJECT_TYPE',
    'analyzed_at': datetime.now(KST).isoformat(),
    # 아래 필드는 위 분석 결과로 실제 값을 채워 저장 (빈 리스트가 아님):
    'target_files': [],       # Step 2 결과: 수정 대상 파일 목록
    'side_effect_refs': [],   # Step 3 결과: side-effect 참조 위치 목록
    'impl_plan': [],          # Step 4 결과: 구현 계획 단계 목록
    'diagnostics_baseline': [] # Step 2-A lsp_diagnostics 결과 (C++ 전용)
}

json.dump(result, open('.han/state/han-analyze-result.json', 'w'),
          ensure_ascii=False, indent=2)
print('분석 결과 저장: .han/state/han-analyze-result.json')
"
```

---

## 에러 처리

| 상황 | 대응 |
|------|------|
| 프로젝트 타입 감지 실패 | 사용자에게 타입 직접 선택 요청 (cpp / java / python / nodejs) |
| LSP 서버 미응답 (C++) | "clangd가 응답하지 않습니다. clangd 실행 여부를 확인하세요." 후 Grep으로 대체 |
| 키워드로 파일을 찾지 못함 | 키워드 변형 시도 (예: RenderFont → render_font, renderFont) 후 재탐색 |
| 참조 위치 50개 초과 | 상위 20개만 표시 후 "추가 참조는 .han/state/han-analyze-result.json 참조" 안내 |
| `lsp_find_references` 결과 없음 | Grep 보조 탐색으로 대체, "LSP 참조 없음 — Grep 결과로 대체" 표시 |

---

## 하위 스킬 위임 관계

```
han-analyze
├── [입력] han-tdd, han-code  (분석 결과 요청)
└── [위임] architect 에이전트     (설계 검토, 선택적)
```
