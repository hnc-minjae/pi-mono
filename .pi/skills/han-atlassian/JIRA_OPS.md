# Jira Operations — REST API 구현

> 이 파일은 `skills/han-atlassian/SKILL.md`에서 참조하는 구현 상세 문서입니다.
> 단순 읽기/상태전환은 MCP(`mcp__atlassian__*`), ADF 변환·파일 첨부는 curl을 사용한다.
>
> **공통 전제**: `API_BASE`, `JIRA_USER`, `JIRA_TOKEN`이 이미 로드/확인된 상태.

---

## get-issue

이슈 상세 정보를 조회한다. **MCP 사용**.

```
mcp__atlassian__getJiraIssue(
  issueIdOrKey: ISSUE_KEY,
  fields: ["summary","status","issuetype","priority","assignee","description","parent","components"]
)
```

**응답 필드 추출**:
```
summary    = response.fields.summary
status     = response.fields.status.name
issuetype  = response.fields.issuetype.name
priority   = response.fields.priority?.name
assignee   = response.fields.assignee?.displayName  (없으면 '미할당')
parent     = response.fields.parent?.key
components = response.fields.components[].name 목록
```

**에러 처리**: MCP 응답에 error가 있으면 "이슈를 찾을 수 없습니다: {ISSUE_KEY}" 출력 후 중단.

---

## search

JQL로 이슈를 검색한다. **MCP 사용**.

```
mcp__atlassian__searchJiraIssuesUsingJql(
  jql: JQL,
  fields: ["summary","status","issuetype","priority","assignee","updated"],
  maxResults: MAX_RESULTS (기본 20)
)
```

**응답 필드 추출**:
```
issues = response.issues  (배열)
total  = response.total
# 각 이슈: {key, fields: {summary, status.name, issuetype.name, priority.name, assignee.displayName, updated}}
```

**에러 처리**: MCP 응답에 error가 있으면 "JQL 검색 오류: {error message}" 출력 후 중단.

---

## create-issue

새 이슈를 생성한다.

**엔드포인트**: `POST /rest/api/3/issue`

> **heading 규칙** — `#` `##` 절대 금지. `###`만 허용(heading level 3). 강조는 `**bold**`(strong paragraph). (`adf-convert.md` 참조)

**payload 생성 (python3)**:
```python
import json, sys

issue_type = sys.argv[1]   # e.g. "Task", "Bug", "에픽"
project_key = sys.argv[2]
summary = sys.argv[3]
description_md = sys.argv[4]
parent_key = sys.argv[5] if len(sys.argv) > 5 else None

# Markdown → ADF 변환 (# ## 절대 금지, ### → heading level 3, **bold** → strong paragraph)
def make_heading3(text):
    return {'type': 'heading', 'attrs': {'level': 3}, 'content': [
        {'type': 'text', 'text': text}
    ]}

def make_bold_paragraph(text):
    return {'type': 'paragraph', 'content': [
        {'type': 'text', 'text': text, 'marks': [{'type': 'strong'}]}
    ]}

def make_paragraph(text):
    return {'type': 'paragraph', 'content': [{'type': 'text', 'text': text}]}

def make_bullet_list(items):
    return {'type': 'bulletList', 'content': [
        {'type': 'listItem', 'content': [{'type': 'paragraph', 'content': [
            {'type': 'text', 'text': item}
        ]}]} for item in items
    ]}

lines = [l.strip() for l in description_md.strip().split('\n') if l.strip()]
body_content = []
bullet_items = []
for line in lines:
    if line.startswith('- ') or line.startswith('* '):
        bullet_items.append(line[2:])
    else:
        if bullet_items:
            body_content.append(make_bullet_list(bullet_items))
            bullet_items = []
        if line.startswith('### '):
            body_content.append(make_heading3(line[4:].strip()))
        elif line.startswith('**') and line.endswith('**'):
            body_content.append(make_bold_paragraph(line.strip('*')))
        else:
            body_content.append(make_paragraph(line))
if bullet_items:
    body_content.append(make_bullet_list(bullet_items))
if not body_content:
    body_content = [make_paragraph('')]

fields = {
    'project': {'key': project_key},
    'summary': summary,
    'issuetype': {'name': issue_type},
    'description': {'type': 'doc', 'version': 1, 'content': body_content}
}
if parent_key:
    fields['parent'] = {'key': parent_key}

json.dump({'fields': fields}, open('/tmp/han-create-issue.json', 'w'), ensure_ascii=False)
```

