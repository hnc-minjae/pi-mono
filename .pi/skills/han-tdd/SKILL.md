---
name: han-tdd
description: 한컴 프로젝트 TDD 사이클 전용 sub-skill. RED(실패 테스트) → GREEN(최소 구현) → REFACTOR(리팩터링) 사이클을 강제하며, mock 최소화·실제 시나리오 테스트를 원칙으로 한다. C++(GTest), C#(NUnit/xUnit), Java(JUnit), Python(pytest), JS/TS(Jest)를 지원한다. "tdd", "테스트 주도", "RED GREEN" 키워드에 반응한다.
user_invocable: true
argument: "[ISSUE_KEY 또는 구현 기능 설명] — 예: /han-dev:han-tdd AIAGENT-123 또는 /han-dev:han-tdd 'PDF 한글 폰트 렌더링 수정'"
---

# TDD 사이클 워크플로우 (RED → GREEN → REFACTOR)

실제 컴포넌트/모듈을 사용하는 시나리오 테스트를 작성하고, TDD 사이클을 엄격히 따른다.
단순 mock 기반 테스트는 금지한다 — 실제 동작을 검증해야 한다.

```
[이 스킬의 범위]
✅ 프로젝트 타입 자동 감지 (C++, C#, Java, Python, JS/TS)
✅ 기존 테스트 구조 파악
✅ 실패 테스트 작성 (RED) — 실제 시나리오 기반
✅ 테스트 실행 및 RED 확인 (프로젝트 타입별 분기: C++→cmake/ctest 직접 실행, 그 외→직접 실행)
✅ 최소 구현 (executor 에이전트 위임)
✅ 테스트 실행 및 GREEN 확인 (프로젝트 타입별 분기: C++→cmake/ctest 직접 실행, 그 외→직접 실행)
✅ 리팩터링 및 전체 테스트 재실행 (프로젝트 타입별 분기)
✅ 결과 요약
❌ 코드 설계 결정 (→ architect 에이전트 담당)
❌ 빌드 오류 직접 수정 (→ debugger 에이전트 위임)
```

---

## TDD 철학 (이 스킬의 핵심 원칙)

**단순 mock 금지 — 실제 시나리오 테스트를 작성한다.**

| 상황 | 금지 (mock) | 권장 (실제 시나리오) |
|------|-------------|----------------------|
| PDF 렌더링 버그 | `MockRenderer.render()` stub | 실제 한글 폰트가 포함된 `.hwp` 파일로 렌더링 |
| API 응답 파싱 버그 | `mock.return_value = {...}` | 실제 API 엔드포인트 또는 실제 DB 연결 |
| 파일 저장 버그 | `MockFileSystem.write()` stub | 임시 디렉토리에 실제 파일 저장 후 읽기 검증 |
| 네트워크 의존 기능 | `mock.patch('requests.get')` | 테스트 서버 또는 실제 테스트 환경 엔드포인트 |

mock이 불가피한 경우 (외부 서비스, 하드웨어 의존):
- 팀 공유 테스트 픽스처(fixture) 파일 사용
- 테스트 코드에 `# MOCK: 이유 — {사유}` 주석 필수

---

## Step 0: 프로젝트 타입 감지

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

| 프로젝트 타입 | 테스트 프레임워크 | 테스트 파일 패턴 | 실행 명령 |
|---------------|-------------------|------------------|-----------|
| `cpp` | GTest | `*_test.cpp`, `test_*.cpp` | `ctest` / `./build/tests` |
| `csharp` | NUnit / xUnit | `*Tests.cs`, `*Test.cs` | `dotnet test` |
| `java-maven` | JUnit 5 | `*Test.java`, `*Tests.java` | `mvn test` |
| `java-gradle` | JUnit 5 | `*Test.java`, `*Tests.java` | `gradle test` |
| `nodejs` | Jest | `*.test.ts`, `*.spec.ts` | `npm test` |
| `python` | pytest | `test_*.py`, `*_test.py` | `pytest` |

