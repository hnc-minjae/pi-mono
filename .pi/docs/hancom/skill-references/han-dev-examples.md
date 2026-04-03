# han-dev 실행 흐름 예시

> 이 파일은 스킬이 아닌 참조 문서입니다.
> han-dev 스킬의 실제 실행 흐름 예시를 담고 있습니다.

---

## Happy Path (처음 실행)

```
$ /han-dev:han-dev AIAGENT-123

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
han-dev — 개발 전체 하네스
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
컨텍스트 없음 → 1단계(han-start)부터 전체 실행합니다.

... [han-start 실행] ...

────────────────────────────────────────
[1단계 완료] 이슈: [AIAGENT-123] [PDF] 한글 폰트 렌더링 오류
             stage: pre_done ✅
→ 2단계(han-code)로 진행하시겠습니까?
  Enter → 진행  /  n → 여기서 중단
[Enter]

... [han-code 실행] ...

────────────────────────────────────────
[2단계 완료] 브랜치: fix/AIAGENT-123-hangul-font-rendering
             stage: code_done ✅
→ 3단계(han-close)로 진행하시겠습니까?
  Enter → 진행  /  n → 여기서 중단
[Enter]

... [han-close 실행] ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ han-dev (전체 하네스) 완료
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
이슈:      [AIAGENT-123] [PDF] 한글 폰트 렌더링 오류
브랜치:    fix/AIAGENT-123-hangul-font-rendering
커밋:      a1b2c3d
MR:        https://gitlab.hancom.com/.../merge_requests/42
작업시간:  6시간 30분
Jira:      To Do → In Progress → Resolved
```

---

## 재개 (stage=code_done)

```
$ /han-dev:han-dev

stage=code_done 감지 → 3단계(han-close)부터 재개합니다.

[1단계] han-start ✅ 스킵 (이미 완료: stage=code_done)
[2단계] han-code  ✅ 스킵 (이미 완료: stage=code_done)

────────────────────────────────────────
[3단계 준비] han-close — 커밋·MR·Jira 마무리
  이슈: [AIAGENT-123] [PDF] 한글 폰트 렌더링 오류
  브랜치: fix/AIAGENT-123-hangul-font-rendering
────────────────────────────────────────

... [han-close 실행] ...
```
