---
name: han-atlassian
description: 한컴 Atlassian 파일 첨부 전용 게이트웨이.
  MCP가 지원하지 않는 multipart upload(파일 첨부)만 담당한다.
user_invocable: true
argument: "{operation} {args...} — 예: attach-to-issue AIAGENT-123 /tmp/screenshot.png | attach-to-page 12345 /tmp/report.pdf"
---

# Atlassian 파일 첨부 게이트웨이

Jira 이슈·Confluence 페이지에 파일을 첨부하는 전용 스킬.

> **MCP 직접 호출 안내**: Jira/Confluence의 읽기·쓰기·상태 전환 등 대부분의 Operation은
> MCP Atlassian 도구(`mcp__atlassian__*`)를 직접 호출한다.
> 이 스킬은 MCP가 지원하지 않는 **multipart upload(파일 첨부)만** 담당한다.

참조:
- [JIRA_OPS.md](JIRA_OPS.md) — Jira 파일 첨부 curl 구현 상세
- [CONFLUENCE_OPS.md](CONFLUENCE_OPS.md) — Confluence 파일 첨부 curl 구현 상세

---

## 공통 설정

### 설정 파일 로드

`~/.config/han/han-config.md` 읽기:
- 파일 없음 → **"/han-dev:han-dev-setup 을 먼저 실행하세요."** 출력 후 중단

추출:

| 변수 | 섹션 | 키 |
|------|------|----|
| `API_BASE` | Atlassian | Base URL |

### 환경변수 확인

먼저 `~/.config/han/.env` 파일이 있으면 자동으로 로드한다:

```bash
[ -f ~/.config/han/.env ] && source ~/.config/han/.env
```

환경변수가 여전히 미설정이면 안내 후 중단:

```bash
[ -z "$JIRA_USER" ] || [ -z "$JIRA_TOKEN" ] → 아래 안내 후 중단
```

```
ERROR: JIRA_USER 또는 JIRA_TOKEN 환경변수가 설정되지 않았습니다.
/han-dev:han-dev-setup 을 실행하여 API 인증 정보를 설정하세요.

직접 설정하려면:
  export JIRA_USER="your-email@hancom.com"
  export JIRA_TOKEN="your-atlassian-api-token"
API 토큰 발급: https://id.atlassian.com/manage-profile/security/api-tokens
```

### 공통 curl 옵션

```bash
-s                              # silent
-u "$JIRA_USER:$JIRA_TOKEN"    # Basic Auth
-H "Accept: application/json"  # JSON 응답
-w "\nHTTP_STATUS:%{http_code}" # 상태코드 파싱
```

### 재시도 정책

4xx/5xx 응답 시 `sleep 1` 후 1회 재시도. 재실패 시 에러 출력 후 중단.

---

## Operations

### Jira — 파일 첨부

| Operation | 구현 | 설명 |
|-----------|------|------|
| `attach-to-issue {KEY} {FILE_PATH}` | curl (multipart) | Jira 이슈에 파일 첨부 |

→ curl 구현 상세: [JIRA_OPS.md](JIRA_OPS.md)

### Confluence — 파일 첨부

| Operation | 인자 | 설명 |
|-----------|------|------|
| `attach-to-page {PAGE_ID} {FILE_PATH}` | 페이지 ID, 로컬 파일 경로 | Confluence 페이지에 파일 첨부 |

→ curl 구현 상세: [CONFLUENCE_OPS.md](CONFLUENCE_OPS.md)
