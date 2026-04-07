---
name: han-doc-greeting
description: 인사말 HWPX 문서를 자동 생성한다. 주제·대상·어조·핵심내용을 입력받아 인사말 템플릿의 누름틀(제목, 본문)을 AI로 자동 완성한다. "인사말", "인사말 작성", "축사", "환영사", "축하말" 등에 반응한다.
user_invocable: true
argument: "[주제] — 예: /han-doc-greeting 결혼식 축사"
---

# 인사말 자동 생성

인사말 HWPX 템플릿의 누름틀을 AI가 자동으로 채운다.

## 누름틀 목록

| 누름틀 이름 | 설명 |
|------------|------|
| `인사말_제목` | 인사말 제목 (약 15자) |
| `인사말_본문` | 인사말 본문 (500~800자) |

## Step 1: 입력값 수집

프롬프트에 주제가 포함되어 있으면 바로 사용한다.
포함되어 있지 않으면 사용자에게 질문한다.

**필수 입력:**
- `topic`: 인사말 주제 (예: "결혼식 축사", "입학식 환영사", "졸업식 축사")

**선택 입력 (없으면 기본값 사용):**
- `target`: 인사말 대상 (예: "신랑 신부", "참석자 여러분", "졸업생 여러분")
- `tone`: 어조 — `따뜻한` / `격식있는` / `열정적인` / `재미있는` / `감동적인` (기본: `따뜻한`)
- `coreContents`: 핵심 내용 (예: "두 사람의 앞날에 행복이 가득하길 기원")

사용자가 주제만 입력한 경우:
> "대상과 어조를 추가로 입력하시겠습니까? (없으면 Enter)"

## Step 2: HWPX 문서 열기

```
mcp__hwp_file__hwp_file_open_document(filePath: ".pi/han-doc/templates/인사말.hwpx")
```

## Step 3: 누름틀별 내용 생성 및 채우기

각 누름틀에 대해 순차적으로:
1. 누름틀의 용도에 맞는 내용을 생성
2. `mcp__hwp_file__hwp_file_fill_click_field` 도구로 누름틀에 채움

### 생성 지침

- 한국어, 격식을 갖춘 문어체 사용
- 선택된 어조(`tone`)에 맞게 문장 스타일 반영
  - 따뜻한: 부드럽고 포근한 느낌
  - 격식있는: 정중하고 전문적인 말투
  - 열정적인: 에너지와 활기 강조
  - 재미있는: 위트와 유머 약간 포함
  - 감동적인: 진심 어린 감사와 회고 중심
- 불필요한 이모지, 과도한 수식어 배제

**인사말_제목**: 입력값을 반영한 간결한 제목, 약 15자, 마침표 없음

```
mcp__hwp_file__hwp_file_fill_click_field(fieldName: "인사말_제목", value: "{생성된 제목}")
```

**인사말_본문**: 500~800자, 격식 있는 문어체, 자연스럽고 부드러운 흐름
- 앞서 생성한 제목과 일관된 톤 유지
- topic, target, coreContents를 반영

```
mcp__hwp_file__hwp_file_fill_click_field(fieldName: "인사말_본문", value: "{생성된 본문}")
```

## Step 4: 문서 저장

topic을 기반으로 파일명을 생성한다 (공백→밑줄, 특수문자 제거).

```
mcp__hwp_file__hwp_file_save_document(filePath: ".pi/han-doc/output/인사말_{topic_sanitized}.hwpx")
```

완료 메시지:
> "인사말이 생성되었습니다. .pi/han-doc/output/인사말_{topic_sanitized}.hwpx 파일을 확인하세요."
