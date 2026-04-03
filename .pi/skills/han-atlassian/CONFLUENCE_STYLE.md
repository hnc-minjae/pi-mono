# Confluence 문서 작성 스타일 가이드

> 이 파일은 `han-atlassian` 스킬의 `create-page`/`update-page` operation에서 참조합니다.
> 페이지 body는 **Storage Format (XHTML)** 형식으로 작성합니다.
> Markdown → Storage Format 변환 상세 규칙은 `skills/han-confluence-publish/CONVERT_RULES.md` 참조.

---

## 1. 페이지 유형별 템플릿

### 1-1. 업무보고 (주간/스프린트 보고서)

**제목 형식**: `[업무 관리] {스프린트명}`

```xml
<h2>요약</h2>
<table>
  <tbody>
    <tr>
      <th>항목</th><th>내용</th>
    </tr>
    <tr>
      <td>스프린트</td><td>{스프린트명}</td>
    </tr>
    <tr>
      <td>기간</td><td>{시작일} ~ {종료일}</td>
    </tr>
    <tr>
      <td>완료 이슈</td><td>{완료 수} / {전체 수}</td>
    </tr>
  </tbody>
</table>

<h2>업무 현황</h2>

<h3>{카테고리명}</h3>
<ul>
  <li><a href="{이슈 URL}">{이슈 제목}</a> <code>{상태}</code> <strong>@{담당자}</strong>
    <ul><li>{작업 내용 요약}</li></ul>
  </li>
</ul>

<h2>관리 포인트</h2>
<ul>
  <li>{리스크 또는 블로커 내용}</li>
</ul>
```

---

### 1-2. 기술 문서

**제목 형식**: `{컴포넌트명} 기술 문서`

```xml
<h2>개요</h2>
<p>{컴포넌트/기능 한 줄 설명}</p>

<h2>아키텍처</h2>
<p>{아키텍처 설명. 다이어그램은 첨부 파일 또는 draw.io 매크로 사용.}</p>

<h2>주요 구성요소</h2>
<ul>
  <li><strong>{컴포넌트명}</strong>: {역할 설명}</li>
</ul>

<h2>API 명세</h2>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">text</ac:parameter>
  <ac:plain-text-body><![CDATA[
GET /api/v1/example
Response: { "key": "value" }
  ]]></ac:plain-text-body>
</ac:structured-macro>

<h2>예시</h2>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">python</ac:parameter>
  <ac:plain-text-body><![CDATA[
# 예시 코드
result = example_function()
  ]]></ac:plain-text-body>
</ac:structured-macro>
```

---

### 1-3. 회의록

**제목 형식**: `[회의록] {회의 주제} {YYYY-MM-DD}`

```xml
<h2>회의 정보</h2>
<table>
  <tbody>
    <tr><th>일시</th><td>{YYYY-MM-DD HH:MM}</td></tr>
    <tr><th>장소</th><td>{온라인/오프라인 장소}</td></tr>
    <tr><th>참석자</th><td>{참석자 목록}</td></tr>
  </tbody>
</table>

<h2>안건</h2>
<ol>
  <li>{안건 1}</li>
  <li>{안건 2}</li>
</ol>

<h2>논의 내용</h2>
<h3>{안건 1}</h3>
<p>{논의 내용}</p>

<h2>결정사항</h2>
<ul>
  <li>{결정 내용} — <strong>@{담당자}</strong></li>
</ul>

<h2>액션아이템</h2>
<table>
  <tbody>
    <tr><th>항목</th><th>담당자</th><th>기한</th></tr>
    <tr><td>{액션 내용}</td><td>{담당자}</td><td>{YYYY-MM-DD}</td></tr>
  </tbody>
</table>
```

---

### 1-4. 릴리즈 노트

**제목 형식**: `릴리즈 노트 v{버전}`

```xml
<h2>버전 정보</h2>
<table>
  <tbody>
    <tr><th>버전</th><td>{버전}</td></tr>
    <tr><th>릴리즈 일자</th><td>{YYYY-MM-DD}</td></tr>
    <tr><th>대상 환경</th><td>{환경 정보}</td></tr>
  </tbody>
</table>

<h2>신규 기능</h2>
<ul>
  <li><strong>{기능명}</strong>: {기능 설명}</li>
</ul>

<h2>개선사항</h2>
<ul>
  <li>{개선 내용}</li>
</ul>

<h2>버그 수정</h2>
<ul>
  <li><a href="{Jira URL}">{이슈 키}</a>: {버그 설명}</li>
</ul>

<h2>알려진 이슈</h2>
<ac:structured-macro ac:name="note">
  <ac:rich-text-body>
    <ul>
      <li>{알려진 이슈 내용}</li>
    </ul>
  </ac:rich-text-body>
</ac:structured-macro>
```

---

## 2. 구조 원칙