```bash
python3 /path/to/above_script.py "$ISSUE_TYPE" "$PROJECT_KEY" "$SUMMARY" "$DESCRIPTION" "$PARENT_KEY"

RESPONSE=$(curl -s \
  -u "$JIRA_USER:$JIRA_TOKEN" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -w "\nHTTP_STATUS:%{http_code}" \
  -d @/tmp/han-create-issue.json \
  "$API_BASE/rest/api/3/issue")

HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')
ISSUE_KEY=$(echo "$BODY" | python3 -c "import json,sys; print(json.load(sys.stdin).get('key',''))")
rm -f /tmp/han-create-issue.json
```

**에러 처리**:

| HTTP 상태 | 대응 |
|-----------|------|
| 400 | "이슈 생성 실패: {error details}" |
| 401/403 | "인증 실패 또는 프로젝트 접근 권한 없음" |
| 5xx | sleep 1 후 1회 재시도 |

---

## get-transitions

이슈에서 전환 가능한 상태 목록을 조회한다. **MCP 사용**.

```
mcp__atlassian__getTransitionsForJiraIssue(
  issueIdOrKey: ISSUE_KEY
)
```

**응답 필드 추출**:
```
transitions = response.transitions
# 각 transition: {id, name, to: {name}}
# 예시 출력: "  - {t.name} (→ {t.to.name})"
```

**에러 처리**: MCP 응답에 error가 있으면 "전환 목록 조회 실패: {ISSUE_KEY}" 출력 후 중단.

---

## transition

이슈의 상태를 전환한다. **이름 기반으로 호출하면 내부에서 ID를 자동 조회한다. MCP 사용.**

```
# 1단계: 전환 가능 목록에서 TARGET_STATUS 이름으로 transitionId 조회
transitions_response = mcp__atlassian__getTransitionsForJiraIssue(
  issueIdOrKey: ISSUE_KEY
)

transition_id = None
for t in transitions_response.transitions:
    if t.name == TARGET_STATUS or t.to.name == TARGET_STATUS:
        transition_id = t.id
        break

if transition_id is None:
    print(f"전환 불가: '{TARGET_STATUS}' 상태로 직접 전환할 수 없습니다.")
    print("가능한 전환 목록:")
    for t in transitions_response.transitions:
        print(f"  - {t.name}")
    # 중단

# 2단계: 전환 실행
mcp__atlassian__transitionJiraIssue(
  issueIdOrKey: ISSUE_KEY,
  transitionId: transition_id
)
```

**에러 처리**: 전환 성공 시 "상태 전환 완료: {ISSUE_KEY} → {TARGET_STATUS}" 출력.

---

## add-worklog

이슈에 작업 시간을 기록한다. **MCP 사용**.

**파라미터**: `ISSUE_KEY`, `TIME_SPENT_SECONDS` (초 단위), `STARTED` (ISO 8601, 예: `2026-03-22T09:00:00.000+0900`)

```
mcp__atlassian__addWorklogToJiraIssue(
  issueIdOrKey: ISSUE_KEY,
  timeSpentSeconds: TIME_SPENT_SECONDS,
  started: STARTED
)
```

**에러 처리**: MCP 응답에 error가 있으면 "Worklog 기록 실패: {error message}" 출력.

---

## add-comment

Markdown 본문을 ADF로 변환하여 코멘트를 추가한다.

**엔드포인트**: `POST /rest/api/3/issue/{KEY}/comment`

> **마크다운 → ADF 변환 규칙**
>
> | 마크다운 | ADF 노드 |
> |---------|----------|
> | `### 소제목` (단독 행) | `heading` level 3 |
> | `**소제목**` (단독 행) | `paragraph` + `strong` mark |
> | `- 항목` | `bulletList` > `listItem` > `paragraph` |
> | `**키**: 값` | `strong` text + 일반 text |
> | 일반 문단 | `paragraph` |
> | `---` | `rule` 노드 |
>
> **heading 규칙** — `#` `##` 절대 금지. `###`만 허용(heading level 3). 강조는 `**bold**`(strong paragraph).

