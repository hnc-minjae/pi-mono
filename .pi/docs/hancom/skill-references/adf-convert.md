# ADF 변환 규칙

> 이 파일은 스킬이 아닌 참조 문서입니다.
> han-sprint-report, han-issue-report, han-report 등에서 참조합니다.

## ADF 텍스트 추출 (extractAdfText)

Jira API 응답의 description/comment 필드는 ADF(Atlassian Document Format) JSON이다.

```
extractAdfText(node):
  type == "text"       → node.text
  type == "hardBreak"  → "\n"
  type == "mention"    → "@" + attrs.text
  type == "emoji"      → attrs.shortName
  type == "inlineCard" → attrs.url
  has content (array)  → children.map(extractAdfText).join("")

블록 처리:
  paragraph      → 추출 텍스트 + "\n"
  bulletList /
  orderedList    → "- " + 추출 텍스트 (항목별)
  heading        → 추출 텍스트 + "\n"
  codeBlock      → "```\n" + 추출 텍스트 + "\n```"
  table, media   → 무시 (건너뜀)
```

## 마크다운 → ADF 변환 규칙

| 마크다운 | ADF 노드 |
|---------|----------|
| `### 소제목` (단독 행) | `heading` level 3 노드 |
| `**소제목**` (단독 행) | `paragraph` + `strong` mark (인라인 강조) |
| `- 항목` | `bulletList` > `listItem` > `paragraph` |
| `**키**: 값` | `strong` text + 일반 text |
| 일반 문단 | `paragraph` |
| `---` | `rule` 노드 |
| `# 제목`, `## 소제목` | **절대 사용 금지** — heading 3(`###`) 또는 `**bold**`로 대체 |

## heading 사용 원칙

- `#` (h1), `##` (h2) — **절대 금지**. Jira에서 너무 크게 렌더링됨.
- `###` (h3) — **허용**. 섹션 구분용으로만 사용.
- 인라인 강조 — `**bold**`(`strong` mark) 사용. heading 대신 텍스트 강조가 필요한 경우.

소제목 수준의 구분이 필요하면 `###`를, 단순 강조는 `**bold**`를 사용한다.

## Python ADF 생성 예시

```python
# 단락 + bullet 혼합 ADF
content = [
    # 소제목 (bold paragraph)
    {
        'type': 'paragraph',
        'content': [{'type': 'text', 'text': '작업 내용', 'marks': [{'type': 'strong'}]}]
    },
    # bullet list
    {
        'type': 'bulletList',
        'content': [
            {
                'type': 'listItem',
                'content': [{'type': 'paragraph', 'content': [
                    {'type': 'text', 'text': '항목 내용'}
                ]}]
            }
        ]
    }
]
payload = {'body': {'type': 'doc', 'version': 1, 'content': content}}
```

## Python 멀티라인 텍스트 → ADF 자동 변환

```python
import json, sys

text = sys.argv[1]
lines = [l.strip() for l in text.strip().split('\n') if l.strip()]

if len(lines) > 1:
    items = []
    for line in lines:
        clean = line.lstrip('-*').strip()
        items.append({
            'type': 'listItem',
            'content': [{'type': 'paragraph', 'content': [{'type': 'text', 'text': clean}]}]
        })
    body_content = [{'type': 'bulletList', 'content': items}]
else:
    body_content = [{'type': 'paragraph', 'content': [{'type': 'text', 'text': lines[0]}]}]

payload = {'body': {'type': 'doc', 'version': 1, 'content': body_content}}
json.dump(payload, open('/tmp/han-comment.json', 'w'), ensure_ascii=False)
```

## Jira 작업 요약 코멘트 패턴 (han-close)

커밋/MR/작업시간을 포함한 작업 완료 코멘트 ADF 구조:

```python
import json

# 변수: BRANCH_NAME, COMMIT_SHA, MR_URL (없으면 "미생성"), DISPLAY_TIME
# 변수: changes_summary (변경 내용 요약 문자열), changed_files (리스트)

def make_bold_paragraph(text):
    return {'type': 'paragraph', 'content': [
        {'type': 'text', 'text': text, 'marks': [{'type': 'strong'}]}
    ]}

def make_bullet_list(items):
    return {'type': 'bulletList', 'content': [
        {'type': 'listItem', 'content': [{'type': 'paragraph', 'content': [
            {'type': 'text', 'text': item}
        ]}]} for item in items
    ]}

content = [
    make_bold_paragraph('작업 완료 요약'),
    make_bullet_list([
        f'브랜치: {BRANCH_NAME}',
        f'커밋: {COMMIT_SHA}',
        f'MR: {MR_URL}',
        f'작업 시간: {DISPLAY_TIME}',
    ]),
    make_bold_paragraph('변경 내용'),
    # changes_summary를 줄 단위로 bulletList로 변환
    make_bullet_list(changes_summary.strip().split('\n')),
    make_bold_paragraph('변경 파일'),
    make_bullet_list(changed_files),  # 예: ['src/foo.cpp (+10 -3)', 'include/foo.h (+2 -0)']
]

payload = {'body': {'type': 'doc', 'version': 1, 'content': content}}
json.dump(payload, open('/tmp/han-comment.json', 'w'), ensure_ascii=False)
```

API 호출:
```bash
curl -s -u "$JIRA_USER:$JIRA_TOKEN" \
  -X POST "$API_BASE/rest/api/3/issue/$ISSUE_KEY/comment" \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -d @/tmp/han-comment.json > /dev/null
rm -f /tmp/han-comment.json
```