---

## Step 1: 기존 테스트 구조 파악

테스트 디렉토리와 기존 테스트 패턴을 파악한다.

```bash
# 테스트 디렉토리 탐색
find . -type d -name "test" -o -name "tests" -o -name "__tests__" \
  | grep -v node_modules | grep -v build | grep -v ".git"

# C++: *_test.cpp, test_*.cpp 탐색
find . -name "*_test.cpp" -o -name "test_*.cpp" | grep -v build

# C#: *Tests.cs, *Test.cs 탐색
find . -name "*Tests.cs" -o -name "*Test.cs" | grep -v bin | grep -v obj

# Java: *Test.java 탐색
find . -name "*Test.java" | grep -v target

# Python: test_*.py 탐색
find . -name "test_*.py"

# JS/TS: *.test.ts, *.spec.ts 탐색
find . -name "*.test.ts" -o -name "*.spec.ts" | grep -v node_modules
```

기존 테스트 파일 1~2개를 Read로 읽어 다음을 파악한다:
- 테스트 픽스처(fixture) 파일 경로
- `TEST_F` 사용 클래스 이름 패턴 (C++)
- Setup/Teardown 패턴
- 테스트 데이터 위치 (예: `testdata/`, `resources/test/`)

han-analyze 결과가 있으면 로드한다:
```bash
[ -f ".han/state/han-analyze-result.json" ] && \
  echo "han-analyze 결과 로드: .han/state/han-analyze-result.json"
```

---

## Step 1-5: 사전 빌드/컴파일 검사 (선택적)

테스트 작성 전 기본 컴파일이 가능한지 확인한다.
실패 시 → `debugger 에이전트`에 위임하여 빌드 오류 수정 후 재진행.

| 프로젝트 타입 | 검사 명령 | 실패 처리 |
|-------------|---------|---------|
| `java-maven` | `mvn compile -q 2>&1 \| tail -5` | 컴파일 오류 → debugger 위임 후 재실행 |
| `java-gradle` | `./gradlew compileJava -q 2>&1 \| tail -5` | 컴파일 오류 → debugger 위임 후 재실행 |
| `nodejs` | `npx tsc --noEmit 2>&1 \| head -10` | 타입 오류 → 수정 후 재시도 |
| `python` | `python -m mypy . --ignore-missing-imports -q 2>&1 \| head -5` | 경고 표시 후 계속 진행 |
| `csharp` | `dotnet build -c Release -q 2>&1 \| tail -5` | 빌드 오류 → debugger 위임 후 재실행 |
| `cpp` | cmake --build 결과로 판단 (기존 방식 유지) | — |

> 이 단계는 선택적이다. 환경에 컴파일러/빌드 도구가 없으면 건너뛴다.

---

## Step 2: 실패 테스트 작성 (RED)

**TDD 철칙: 구현 코드보다 테스트를 먼저 작성한다.**

han-analyze에서 파악한 수정 대상 함수/클래스를 기반으로 실패 테스트를 작성한다.

### 테스트 이름 규칙

테스트 이름은 **기대 동작**을 서술한다. 구현 세부사항(함수명, 매개변수)을 서술하지 않는다.

| 나쁜 예 | 좋은 예 |
|---------|---------|
| `test_RenderFont_called` | `한글_폰트_포함_PDF_렌더링_시_특수문자_깨짐_없음` |
| `test_API_returns_200` | `유효한_사용자_ID로_요청하면_사용자_정보를_반환한다` |
| `testSaveFile` | `저장_후_동일_경로에서_읽으면_원본과_동일하다` |

### 프레임워크별 테스트 패턴

PROJECT_TYPE에 맞는 패턴을 참고하여 실제 파일명·클래스명에 맞게 적용한다.

#### 공통 원칙