**payload 생성 (python3)**:
```python
import json, sys

markdown_body = sys.argv[1]
lines = [l.strip() for l in markdown_body.strip().split('\n') if l.strip()]

def make_heading3(text):
    return {'type': 'heading', 'attrs': {'level': 3}, 'content': [
        {'type': 'text', 'text': text}
    ]}

def make_bold_paragraph(text):
    return {'type': 'paragraph', 'content': [
        {'type': 'text', 'text': text, 'marks': [{'type': 'strong'}]}
    ]}

def make_paragraph(text):
    return {'type': 'paragraph', 'content': [{'type': 'text', 'text': text}]}

def make_bullet_list(items):
    return {'type': 'bulletList', 'content': [
        {'type': 'listItem', 'content': [{'type': 'paragraph', 'content': [
            {'type': 'text', 'text': item}
        ]}]} for item in items
    ]}

# 변환: ### → heading level 3, **bold** → strong paragraph, - → bulletList
content = []
bullet_items = []
for line in lines:
    if line.startswith('- ') or line.startswith('* '):
        bullet_items.append(line[2:])
    else:
        if bullet_items:
            content.append(make_bullet_list(bullet_items))
            bullet_items = []
        if line.startswith('### '):
            content.append(make_heading3(line[4:].strip()))
        elif line.startswith('**') and line.endswith('**'):
            content.append(make_bold_paragraph(line.strip('*')))
        else:
            content.append(make_paragraph(line))
if bullet_items:
    content.append(make_bullet_list(bullet_items))

payload = {'body': {'type': 'doc', 'version': 1, 'content': content}}
json.dump(payload, open('/tmp/han-comment.json', 'w'), ensure_ascii=False)
```

```bash
python3 /path/to/above_script.py "$MARKDOWN_BODY"

RESPONSE=$(curl -s \
  -u "$JIRA_USER:$JIRA_TOKEN" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -w "\nHTTP_STATUS:%{http_code}" \
  -d @/tmp/han-comment.json \
  "$API_BASE/rest/api/3/issue/$ISSUE_KEY/comment")

HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
rm -f /tmp/han-comment.json
```

---

## myself

현재 인증된 사용자 정보를 조회한다.

**엔드포인트**: `GET /rest/api/3/myself`

```bash
RESPONSE=$(curl -s \
  -u "$JIRA_USER:$JIRA_TOKEN" \
  -H "Accept: application/json" \
  -w "\nHTTP_STATUS:%{http_code}" \
  "$API_BASE/rest/api/3/myself")

HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')
```

**응답 파싱 (python3)**:
```python
import json, sys
data = json.loads(sys.stdin.read())
account_id = data.get('accountId', '')
display_name = data.get('displayName', '')
email = data.get('emailAddress', '')
```

**에러 처리**:

| HTTP 상태 | 대응 |
|-----------|------|
| 401 | "인증 실패. JIRA_USER/JIRA_TOKEN 환경변수를 확인하세요." |

---

## attach-to-issue

이슈에 파일을 첨부한다.

**엔드포인트**: `POST /rest/api/3/issue/{KEY}/attachments`

> **주의**: `X-Atlassian-Token: no-check` 헤더 필수. 없으면 403 반환.
> Content-Type은 curl이 multipart/form-data를 자동 설정하므로 명시하지 않는다.

```bash
if [ ! -f "$FILE_PATH" ]; then
    echo "첨부 실패: 파일을 찾을 수 없습니다: $FILE_PATH"
    exit 1
fi

RESPONSE=$(curl -s \
  -u "$JIRA_USER:$JIRA_TOKEN" \
  -X POST \
  -H "Accept: application/json" \
  -H "X-Atlassian-Token: no-check" \
  -F "file=@$FILE_PATH" \
  -w "\nHTTP_STATUS:%{http_code}" \
  "$API_BASE/rest/api/3/issue/$ISSUE_KEY/attachments")

HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')
```

**에러 처리**:

| HTTP 상태 | 대응 |
|-----------|------|
| 403 | "첨부 권한 없음 또는 X-Atlassian-Token 헤더 누락" |
| 404 | "이슈를 찾을 수 없습니다: {ISSUE_KEY}" |
| 413 | "파일 크기 초과. 10MB 이하 파일을 사용하세요." |
| 5xx | sleep 1 후 1회 재시도 |
