# Confluence Operations — REST API 구현

> 이 파일은 `skills/han-atlassian/SKILL.md`에서 참조하는 구현 상세 문서입니다.
> 각 operation에 대한 curl 명령, 응답 파싱, 에러 처리를 정의합니다.
>
> **공통 전제**: `API_BASE`, `JIRA_USER`, `JIRA_TOKEN`이 이미 로드/확인된 상태.
>
> **페이지 내용 작성 스타일**: [CONFLUENCE_STYLE.md](CONFLUENCE_STYLE.md) 참조.

---

## search-confluence

CQL로 Confluence 페이지를 검색한다.

**엔드포인트**: `GET /wiki/rest/api/content/search`

**파라미터**: `CQL` (CQL 문자열), `LIMIT` (기본 10)

```bash
CQL_ENCODED=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$CQL")
LIMIT="${LIMIT:-10}"

RESPONSE=$(curl -s \
  -u "$JIRA_USER:$JIRA_TOKEN" \
  -H "Accept: application/json" \
  -w "\nHTTP_STATUS:%{http_code}" \
  "$API_BASE/wiki/rest/api/content/search?cql=$CQL_ENCODED&limit=$LIMIT&expand=version,space")

HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')
```

**응답 파싱 (python3)**:
```python
import json, sys
data = json.loads(sys.stdin.read())
results = data.get('results', [])
total = data.get('totalSize', 0)
# 각 페이지: {'id': '123456', 'title': '페이지 제목', 'version': {'number': 5}, 'space': {'key': 'AINATIVE'}}
for page in results:
    page_id = page['id']
    title = page['title']
    version = page.get('version', {}).get('number', 1)
    space_key = page.get('space', {}).get('key', '')
    print(f"  ID: {page_id} | 제목: {title} | 버전: {version} | Space: {space_key}")
```

**에러 처리**:

| HTTP 상태 | 대응 |
|-----------|------|
| 400 | "CQL 오류: {error message}" |
| 401/403 | "인증 실패. JIRA_USER/JIRA_TOKEN 환경변수를 확인하세요." |
| 5xx | sleep 1 후 1회 재시도 |

---

## resolve-space-id

Space Key로 숫자 Space ID를 조회한다. `create-page`가 내부적으로 호출하며, 직접 호출도 가능하다.

**엔드포인트**: `GET /wiki/api/v2/spaces?keys={SPACE_KEY}`

**파라미터**: `SPACE_KEY`

```bash
RESPONSE=$(curl -s \
  -u "$JIRA_USER:$JIRA_TOKEN" \
  -H "Accept: application/json" \
  -w "\nHTTP_STATUS:%{http_code}" \
  "$API_BASE/wiki/api/v2/spaces?keys=$SPACE_KEY")

HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')
SPACE_ID=$(echo "$BODY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
results = d.get('results', [])
print(results[0]['id'] if results else '')
" 2>/dev/null)
```

`SPACE_ID`가 비어 있으면 "Space를 찾을 수 없습니다: {SPACE_KEY}" 출력 후 중단.

**에러 처리**:

| HTTP 상태 | 대응 |
|-----------|------|
| 401/403 | "인증 실패. JIRA_USER/JIRA_TOKEN 환경변수를 확인하세요." |
| 404 | "Space를 찾을 수 없습니다: {SPACE_KEY}" |

---

## create-page

새 Confluence 페이지를 생성한다. Space Key를 받아 내부적으로 `resolve-space-id`를 호출하여 Space ID를 해결한다.

**엔드포인트**: `POST /wiki/api/v2/pages`

> 페이지 body는 **Storage Format (XHTML)** 형식을 사용한다.
> 내용 작성 스타일은 [CONFLUENCE_STYLE.md](CONFLUENCE_STYLE.md) 참조.

**파라미터**: `SPACE_KEY`, `PARENT_ID`, `PAGE_TITLE`, `XHTML_BODY`

Space ID 해결:
```bash
# resolve-space-id 로직으로 SPACE_ID 획득 (위 섹션 참조)
```

**payload 생성 (python3)**:
```python
import json, sys

space_id = sys.argv[1]
parent_id = sys.argv[2]
page_title = sys.argv[3]
xhtml_body = sys.argv[4]  # Storage Format XHTML

payload = {
    "spaceId": space_id,
    "status": "current",
    "title": page_title,
    "parentId": parent_id,
    "body": {
        "representation": "storage",
        "value": xhtml_body
    }
}
json.dump(payload, open('/tmp/han-confluence-create.json', 'w'), ensure_ascii=False)
```

