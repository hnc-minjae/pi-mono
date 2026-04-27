---
name: han-doc-report
description: 사업보고서 HWPX 문서를 자동 생성한다. 주제와 핵심 내용을 입력받아 사업보고서 템플릿의 누름틀(제목, 목적, 배경, 주요내용, 현황/문제점, 해결방안)을 AI로 자동 완성한다. "사업보고서", "보고서 작성", "사업보고서 생성", "business report" 등에 반응한다.
user_invocable: true
argument: "[주제] — 예: /han-doc-report 2025년 AI 사업 추진 실적"
---

# 사업보고서 자동 생성


## ⚠️ 경로 작성 규칙 (도구 호출 시 반드시 준수)

MCP 도구의 `path` 인자는 **절대 경로**로 호출해야 한다. system prompt 상단에 표시된 `Current working directory:` 값을 그대로 가져와 아래 step에서 등장하는 모든 상대 경로 앞에 붙여 절대 경로로 만들어 호출한다.

예시 — cwd가 `C:/Users/foo/Han AI Orchestrator`이고 step에 `.pi/han-doc/templates/계획서.hwpx`가 적혀 있으면 실제 호출은 `path: "C:/Users/foo/Han AI Orchestrator/.pi/han-doc/templates/계획서.hwpx"` 로 보낸다. 상대 경로를 그대로 보내면 MCP 서버가 실패할 수 있다.
사업보고서 HWPX 템플릿의 누름틀을 AI가 자동으로 채운다.

## 누름틀 목록

| 누름틀 이름 | 설명 |
|------------|------|
| `사업보고서_제목` | 보고서 제목 |
| `사업보고서_개요_목적` | 사업 목적 |
| `사업보고서_개요_배경_근거` | 추진 배경 및 근거 |
| `사업보고서_주요내용` | 주요 사업 내용 |
| `사업보고서_현황_문제점` | 현황 및 문제점 |
| `사업보고서_현황_해결방안` | 해결 방안 |

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
- `topic`: 보고서 주제 (예: "2025년 AI 사업 추진 실적")

**선택 입력 (없으면 생략):**
- `coreContents`: 핵심 내용 (예: "AI 에이전트 플랫폼 구축, 매출 30% 성장")
- `keyword`: 키워드 (최대 3개)

사용자가 주제만 입력한 경우:
> "핵심 내용이나 키워드를 추가로 입력하시겠습니까? (없으면 Enter)"

## Step 2: HWPX 문서 열기

**auto 모드:**
```
mcp__hwp_auto__hwp_auto_open_document(path: ".pi/han-doc/templates/사업보고서.hwpx", readOnly: false)
```

**file 모드:**
```
mcp__hwp_file__hwp_file_open_document(path: ".pi/han-doc/templates/사업보고서.hwpx")
```

## Step 3: 누름틀별 내용 생성 및 채우기

각 누름틀에 대해 순차적으로:
1. 누름틀의 용도에 맞는 내용을 생성
2. 모드에 따라 `mcp__hwp_auto__hwp_auto_fill_click_field` 또는 `mcp__hwp_file__hwp_file_fill_click_field` 도구로 누름틀에 채움

### 생성 지침

- 한국어, 공식 보고서 어투 사용
- 데이터 기반, 구체적 수치 활용 (가능한 경우)
- 불필요한 이모지, 수식어 배제

**사업보고서_제목**: 공식 보고서 제목 1줄
**사업보고서_개요_목적**: 1~2문단, 보고서 작성 목적
**사업보고서_개요_배경_근거**: 2~3문단, 사업 추진 배경과 법적/정책적 근거
**사업보고서_주요내용**: 3~5문단, 핵심 사업 내용 상세
**사업보고서_현황_문제점**: 2~3문단, 현재 상황과 해결해야 할 문제점
**사업보고서_현황_해결방안**: 2~3문단, 구체적 해결 방안 및 향후 계획

각 누름틀 채우기:

**auto 모드:**
```
mcp__hwp_auto__hwp_auto_fill_click_field(fieldName: "사업보고서_제목", value: "{생성된 내용}")
```

**file 모드:**
```
mcp__hwp_file__hwp_file_fill_click_field(fieldName: "사업보고서_제목", value: "{생성된 내용}")
```

## Step 4: 문서 저장

topic을 기반으로 파일명을 생성한다 (공백→밑줄, 특수문자 제거).

**auto 모드:**
```
mcp__hwp_auto__hwp_auto_save_document(path: ".pi/han-doc/output/사업보고서_{topic_sanitized}.hwpx")
mcp__hwp_auto__hwp_auto_close_document()
```

**file 모드:**
```
mcp__hwp_file__hwp_file_save_document(path: ".pi/han-doc/output/사업보고서_{topic_sanitized}.hwpx")
```

완료 메시지:
> "사업보고서가 생성되었습니다. .pi/han-doc/output/사업보고서_{topic_sanitized}.hwpx 파일을 확인하세요."
