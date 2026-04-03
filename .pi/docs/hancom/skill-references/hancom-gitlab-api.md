# 한컴 GitLab CLI (glab) 참조

> 이 파일은 스킬이 아닌 참조 문서입니다. han-collect, han-reviewer, han-close 스킬에서 참조합니다.

## 개요

GitLab API 접근은 `glab` CLI를 사용한다. curl 직접 호출 대신 glab을 통해 인증 및 요청을 처리한다.
glab은 현재 디렉토리의 git remote에서 GitLab 프로젝트를 자동 감지한다.

## 인증 설정

```bash
# 인증 상태 확인
glab auth status

# 로그인 (사내 GitLab 인스턴스)
glab auth login --hostname gitlab.hancom.com

# 인증 실패 시 처리 패턴
if ! glab auth status &>/dev/null; then
  echo "GitLab 인증이 필요합니다."
  echo "실행: glab auth login --hostname gitlab.hancom.com"
  exit 1
fi
```

---

## MR 관련 명령어

| 명령 | 설명 |
|------|------|
| `glab mr list` | MR 목록 조회 |
| `glab mr view {MR_IID}` | MR 상세 조회 |
| `glab mr diff {MR_IID}` | MR diff 조회 |
| `glab mr commits {MR_IID}` | MR 커밋 목록 조회 |
| `glab mr note {MR_IID} --message "..."` | MR 코멘트 작성 |
| `glab mr create` | MR 생성 |
| `glab mr approve {MR_IID}` | MR 승인 |

---

## glab mr list 주요 옵션

```bash
glab mr list \
  --state merged|opened|closed|all \
  --target-branch {브랜치명} \
  --author {사용자명} \
  --milestone {마일스톤명} \
  --output json \
  --per-page 50
```

기간 필터링은 CLI 옵션이 제한적이므로, `--output json` 출력 후 `merged_at`/`created_at` 필드로 필터링한다:
```bash
glab mr list --state merged --output json 2>/dev/null | \
  jq '[.[] | select(.merged_at >= "2026-03-17" and .merged_at <= "2026-03-21")]'
```

---

## glab mr view

```bash
# MR 상세 정보 (JSON 출력)
glab mr view {MR_IID} --output json

# 추출 필드: iid, title, state, author.name, source_branch, target_branch, description, web_url
```

---

## glab mr diff

```bash
# MR diff 조회 (unified diff 형식)
glab mr diff {MR_IID}

# 특정 파일만 조회
glab mr diff {MR_IID} -- path/to/file.cpp
```

---

## glab mr commits

```bash
# MR 커밋 목록 (JSON 출력)
glab mr commits {MR_IID} --output json

# 추출 필드: id, title, message, authored_date, author_name
```

---

## glab mr note (코멘트 작성)

```bash
# MR에 전체 코멘트 작성
glab mr note {MR_IID} --message "코멘트 내용"

# 여러 줄 코멘트 (heredoc 활용)
glab mr note {MR_IID} --message "$(cat <<'EOF'
## 코드 리뷰

- 항목 1
- 항목 2
EOF
)"
```

---

## glab mr create 주요 옵션

```bash
glab mr create \
  --title "MR 제목" \
  --description "설명" \
  --source-branch {소스 브랜치} \
  --target-branch develop \
  --assignee {담당자} \
  --label "label1,label2" \
  --milestone {마일스톤}
```

> `--source-branch`를 생략하면 현재 브랜치가 자동으로 사용된다.

---

## JSON 출력 파싱

`--output json` 플래그로 JSON 출력을 받아 처리한다:

```bash
# MR 목록 JSON 조회
glab mr list --state merged --output json 2>/dev/null

# jq로 iid 추출
glab mr list --state merged --output json | jq '.[].iid'

# jq로 특정 기간 필터링
glab mr list --state merged --output json | \
  jq '[.[] | select(.merged_at >= "2026-03-17")]'
```

---

## 주의사항

- `MR_IID`는 GitLab 내부 프로젝트 MR 번호이며 전역 ID와 다르다
- `--hostname` 플래그로 사내 GitLab 인스턴스를 명시할 수 있다 (기본값: gitlab.com)
- glab은 현재 작업 디렉토리가 git 저장소여야 정상 동작한다
- `--output json` 없으면 사람이 읽기 쉬운 포맷으로 출력됨

## 임시 파일 패턴

| 용도 | 경로 |
|------|------|
| MR diff 임시 저장 | `/tmp/han-mr-diff.patch` |
| MR 코멘트 본문 | `/tmp/han-mr-note.md` |

작업 완료 후 항상 정리:
```bash
rm -f /tmp/han-mr-*.patch /tmp/han-mr-*.md
```
