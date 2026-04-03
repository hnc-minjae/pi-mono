# TDD 테스트 패턴 참조

> 이 파일은 스킬이 아닌 참조 문서입니다.
> han-tdd에서 언어별 테스트 예제로 참조합니다.
> PROJECT_TYPE에 맞는 섹션을 Read로 읽어 사용합니다.

## 공통 원칙

- mock 최소화 — 실제 픽스처 파일과 실제 컴포넌트를 사용한다
- 테스트 이름은 **기대 동작**을 서술한다 (구현 세부사항 x)
- mock이 불가피한 경우 `# MOCK: 이유 — {사유}` 주석 필수

| 나쁜 예 | 좋은 예 |
|---------|---------|
| `test_RenderFont_called` | `한글_폰트_포함_PDF_렌더링_시_특수문자_깨짐_없음` |
| `test_API_returns_200` | `유효한_사용자_ID로_요청하면_사용자_정보를_반환한다` |

---

## C++ (GTest)

```cpp
// 파일: src/hwp/pdf/CPdfRenderer_test.cpp
#include <gtest/gtest.h>
#include "hwp/pdf/CPdfRenderer.h"

// 실제 픽스처 파일 사용 — mock 금지
class CPdfRendererTest : public ::testing::Test {
protected:
    void SetUp() override {
        // 실제 한글 폰트가 포함된 테스트 HWP 파일 경로
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
    EXPECT_TRUE(/* PDF 텍스트에 특수문자 올바른지 검증 */);
}
```

**실행**: `cmake --build {빌드 디렉토리} && ctest --test-dir {빌드 디렉토리} -R {테스트명} -V`

---

## C# (NUnit / xUnit)

```csharp
// 파일: Tests/PdfRendererTests.cs
using NUnit.Framework;  // NUnit: [Test], xUnit: [Fact]

[TestFixture]
public class PdfRendererTests
{
    private string _fixturePath;

    [SetUp]
    public void SetUp()
    {
        // 실제 한글 폰트가 포함된 테스트 HWP 파일 경로
        _fixturePath = "testdata/hwp/font_test_hangul.hwp";
    }

    [Test]  // xUnit의 경우 [Fact]로 대체
    public void 한글_폰트_포함_PDF_렌더링_시_특수문자_깨짐_없음()
    {
        // Arrange — 실제 픽스처 파일 사용
        var renderer = new PdfRenderer();

        // Act — 실제 렌더링 실행
        var result = renderer.Render(_fixturePath, "testdata/output/font_test_output.pdf");

        // Assert — 실제 출력 검증
        Assert.IsTrue(result.Success);
        Assert.IsFalse(result.Text.Contains("?"));
        Assert.IsFalse(result.Text.Contains("□"));
    }
}
```

**실행**: `dotnet test --filter "FullyQualifiedName~{테스트클래스}"`

---

## Java (JUnit 5)

```java
// 파일: src/test/java/com/hancom/pdf/PdfRendererTest.java
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class PdfRendererTest {

    @Test
    void 한글_폰트_포함_PDF_렌더링_시_특수문자_깨짐_없음() {
        // Arrange — 실제 픽스처 파일 사용
        Path fixturePath = Path.of("src/test/resources/font_test_hangul.hwp");
        PdfRenderer renderer = new PdfRenderer();

        // Act
        RenderResult result = renderer.render(fixturePath);

        // Assert
        assertThat(result.isSuccess()).isTrue();
        assertThat(result.getText()).doesNotContain("?", "□");
    }
}
```

**실행 (Maven)**: `mvn test -pl {모듈} -Dtest={테스트클래스}`
**실행 (Gradle)**: `./gradlew test --tests {테스트클래스}`

---

## Python (pytest)

```python
# 파일: tests/test_pdf_renderer.py
import pytest
from pathlib import Path
from hancom.pdf import PdfRenderer

FIXTURE_DIR = Path("tests/fixtures")

def test_한글_폰트_포함_PDF_렌더링_시_특수문자_깨짐_없음():
    # Arrange — 실제 픽스처 파일 사용
    fixture_path = FIXTURE_DIR / "font_test_hangul.hwp"
    renderer = PdfRenderer()

    # Act
    result = renderer.render(fixture_path)

    # Assert
    assert result.success is True
    assert "?" not in result.text
    assert "□" not in result.text
```

**실행**: `python -m pytest {test_file} -v`

---

## JS/TS (Jest)

```typescript
// 파일: src/__tests__/PdfRenderer.test.ts
import { PdfRenderer } from '../pdf/PdfRenderer';
import path from 'path';

const FIXTURE_DIR = path.join(__dirname, '../__fixtures__');

describe('PdfRenderer', () => {
    it('한글 폰트 포함 PDF 렌더링 시 특수문자 깨짐 없음', async () => {
        // Arrange — 실제 픽스처 파일 사용
        const fixturePath = path.join(FIXTURE_DIR, 'font_test_hangul.hwp');
        const renderer = new PdfRenderer();

        // Act
        const result = await renderer.render(fixturePath);

        // Assert
        expect(result.success).toBe(true);
        expect(result.text).not.toContain('?');
    });
});
```

**실행**: `npm test -- --testPathPattern={test_file}`