- **제목 레벨**: 페이지 제목은 Confluence UI에서 자동 표시되므로 본문에 `<h1>` 사용 금지. `<h2>`부터 시작.
- **섹션 구분**: `<h2>` (1레벨), 하위 섹션: `<h3>` (2레벨)
- **본문 단락**: `<p>텍스트</p>`
- **강조**: `<strong>텍스트</strong>`
- **목록**: `<ul><li>...</li></ul>` (비순서), `<ol><li>...</li></ol>` (순서)
- **코드**: `<ac:structured-macro ac:name="code">` 매크로 사용 (아래 섹션 참조)
- **중첩 리스트 공백 방지**: `<li>텍스트<ul><li>하위</li></ul></li>` — 텍스트와 `<ul>` 사이 줄바꿈/공백 금지 (Confluence가 공백으로 렌더링)

---

## 3. Confluence 매크로 사용

### Info 패널 (참고 정보)

```xml
<ac:structured-macro ac:name="info">
  <ac:rich-text-body>
    <p>{참고 정보 내용}</p>
  </ac:rich-text-body>
</ac:structured-macro>
```

### Warning 패널 (주의사항)

```xml
<ac:structured-macro ac:name="warning">
  <ac:rich-text-body>
    <p>{주의사항 내용}</p>
  </ac:rich-text-body>
</ac:structured-macro>
```

### Note 패널 (노트)

```xml
<ac:structured-macro ac:name="note">
  <ac:rich-text-body>
    <p>{노트 내용}</p>
  </ac:rich-text-body>
</ac:structured-macro>
```

### Code 블록

```xml
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">python</ac:parameter>
  <ac:parameter ac:name="theme">Confluence</ac:parameter>
  <ac:parameter ac:name="linenumbers">true</ac:parameter>
  <ac:plain-text-body><![CDATA[
# 코드 내용
  ]]></ac:plain-text-body>
</ac:structured-macro>
```

지원 언어: `python`, `java`, `javascript`, `typescript`, `cpp`, `bash`, `sql`, `json`, `xml`, `text`

### 상태 표시

```xml
<ac:structured-macro ac:name="status">
  <ac:parameter ac:name="colour">Green</ac:parameter>
  <ac:parameter ac:name="title">Done</ac:parameter>
</ac:structured-macro>
```

색상: `Green`(완료), `Yellow`(진행 중), `Red`(블로커), `Grey`(보류)

### 날짜

```xml
<ac:structured-macro ac:name="date">
  <ac:parameter ac:name="date">2026-03-23</ac:parameter>
</ac:structured-macro>
```

---

## 4. 표 작성

```xml
<table>
  <tbody>
    <tr>
      <th>헤더1</th>
      <th>헤더2</th>
      <th>헤더3</th>
    </tr>
    <tr>
      <td>데이터1</td>
      <td>데이터2</td>
      <td>데이터3</td>
    </tr>
  </tbody>
</table>
```

- 헤더 행: `<th>` 사용, 데이터 행: `<td>`
- 열 정렬은 Confluence UI에서 처리 (Storage Format에서 style 속성 최소화)
- 병합 셀: `<td colspan="2">` 또는 `<td rowspan="2">`

---

## 5. 한컴 Confluence 컨벤션 (AINATIVE Space)

### 업무보고 페이지 규칙

- **Space Key**: `AIAGENT` (han-config.md > Atlassian > Confluence Space Key)
- **페이지 제목 형식**: `[업무 관리] {스프린트명}`
  - 예: `[업무 관리] Sprint 15`
- **상위 페이지**: han-config.md > Atlassian > 보고서 상위 페이지 ID
- **스프린트명 추출 우선순위**:
  1. 마크다운 내 `> 스프린트: {name}` 패턴
  2. 파일명의 `sprint-{name}-` 패턴
  3. 마크다운 `# 제목` 행

### 이슈 링크 형식

업무보고 리스트 아이템의 표준 형식:
```xml
<li>
  <a href="https://hancom.atlassian.net/browse/{ISSUE_KEY}">{이슈 제목}</a>
  <code>{상태}</code>
  <strong>@{담당자}</strong>
  ({기간 또는 마감일})
  <ul><li>{작업 내용 요약}</li></ul>
</li>
```

### 카테고리 헤더 규칙

단독 행 볼드 텍스트(`**카테고리명**`)는 `<h2>`로 변환:
- 예: `**한컴 어시스턴트**` → `<h2>한컴 어시스턴트</h2>`
- 예: `**AI Agent**` → `<h2>AI Agent</h2>`
- 버전/그룹 단독 행: `**P6(1.6.0)**` → `<h3>P6(1.6.0)</h3>`

### 금지사항

- `<h1>` 사용 금지 (페이지 제목과 중복)
- `<li>` 내 텍스트와 중첩 `<ul>` 사이에 줄바꿈·공백 삽입 금지
- Markdown `# 제목` 행을 본문에 직접 포함 금지 (페이지 제목으로만 사용)