- mock 최소화 — 실제 픽스처 파일과 실제 컴포넌트를 사용한다
- 테스트 이름은 **기대 동작**을 서술한다 (구현 세부사항 x)
- mock이 불가피한 경우 `# MOCK: 이유 — {사유}` 주석 필수

#### C++ (GTest)

```cpp
class CPdfRendererTest : public ::testing::Test {
protected:
    void SetUp() override {
        m_strFixturePath = "testdata/hwp/font_test_hangul.hwp";
    }
    CString m_strFixturePath;
    CPdfRenderer m_renderer;
};

TEST_F(CPdfRendererTest, 한글_폰트_포함_PDF_렌더링_시_특수문자_깨짐_없음) {
    // Arrange — 실제 HWP 파일 로드
    CHwpDocument doc;
    ASSERT_TRUE(doc.Load(m_strFixturePath));
    // Act — 실제 렌더링 실행
    CString strOutputPath = "testdata/output/font_test_output.pdf";
    bool bResult = m_renderer.Render(doc, strOutputPath);
    // Assert — 실제 출력 파일 검증
    EXPECT_TRUE(bResult);
}
```

**실행**: `cmake --build {빌드 디렉토리} && ctest --test-dir {빌드 디렉토리} -R {테스트명} -V`

#### C# (NUnit / xUnit)

```csharp
[Test]  // xUnit의 경우 [Fact]로 대체
public void 한글_폰트_포함_PDF_렌더링_시_특수문자_깨짐_없음()
{
    // Arrange — 실제 픽스처 파일 사용
    var renderer = new PdfRenderer();
    // Act
    var result = renderer.Render(_fixturePath, "testdata/output/font_test_output.pdf");
    // Assert
    Assert.IsTrue(result.Success);
}
```

**실행**: `dotnet test --filter "FullyQualifiedName~{테스트클래스}"`

#### Java (JUnit 5)

```java
@Test
void 한글_폰트_포함_PDF_렌더링_시_특수문자_깨짐_없음() {
    // Arrange — 실제 픽스처 파일 사용
    Path fixturePath = Path.of("src/test/resources/font_test_hangul.hwp");
    PdfRenderer renderer = new PdfRenderer();
    // Act
    RenderResult result = renderer.render(fixturePath);
    // Assert
    assertThat(result.isSuccess()).isTrue();
}
```

**실행 (Maven)**: `mvn test -pl {모듈} -Dtest={테스트클래스}`
**실행 (Gradle)**: `./gradlew test --tests {테스트클래스}`

#### Python (pytest)

```python
FIXTURE_DIR = Path("tests/fixtures")

def test_한글_폰트_포함_PDF_렌더링_시_특수문자_깨짐_없음():
    fixture_path = FIXTURE_DIR / "font_test_hangul.hwp"
    renderer = PdfRenderer()
    result = renderer.render(fixture_path)
    assert result.success is True
```

**실행**: `python -m pytest {test_file} -v`

#### JS/TS (Jest)

```typescript
describe('PdfRenderer', () => {
    it('한글 폰트 포함 PDF 렌더링 시 특수문자 깨짐 없음', async () => {
        const fixturePath = path.join(FIXTURE_DIR, 'font_test_hangul.hwp');
        const renderer = new PdfRenderer();
        const result = await renderer.render(fixturePath);
        expect(result.success).toBe(true);
    });
});
```

**실행**: `npm test -- --testPathPattern={test_file}`

---

## Step 3: 테스트 실행 → 실패 확인 (RED)

**테스트가 반드시 실패해야 한다. 통과하면 테스트가 잘못된 것이다.**

프로젝트 타입별 테스트 실행:

| 프로젝트 타입 | 실행 방법 |
|---------------|-----------|
| `cpp` | `cmake --build {빌드 디렉토리} && ctest --test-dir {빌드 디렉토리} -R {테스트명} -V` 직접 실행 |
| `csharp` | `dotnet test --filter "FullyQualifiedName~{테스트클래스}"` 직접 실행 |
| `java-maven` | `mvn test -pl {모듈} -Dtest={테스트클래스}` 직접 실행 |
| `java-gradle` | `./gradlew test --tests {테스트클래스}` 직접 실행 |
| `python` | `python -m pytest {test_file} -v` 직접 실행 |
| `nodejs` | `npm test -- --testPathPattern={test_file}` 직접 실행 |

