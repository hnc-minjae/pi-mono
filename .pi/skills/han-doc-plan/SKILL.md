---
name: han-doc-plan
description: 계획서 HWPX 문서를 자동 생성한다. 주제와 핵심 내용을 입력받아 계획서 템플릿의 누름틀(제목, 추진배경, 추진목적, 개요, 기대효과)을 AI로 자동 완성한다. "계획서", "계획서 작성", "계획서 생성", "plan document" 등에 반응한다.
user_invocable: true
argument: "[주제] — 예: /han-doc-plan AI 사업 추진 계획"
---

# 계획서 자동 생성

계획서 HWPX 템플릿의 누름틀을 AI가 자동으로 채운다.

## 누름틀 목록

| 누름틀 이름 | 설명 |
|------------|------|
| `계획서_제목` | 계획서 제목 |
| `계획서_추진_배경` | 추진 배경 설명 |
| `계획서_추진_목적` | 추진 목적 |
| `계획서_추진_개요_사업명` | 사업명 |
| `계획서_추진_개요_대상` | 대상 |
| `계획서_추진_개요_내용` | 개요 내용 |
| `계획서_기대효과` | 기대 효과 |

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
- `topic`: 계획서 주제 (예: "AI 사업 추진 계획")

**선택 입력 (없으면 생략):**
- `coreContents`: 핵심 내용/방향 (예: "클라우드 기반 AI 서비스 구축")
- `keyword`: 키워드 (최대 3개)

사용자가 주제만 입력한 경우:
> "핵심 내용이나 키워드를 추가로 입력하시겠습니까? (없으면 Enter)"

## Step 2: HWPX 문서 열기

**auto 모드:**
```
mcp__hwp_auto__hwp_auto_open_document(filePath: ".pi/han-doc/templates/계획서.hwpx", readOnly: false)
```

**file 모드:**
```
mcp__hwp_file__hwp_file_open_document(filePath: ".pi/han-doc/templates/계획서.hwpx")
```

## Step 3: 누름틀별 내용 생성 및 채우기

각 누름틀에 대해 순차적으로:
1. 누름틀의 용도에 맞는 내용을 생성
2. 모드에 따라 `mcp__hwp_auto__hwp_auto_fill_click_field` 또는 `mcp__hwp_file__hwp_file_fill_click_field` 도구로 누름틀에 채움

### 생성 지침

각 누름틀 생성 시 다음 원칙을 따른다:
- 주제(`topic`)와 핵심 내용(`coreContents`)을 반영
- 이전 누름틀에서 생성한 내용과 일관성 유지
- 한국어, 공식 문서 어투 사용
- 불필요한 이모지, 수식어 배제

**계획서_제목**: 간결하고 명확한 제목 1줄
**계획서_추진_배경**: 2~3문단, 현황과 필요성 설명
**계획서_추진_목적**: 1~2문단, 구체적 목적
**계획서_추진_개요_사업명**: 공식 사업명 1줄
**계획서_추진_개요_대상**: 대상 범위 1~2줄
**계획서_추진_개요_내용**: 3~5문단, 주요 추진 내용
**계획서_기대효과**: 2~3문단, 기대되는 효과

각 누름틀 채우기:

**auto 모드:**
```
mcp__hwp_auto__hwp_auto_fill_click_field(fieldName: "계획서_제목", value: "{생성된 내용}")
```

**file 모드:**
```
mcp__hwp_file__hwp_file_fill_click_field(fieldName: "계획서_제목", value: "{생성된 내용}")
```

## Step 4: 문서 저장

topic을 기반으로 파일명을 생성한다 (공백→밑줄, 특수문자 제거).

**auto 모드:**
```
mcp__hwp_auto__hwp_auto_save_document(filePath: ".pi/han-doc/output/계획서_{topic_sanitized}.hwpx")
mcp__hwp_auto__hwp_auto_close_document()
```

**file 모드:**
```
mcp__hwp_file__hwp_file_save_document(filePath: ".pi/han-doc/output/계획서_{topic_sanitized}.hwpx")
```

완료 메시지:
> "계획서가 생성되었습니다. .pi/han-doc/output/계획서_{topic_sanitized}.hwpx 파일을 확인하세요."
