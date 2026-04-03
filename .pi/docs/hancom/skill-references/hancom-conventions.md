# 한컴 개발 컨벤션

> 이 파일은 스킬이 아닌 참조 문서입니다.
> han-code, han-reviewer, han-start 등에서 참조합니다.

## Jira 이슈 작성 원칙

### 제목(summary) 작성 원칙

- 이슈 제목은 **업무보고의 제목**으로 사용된다. 담당자가 아닌 사람도 어떤 업무인지 바로 파악할 수 있어야 한다.
- 파일명, 코드명, API 경로 같은 **지나친 기술 용어는 피한다.** 업무 맥락이 드러나는 표현을 사용한다.
- `[컴포넌트명]` prefix를 권장한다.
  - 좋은 예: `[LiteLLM] 어시스턴트 제품 LLM 모델 연결 설정 LiteLLM 프록시로 전환`
  - 나쁜 예: `[LiteLLM] assistant/models/*.json _treatAs 필드 chat_openai로 변경`

### description 작성 원칙

- **"이 이슈에서 무엇을 할 것인가"** 를 담는다. 완료된 작업 내용은 comment로 작성한다.
- 개조식(bullet-point) 위주로 간결하게 작성한다.
- `heading` 노드는 **절대 사용하지 않는다.** 소제목은 `strong` 마크가 적용된 `paragraph`로 표현한다.

### comment 작성 원칙

- **"실제로 무엇을 했는가"** 를 담는다. 작업 완료 후 결과, 변경 내용, 확인 사항을 기록한다.
- description과 동일하게 개조식으로 작성한다.
- `heading` 노드는 **절대 사용하지 않는다.**

### Task와 Epic의 관계

- **모든 Task는 반드시 상위 Epic에 속해야 한다.**
- Task 생성 요청 시 상위 Epic이 지정되지 않았다면, 적합한 Epic이 있는지 사용자에게 확인한다.
- 적합한 Epic이 없으면 **Epic을 먼저 생성한 후** Task를 생성한다.

## C++ 코딩 컨벤션

### 명명 규칙

| 구분 | 규칙 | 예시 |
|------|------|------|
| 클래스 | PascalCase, `C` prefix | `CHwpDocument`, `CTextFrame` |
| 멤버 변수 | `m_` prefix + camelCase | `m_nPageCount`, `m_strTitle` |
| 함수 매개변수 | camelCase | `nWidth`, `strTitle` |
| 지역 변수 | camelCase | `nIndex`, `pBuffer` |
| 포인터 변수 | `p` prefix | `pNode`, `pDocument` |
| 정적 멤버 | `s_` prefix | `s_pInstance` |

### 형식 규칙

| 항목 | 규칙 |
|------|------|
| 들여쓰기 | 탭(Tab) 사용, 공백 금지 |
| 줄 끝 | CRLF (Windows) |
| 인코딩 | UTF-8 |
| 최대 줄 길이 | 120자 권장 |

### 파일 구조

- 헤더(`.h`): 클래스 선언, 인라인 함수
- 소스(`.cpp`): 클래스 구현
- HWP 관련: `hwp/`, HWPX 관련: `hwpx/` 디렉토리 분리

## GitLab 컨벤션

| 항목 | 규칙 |
|------|------|
| 기본 브랜치 | `develop` |
| 기능 브랜치 | `feature/{JIRA-KEY}-brief-description` |
| 버그 수정 | `fix/{JIRA-KEY}-brief-description` |
| MR 제목 | `[{JIRA-KEY}] {작업 내용 요약}` |
| MR 설명 | 변경 내용, 테스트 방법, 관련 이슈 링크 포함 |

## 코드 탐색 패턴 (Non-C++ Grep 기반)

> han-analyze에서 C++ 이외 언어 코드 탐색 시 사용하는 grep 패턴.
> `{KEYWORD}` 자리에 이슈 기반 키워드(클래스명/함수명)를 채운다.

### C# (clangd 미지원 — Grep + Read)

```bash
grep -rn --include="*.cs" \
  -e "class {KEYWORD}" -e "{KEYWORD}" \
  .
```

### Java

```bash
grep -rn --include="*.java" \
  -e "class {KEYWORD}" -e "{keyword}" \
  src/main/ src/test/
```

### Python

```bash
grep -rn --include="*.py" \
  -e "def {keyword}" -e "class {KEYWORD}" \
  .
```

### JS/TS

```bash
grep -rn --include="*.ts" --include="*.js" \
  -e "{keyword}" -e "class {KEYWORD}" -e "export.*{KEYWORD}" \
  src/
```

탐색 후 후보 파일을 Read로 읽어 함수 시그니처, 의존성 import, 호출 패턴을 파악한다.