결과 판단:

| 결과 | 대응 |
|------|------|
| **테스트 실패 (예상)** | "RED 확인 완료 — Step 4로 진행" |
| **테스트 통과 (경고)** | "이미 통과하는 테스트입니다. 다음을 확인하세요:\n  1. 테스트가 실제 버그를 재현하고 있는지 확인\n  2. 픽스처 파일이 문제 케이스를 포함하는지 확인\n  3. 검증 assert가 충분히 엄격한지 확인" → 테스트 보완 후 재실행 |
| **컴파일/빌드 오류** | "테스트 코드 컴파일 오류 — Step 2로 돌아가 테스트 코드 수정" |
| **빌드/테스트 실행 실패 (환경 문제)** | `debugger 에이전트`에 위임하여 원인 분석 |

---

## Step 4: 최소 구현 (GREEN을 위한 코드)

**최소한의 코드만 작성한다. 테스트를 통과시키는 것 외의 코드는 작성하지 않는다.**

```
→ executor 에이전트 에이전트에 위임
   지시사항: "테스트를 통과시키는 최소한의 구현만 작성하세요.
              불필요한 최적화, 추가 기능, 예외 처리는 Step 6(리팩터링)에서 합니다."
```

han-analyze 결과(`han-analyze-result.json`)를 executor에게 전달하여 수정 대상 파일과 구현 계획을 공유한다.

---

## Step 5: 테스트 실행 → 통과 확인 (GREEN)

프로젝트 타입별 테스트 실행:

| 프로젝트 타입 | 실행 방법 |
|---------------|-----------|
| `cpp` | `cmake --build {빌드 디렉토리} && ctest --test-dir {빌드 디렉토리} -R {테스트명} -V` 직접 실행 |
| `java-maven` | `mvn test -pl {모듈} -Dtest={테스트클래스}` 직접 실행 |
| `java-gradle` | `./gradlew test --tests {테스트클래스}` 직접 실행 |
| `python` | `python -m pytest {test_file} -v` 직접 실행 |
| `nodejs` | `npm test -- --testPathPattern={test_file}` 직접 실행 |

결과 판단:

| 결과 | 대응 |
|------|------|
| **테스트 통과** | "GREEN 확인 완료 — Step 6 리팩터링으로 진행" |
| **테스트 실패** | `debugger 에이전트`에 위임하여 원인 분석 → Step 4 재실행 (최대 5회) |
| **5회 초과 실패** | "자동 수정 한계 도달. 수동 검토가 필요합니다:\n  - 빌드 로그: /tmp/han-build-output.log\n  - 분석 결과: .han/state/han-analyze-result.json" 안내 후 중단 |

디버거 위임 시 전달 정보:
```
- 실패한 테스트 이름 및 오류 메시지
- han-analyze-result.json (수정 대상 파일 목록)
- 빌드 로그 (/tmp/han-build-output.log)
- 시도 횟수 (N/5)
```

---

## Step 6: 리팩터링 (REFACTOR)

**테스트가 GREEN인 상태를 유지하면서 코드 품질을 개선한다.**

```
→ executor 에이전트 에이전트에 위임
   지시사항: "테스트를 깨지 않으면서 다음을 개선하세요:
              1. 한컴 C++ 명명 규칙 준수 (C prefix, m_ 멤버, p prefix 포인터)
              2. 중복 코드 제거
              3. 함수/클래스 책임 단순화
              4. 주석 정리"
```

리팩터링 후 전체 테스트 재실행으로 side-effect가 없는지 확인한다:

프로젝트 타입별 전체 테스트 실행:

