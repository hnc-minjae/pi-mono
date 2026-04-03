# 한컴 Atlassian API 공통 패턴

> 이 파일은 스킬이 아닌 참조 문서입니다. 모든 han-* 스킬의 SKILL.md에서 참조합니다.
> **han-atlassian 스킬을 통해 위임합니다.** Atlassian MCP 및 curl + Basic Auth 직접 호출 방식은 사용하지 않습니다.

## han-atlassian 위임 패턴

모든 Jira/Confluence 작업은 `han-atlassian` 스킬에 위임한다.
`han-atlassian`은 `~/.config/han/han-config.md`의 `API_BASE`와 `JIRA_USER`/`JIRA_TOKEN` 환경변수로 인증한다.

구현 상세: `skills/han-atlassian/JIRA_OPS.md`, `skills/han-atlassian/CONFLUENCE_OPS.md`

---

## Jira 위임 패턴

### 이슈 조회
```
→ han-atlassian get-issue {ISSUE_KEY} 위임
```

### JQL 검색
```
→ han-atlassian search "{JQL 쿼리}" --fields key,summary,status,... --max 30 위임
```

예시:
```
→ han-atlassian search "assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC" --fields summary,status,issuetype,priority --max 30 위임
```

### 이슈 생성
```
→ han-atlassian create-issue {PROJECT_KEY} "{제목}" {issuetype} "{설명}" 위임
```

### 상태 전환 목록 조회
```
→ han-atlassian get-transitions {ISSUE_KEY} 위임
```

### 상태 전환 실행
```
→ han-atlassian transition {ISSUE_KEY} "{전환 이름}" 위임
```
(이름으로 전환 ID를 내부 조회하므로 ID 전달 불필요)

### Worklog 기록
```
→ han-atlassian add-worklog {ISSUE_KEY} {초_단위} "{ISO8601_시작시간}" 위임
```

예시:
```
→ han-atlassian add-worklog AIAGENT-123 3600 "2026-03-22T09:00:00.000+0900" 위임
```

### 코멘트 추가
```
→ han-atlassian add-comment {ISSUE_KEY} "{Markdown 내용}" 위임
```
(Markdown → ADF 변환은 han-atlassian 내부에서 처리)

### 현재 사용자 조회
```
→ han-atlassian myself 위임
```
반환: `DISPLAY_NAME`, `ACCOUNT_ID`

### 파일 첨부
```
→ han-atlassian attach-to-issue {ISSUE_KEY} {파일경로} 위임
```

---

## Confluence 위임 패턴

### CQL 검색
```
→ han-atlassian search-confluence "{CQL 쿼리}" --limit 10 위임
```

### 페이지 생성
```
→ han-atlassian create-page "{제목}" "{Storage Format XHTML 내용}" 위임
```
(Space ID, 상위 페이지 ID는 `~/.config/han/han-config.md`에서 자동 로드)

### 페이지 업데이트
```
→ han-atlassian update-page {PAGE_ID} "{제목}" "{Storage Format XHTML 내용}" 위임
```

### 파일 첨부
```
→ han-atlassian attach-to-page {PAGE_ID} {파일경로} 위임
```

---

## Agile API (han-atlassian 미지원 — curl 유지)

Jira Agile API(`/rest/agile/1.0/`)는 han-atlassian에서 지원하지 않아 curl을 유지한다.
`API_BASE`, `JIRA_USER`, `JIRA_TOKEN`이 필요하다.

```bash
# Board 조회
curl -s -u "$JIRA_USER:$JIRA_TOKEN" \
  "$API_BASE/rest/agile/1.0/board?projectKeyOrId=$PROJECT_KEY&type=scrum" \
  -H "Accept: application/json"

# Sprint 목록 조회
curl -s -u "$JIRA_USER:$JIRA_TOKEN" \
  "$API_BASE/rest/agile/1.0/board/$BOARD_ID/sprint?state=active,closed" \
  -H "Accept: application/json"
```

> Agile API를 사용하는 스킬(han-sprint-report, han-collect)만 `JIRA_USER`, `JIRA_TOKEN`, `API_BASE` 환경변수가 필요합니다.

---

## han-collect 수집 데이터셋 구조

`han-collect` 스킬이 저장하는 JSON 데이터셋 구조.
상위 스킬(han-report, han-mbo 등)에서 이 데이터를 읽어 활용한다.

### 저장 경로

```
~/.tasks/collect/{mode}-{key}-{YYMMDD-HHmm}.json
```

### 최상위 구조

```json
{
  "meta": {
    "mode": "sprint | period",
    "sprint_name": "Sprint 15",
    "project_key": "AIAGENT",
    "period": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
    "collected_at": "ISO 8601",
    "sources": ["jira", "confluence", "gitlab"]
  },
  "jira": { "issues": [ ... ] },
  "confluence": { "pages": [ ... ] },
  "gitlab": { "mrs": [ ... ] }
}
```

> `confluence`, `gitlab` 키는 해당 플래그(`--confluence`, `--gitlab`) 사용 시에만 포함된다.

### jira.issues 필드

```json
{
  "key": "AIAGENT-123",
  "summary": "이슈 제목",
  "status": "In Progress",
  "assignee": "홍길동",
  "issuetype": "Task",
  "fixVersions": ["1.5.0"],
  "created": "ISO 8601",
  "updated": "ISO 8601",
  "comments": [
    { "author": "홍길동", "created": "ISO 8601", "body": "텍스트" }
  ]
}
```

### confluence.pages 필드

```json
{
  "id": "123456",
  "title": "페이지 제목",
  "url": "{API_BASE}/wiki/spaces/{KEY}/pages/123456",
  "excerpt": "페이지 요약 (첫 200자)"
}
```

### gitlab.mrs 필드

```json
{
  "iid": 42,
  "title": "feat: 새 기능 추가",
  "state": "merged",
  "author": "홍길동",
  "target_branch": "develop",
  "merged_at": "ISO 8601",
  "commits": [
    { "id": "abc1234", "title": "커밋 제목", "authored_date": "ISO 8601" }
  ]
}
```
