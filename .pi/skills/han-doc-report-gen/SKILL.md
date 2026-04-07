---
name: han-doc-report-gen
description: 보고서 HWPX 문서를 자동 생성한다. 핵심내용·회사명·키워드를 입력받아 보고서 템플릿의 누름틀(제목, 목차1~6, 소제목1~6, 본문1~6)을 AI로 자동 완성한다. "보고서 작성", "보고서 생성", "보도자료", "report" 등에 반응한다. ※ 사업보고서는 han-doc-report 사용.
user_invocable: true
argument: "[핵심 내용] — 예: /han-doc-report-gen 한컴 AI 에이전트 플랫폼 출시"
---

# 보고서 자동 생성

보고서 HWPX 템플릿의 누름틀을 AI가 자동으로 채운다.

## 누름틀 목록

| 누름틀 이름 | 설명 |
|------------|------|
| `보고서_제목` | 보고서 전체 제목 |
| `보고서_목차1` ~ `보고서_목차6` | 각 섹션 목차 제목 |
| `보고서_소제목1` ~ `보고서_소제목6` | 각 섹션 소제목 |
| `보고서_본문1` ~ `보고서_본문6` | 각 섹션 본문 내용 |

## Step 1: 입력값 수집

프롬프트에 핵심 내용이 포함되어 있으면 바로 사용한다.
포함되어 있지 않으면 사용자에게 질문한다.

**필수 입력:**
- `coreContents`: 핵심 내용 (예: "AI 에이전트 플랫폼 구축, 매출 30% 성장")

**선택 입력 (없으면 생략):**
- `organization`: 회사명/기관명 (예: "한컴", "한국인공지능연구원")
- `keyword`: 키워드 (최대 3개, 예: "AI, 에이전트, 플랫폼")

사용자가 핵심 내용만 입력한 경우:
> "회사명/기관명과 키워드를 추가로 입력하시겠습니까? (없으면 Enter)"

## Step 2: HWPX 문서 열기

```
mcp__hwp_file__hwp_file_open_document(filePath: ".pi/han-doc/templates/보고서.hwpx")
```

## Step 3: 전체 구조 설계 및 누름틀 채우기

### 3-1. 제목 및 6개 섹션 목차 설계

먼저 보고서 전체 구조(제목, 목차 6개)를 한 번에 설계한다.

**생성 지침:**
- 공식 보고서 어투, 명확하고 간결한 표현
- organization이 있으면 제목에 반드시 포함
- 목차 6개는 보고서 주제를 논리적으로 커버하는 섹션 구성
- 각 목차 제목은 15자 이내

```
mcp__hwp_file__hwp_file_fill_click_field(fieldName: "보고서_제목", value: "{생성된 제목}")
mcp__hwp_file__hwp_file_fill_click_field(fieldName: "보고서_목차1", value: "{섹션1 목차}")
mcp__hwp_file__hwp_file_fill_click_field(fieldName: "보고서_목차2", value: "{섹션2 목차}")
mcp__hwp_file__hwp_file_fill_click_field(fieldName: "보고서_목차3", value: "{섹션3 목차}")
mcp__hwp_file__hwp_file_fill_click_field(fieldName: "보고서_목차4", value: "{섹션4 목차}")
mcp__hwp_file__hwp_file_fill_click_field(fieldName: "보고서_목차5", value: "{섹션5 목차}")
mcp__hwp_file__hwp_file_fill_click_field(fieldName: "보고서_목차6", value: "{섹션6 목차}")
```

### 3-2. 각 섹션별 소제목 및 본문 생성

6개 섹션에 대해 순차적으로 소제목과 본문을 생성한다.

**생성 지침:**
- 각 소제목: 해당 목차의 핵심을 담은 20자 이내 문장
- 각 본문: 2~4문단, 공식 보고서 어투, 데이터 기반 구체적 서술
- 섹션 간 일관성 유지
- 이전 섹션 내용을 참고해 중복 없이 작성

섹션 1~6 반복:
```
mcp__hwp_file__hwp_file_fill_click_field(fieldName: "보고서_소제목{N}", value: "{생성된 소제목}")
mcp__hwp_file__hwp_file_fill_click_field(fieldName: "보고서_본문{N}", value: "{생성된 본문}")
```

## Step 4: 문서 저장

coreContents를 기반으로 파일명을 생성한다 (공백→밑줄, 특수문자 제거, 최대 30자).

```
mcp__hwp_file__hwp_file_save_document(filePath: ".pi/han-doc/output/보고서_{coreContents_sanitized}.hwpx")
```

완료 메시지:
> "보고서가 생성되었습니다. .pi/han-doc/output/보고서_{coreContents_sanitized}.hwpx 파일을 확인하세요."