| 프로젝트 타입 | 실행 방법 |
|---------------|-----------|
| `cpp` | `cmake --build {빌드 디렉토리} && ctest --test-dir {빌드 디렉토리} -V` 직접 실행 |
| `java-maven` | `mvn test` 직접 실행 |
| `java-gradle` | `./gradlew test` 직접 실행 |
| `python` | `python -m pytest -v` 직접 실행 |
| `nodejs` | `npm test` 직접 실행 |

| 결과 | 대응 |
|------|------|
| **전체 통과** | "REFACTOR 완료 — Step 7 결과 요약으로 진행" |
| **기존 테스트 실패** | "리팩터링으로 side-effect 발생. executor에게 수정 요청 후 재실행" |

---

## Step 7: 결과 요약

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TDD 사이클 완료
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  이슈: {ISSUE_KEY} — {ISSUE_TITLE}
  프레임워크: {GTest|JUnit|pytest|Jest}
────────────────────────────────────────
  RED   → {테스트 파일 경로}
           테스트명: {테스트 이름}
  GREEN → {구현 파일 경로} ({수정 줄 수}줄 변경)
  REFACTOR → {정리된 항목 요약}
────────────────────────────────────────
  전체 테스트 결과: {N}개 통과 / {M}개 실패
  시도 횟수: {N}회 (최대 5회)
────────────────────────────────────────
→ 다음: /han-dev:han-close  (MR 생성 + Jira 완료)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

결과를 컨텍스트 파일에 저장한다:

```bash
python3 -c "
import json
from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))

import os
SESSION_ID = os.environ.get('CLAUDE_SESSION_ID', 'default')
ctx_path = f".han/state/sessions/{SESSION_ID}.json"
try:
    ctx = json.load(open(ctx_path))
except FileNotFoundError:
    ctx = {}

ctx.update({
    'tdd_completed_at': datetime.now(KST).isoformat(),
    'tdd_test_file': '$TEST_FILE_PATH',
    'tdd_impl_files': [],   # 수정된 구현 파일 목록
    'tdd_attempts': $ATTEMPT_COUNT,
    'stage': 'tdd_done'
})

json.dump(ctx, open(ctx_path, 'w'), ensure_ascii=False, indent=2)
print('TDD 결과 저장 완료')
"
```

---

## 에러 처리

| 상황 | 대응 |
|------|------|
| han-analyze 결과 없음 | "han-analyze 결과가 없습니다. 먼저 `/han-dev:han-analyze`를 실행하거나 이슈 설명을 제공하세요." |
| 프로젝트 타입 감지 실패 | 사용자에게 직접 선택 요청: "프로젝트 타입을 선택하세요: [1] C++ [2] Java [3] Python [4] JS/TS" |
| 테스트 픽스처 파일 없음 | "테스트 픽스처 파일이 없습니다. 실제 시나리오 파일을 다음 경로에 준비하세요: testdata/" 안내 |
| 5회 시도 후 GREEN 미달 | 빌드 로그 경로 안내, "수동 검토가 필요합니다" 후 중단 |
| 리팩터링 후 기존 테스트 실패 | executor에게 side-effect 수정 요청, 전체 테스트 재실행 |

---

## OMC 에이전트 위임 관계

```
han-tdd
├── [입력]  han-analyze          코드 분석 결과 (수정 대상, side-effect 범위)
├── [직접]  cmake/ctest          테스트 빌드 + 실행 — C++/Qt 프로젝트 (Step 3, 5, 6)
├── [직접]  mvn/gradle/pytest/npm  테스트 실행 — non-C++ 프로젝트 (Step 3, 5, 6)
├── [위임]  executor 에이전트    최소 구현 작성 (Step 4), 리팩터링 (Step 6)
└── [위임]  debugger 에이전트   빌드/테스트 실패 원인 분석 (Step 3, 5 실패 시)
```

## 하위 스킬 호출 관계

```
han-tdd
└── → han-analyze   (분석 결과 없을 때 자동 호출)
```
