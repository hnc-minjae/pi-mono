---
name: han-doc-draft
description: 기획서 HWPX 문서를 자동 생성한다. 주제와 핵심 내용을 입력받아 기획서 템플릿의 누름틀(제목, 요약박스, 본문)을 AI로 자동 완성한다. "기획서", "기획서 작성", "기획서 생성", "draft plan", "기획안" 등에 반응한다.
user_invocable: true
argument: "[주제] — 예: /han-doc-draft 신규 서비스 출시 기획"
---

# 기획서 자동 생성


## ⚠️ 경로 작성 규칙 (도구 호출 시 반드시 준수)

MCP 도구의 `path` 인자는 **절대 경로**로 호출해야 한다. system prompt 상단에 표시된 `Current working directory:` 값을 그대로 가져와 아래 step에서 등장하는 모든 상대 경로 앞에 붙여 절대 경로로 만들어 호출한다.

예시 — cwd가 `C:/Users/foo/Han AI Orchestrator`이고 step에 `.pi/han-doc/templates/계획서.hwpx`가 적혀 있으면 실제 호출은 `path: "C:/Users/foo/Han AI Orchestrator/.pi/han-doc/templates/계획서.hwpx"` 로 보낸다. 상대 경로를 그대로 보내면 MCP 서버가 실패할 수 있다.
기획서 HWPX 템플릿의 누름틀을 AI가 자동으로 채운다.

## 누름틀 목록

| 누름틀 이름 | 설명 |
|------------|------|
| `기획서_제목` | 기획서 제목 |
| `기획서_요약박스` | 핵심 요약 (Executive Summary) |
| `기획서_본문` | 기획 본문 내용 |

## Step 0: MCP 모드 결정

사용자가 `--mode file` 또는 `--mode auto`를 명시하면 해당 모드를 사용한다.
명시하지 않으면 기본값은 **auto** 모드이다.

| 모드 | 도구 접두어 | 조건 |
|------|-----------|------|
| auto | `mcp__hwp_auto__hwp_auto_*` | 기본값. 한글 COM 자동화 |
| file | `mcp__hwp_file__hwp_file_*` | `--mode file` 지정 시 또는 auto 도구 호출 실패 시 |

auto 모드에서 open_document 호출이 실패하면(COM 오류), file 모드로 자동 전환하고
사용자에게 알린다: "한글 연결 실패. file 모드로 전환합니다."

## Step 1: 입력값 수집

프롬프트에 주제가 포함되어 있으면 바로 사용한다.
포함되어 있지 않으면 사용자에게 질문한다.

**필수 입력:**
- `topic`: 기획서 주제 (예: "신규 AI 서비스 출시 기획")

**선택 입력 (없으면 생략):**
- `coreContents`: 핵심 내용/방향 (예: "B2B SaaS 형태, 2025년 하반기 출시 목표")
- `keyword`: 키워드 (최대 3개)

사용자가 주제만 입력한 경우:
> "핵심 내용이나 방향을 추가로 입력하시겠습니까? (없으면 Enter)"

## Step 2: HWPX 문서 열기

**auto 모드:**
```
mcp__hwp_auto__hwp_auto_open_document(path: ".pi/han-doc/templates/기획서.hwpx", readOnly: false)
```

**file 모드:**
```
mcp__hwp_file__hwp_file_open_document(path: ".pi/han-doc/templates/기획서.hwpx")
```

## Step 3: 누름틀별 내용 생성 및 채우기

각 누름틀에 대해 순차적으로:
1. 누름틀의 용도에 맞는 내용을 생성
2. 모드에 따라 `mcp__hwp_auto__hwp_auto_fill_click_field` 또는 `mcp__hwp_file__hwp_file_fill_click_field` 도구로 누름틀에 채움

### 생성 지침

- 한국어, 공식 문서 어투 사용
- 구체적이고 실행 가능한 내용 위주
- 불필요한 이모지, 수식어 배제

**기획서_제목**: 명확하고 구체적인 기획서 제목 1줄
**기획서_요약박스**: 3~5줄, 핵심 요약 (목적, 대상, 기간, 예상 효과)
**기획서_본문**: 5~10문단, 상세 기획 내용 (배경, 목표, 추진전략, 세부계획, 일정, 예산, 기대효과)

각 누름틀 채우기:

**auto 모드:**
```
mcp__hwp_auto__hwp_auto_fill_click_field(fieldName: "기획서_제목", value: "{생성된 내용}")
```

**file 모드:**
```
mcp__hwp_file__hwp_file_fill_click_field(fieldName: "기획서_제목", value: "{생성된 내용}")
```

## Step 4: 문서 저장

topic을 기반으로 파일명을 생성한다 (공백→밑줄, 특수문자 제거).

**auto 모드:**
```
mcp__hwp_auto__hwp_auto_save_document(path: ".pi/han-doc/output/기획서_{topic_sanitized}.hwpx")
mcp__hwp_auto__hwp_auto_close_document()
```

**file 모드:**
```
mcp__hwp_file__hwp_file_save_document(path: ".pi/han-doc/output/기획서_{topic_sanitized}.hwpx")
```

완료 메시지:
> "기획서가 생성되었습니다. .pi/han-doc/output/기획서_{topic_sanitized}.hwpx 파일을 확인하세요."