```bash
python3 /path/to/above_script.py "$SPACE_ID" "$PARENT_ID" "$PAGE_TITLE" "$XHTML_BODY"

RESPONSE=$(curl -s \
  -u "$JIRA_USER:$JIRA_TOKEN" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -w "\nHTTP_STATUS:%{http_code}" \
  -d @/tmp/han-confluence-create.json \
  "$API_BASE/wiki/api/v2/pages")

HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')
PAGE_ID=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)
rm -f /tmp/han-confluence-create.json
```

**에러 처리**:

| HTTP 상태 | 대응 |
|-----------|------|
| 400 | "페이지 생성 실패: {error details}" |
| 401/403 | "인증 실패 또는 Space 접근 권한 없음" |
| 409 (제목 중복) | 타임스탬프 접미어 추가 후 재시도: `PAGE_TITLE="${PAGE_TITLE}_$(date +%H%M%S)"` |
| 5xx | sleep 1 후 1회 재시도 |

---

## update-page

기존 Confluence 페이지를 업데이트한다.

**엔드포인트**: `PUT /wiki/api/v2/pages/{PAGE_ID}`

> 버전 번호 충돌을 방지하려면 현재 버전 + 1을 사용한다.

**파라미터**: `PAGE_ID`, `PAGE_TITLE`, `XHTML_CONTENT`, `VERSION` (현재 버전 + 1)

**payload 생성 (python3)**:
```python
import json, sys

page_id = sys.argv[1]
page_title = sys.argv[2]
xhtml_content = sys.argv[3]
version = int(sys.argv[4])  # 현재 버전 + 1

payload = {
    "id": page_id,
    "status": "current",
    "title": page_title,
    "version": {
        "number": version,
        "message": "han-atlassian으로 업데이트"
    },
    "body": {
        "representation": "storage",
        "value": xhtml_content
    }
}
json.dump(payload, open('/tmp/han-confluence-update.json', 'w'), ensure_ascii=False)
```

```bash
python3 /path/to/above_script.py "$PAGE_ID" "$PAGE_TITLE" "$XHTML_CONTENT" "$VERSION"

RESPONSE=$(curl -s \
  -u "$JIRA_USER:$JIRA_TOKEN" \
  -X PUT \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -w "\nHTTP_STATUS:%{http_code}" \
  -d @/tmp/han-confluence-update.json \
  "$API_BASE/wiki/api/v2/pages/$PAGE_ID")

HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')
rm -f /tmp/han-confluence-update.json
```

**에러 처리**:

| HTTP 상태 | 대응 |
|-----------|------|
| 400 | "페이지 업데이트 실패: {error details}" |
| 401/403 | "인증 실패 또는 페이지 편집 권한 없음" |
| 404 | "페이지를 찾을 수 없습니다: {PAGE_ID}" |
| 409 (버전 충돌) | "버전 충돌: 현재 페이지 버전을 다시 조회한 후 +1로 재시도하세요." |
| 5xx | sleep 1 후 1회 재시도 |

---

## attach-to-page

Confluence 페이지에 파일을 첨부한다.

**엔드포인트**: `POST /wiki/api/v2/pages/{PAGE_ID}/attachments`

> **주의**: `X-Atlassian-Token: no-check` 헤더 필수. 없으면 403 반환.
> Content-Type은 curl이 multipart/form-data를 자동 설정하므로 명시하지 않는다.

**파라미터**: `PAGE_ID`, `FILE_PATH`

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
  "$API_BASE/wiki/api/v2/pages/$PAGE_ID/attachments")

HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')
```

**에러 처리**:

| HTTP 상태 | 대응 |
|-----------|------|
| 403 | "첨부 권한 없음 또는 X-Atlassian-Token 헤더 누락" |
| 404 | "페이지를 찾을 수 없습니다: {PAGE_ID}" |
| 413 | "파일 크기 초과. 허용 한도 이하 파일을 사용하세요." |
| 5xx | sleep 1 후 1회 재시도 |

---

## 임시 파일 정리

각 operation 완료 후 임시 파일을 제거한다:

```bash
rm -f /tmp/han-confluence-create.json \
      /tmp/han-confluence-update.json
```
