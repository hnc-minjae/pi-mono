---
name: han-doc-reflection
description: 소감문 HWPX 문서를 자동 생성한다. 종류·주제·핵심내용을 입력받아 소감문 템플릿의 누름틀(제목, 본문)을 AI로 자동 완성한다. "소감문", "후기", "체험후기", "참가후기", "감상후기", "사용후기" 등에 반응한다.
user_invocable: true
argument: "[주제] — 예: /han-doc-reflection AI 기술 세미나 참가 후기"
---

# 소감문 자동 생성


## ⚠️ 경로 작성 규칙 (도구 호출 시 반드시 준수)

MCP 도구의 `path` 인자는 **절대 경로**로 호출해야 한다. system prompt 상단에 표시된 `Current working directory:` 값을 그대로 가져와 아래 step에서 등장하는 모든 상대 경로 앞에 붙여 절대 경로로 만들어 호출한다.

예시 — cwd가 `C:/Users/foo/Han AI Orchestrator`이고 step에 `.pi/han-doc/templates/계획서.hwpx`가 적혀 있으면 실제 호출은 `path: "C:/Users/foo/Han AI Orchestrator/.pi/han-doc/templates/계획서.hwpx"` 로 보낸다. 상대 경로를 그대로 보내면 MCP 서버가 실패할 수 있다.
소감문 HWPX 템플릿의 누름틀을 AI가 자동으로 채운다.

## 누름틀 목록

| 누름틀 이름 | 설명 |
|------------|------|
| `소감문_제목` | 소감문 제목 (약 15자) |
| `소감문_본문` | 소감문 본문 (1200자 이내) |

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
- `topic`: 소감문 주제 (예: "AI 기술 세미나 참가 후기", "무선 이어폰 사용 후기")

**선택 입력 (없으면 기본값 사용):**
- `type`: 소감문 종류 — `체험후기` / `참가후기` / `감상후기` / `사용후기` (기본: `참가후기`)
- `coreContents`: 핵심 내용 (예: "멘토의 실무 조언이 인상적이었음")

사용자가 주제만 입력한 경우:
> "소감문 종류와 핵심 내용을 추가로 입력하시겠습니까? (없으면 Enter)"

## Step 2: HWPX 문서 열기

**auto 모드:**
```
mcp__hwp_auto__hwp_auto_open_document(path: ".pi/han-doc/templates/소감문.hwpx", readOnly: false)
```

**file 모드:**
```
mcp__hwp_file__hwp_file_open_document(path: ".pi/han-doc/templates/소감문.hwpx")
```

## Step 3: 누름틀별 내용 생성 및 채우기

각 누름틀에 대해 순차적으로:
1. 누름틀의 용도에 맞는 내용을 생성
2. 모드에 따라 `mcp__hwp_auto__hwp_auto_fill_click_field` 또는 `mcp__hwp_file__hwp_file_fill_click_field` 도구로 누름틀에 채움

### 생성 지침

- 한국어, `-니다` 문체로 정중함 유지
- 딱딱한 문어체가 아닌, 일기처럼 자연스럽고 편안한 흐름으로 서술
- 과도한 꾸밈 표현 배제, 솔직한 감정과 경험 중심
- 긍정적이고 따뜻한 분위기 유지
- 불필요한 이모지 배제

**소감문_제목**: type과 topic을 반영한 간결한 제목, 약 15자, 마침표 없음

**auto 모드:**
```
mcp__hwp_auto__hwp_auto_fill_click_field(fieldName: "소감문_제목", value: "{생성된 제목}")
```

**file 모드:**
```
mcp__hwp_file__hwp_file_fill_click_field(fieldName: "소감문_제목", value: "{생성된 제목}")
```

**소감문_본문**: 1200자 이내, `-니다` 문체
- 앞서 생성한 제목과 일관된 내용 유지
- type(소감문 종류)에 맞는 서술 방식 적용
- coreContents가 있으면 핵심 인상·경험으로 반영

**auto 모드:**
```
mcp__hwp_auto__hwp_auto_fill_click_field(fieldName: "소감문_본문", value: "{생성된 본문}")
```

**file 모드:**
```
mcp__hwp_file__hwp_file_fill_click_field(fieldName: "소감문_본문", value: "{생성된 본문}")
```

## Step 4: 문서 저장

topic을 기반으로 파일명을 생성한다 (공백→밑줄, 특수문자 제거).

**auto 모드:**
```
mcp__hwp_auto__hwp_auto_save_document(path: ".pi/han-doc/output/소감문_{topic_sanitized}.hwpx")
mcp__hwp_auto__hwp_auto_close_document()
```

**file 모드:**
```
mcp__hwp_file__hwp_file_save_document(path: ".pi/han-doc/output/소감문_{topic_sanitized}.hwpx")
```

완료 메시지:
> "소감문이 생성되었습니다. .pi/han-doc/output/소감문_{topic_sanitized}.hwpx 파일을 확인하세요."
