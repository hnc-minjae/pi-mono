---
name: han-dev
description: 한컴 3단계 개발 하네스. start-agent → code-agent → close-agent를 subagent chain으로 순차 실행한다. "이슈 작업 시작", "개발 전체", "개발 하네스", "전체 워크플로우", "처음부터 끝까지", "start to close", "full dev" 등에 반응.
argument: "[ISSUE_KEY] — 예: /han-dev AIAGENT-123"
---

# han-dev — 3단계 개발 하네스

start-agent(1단계) → code-agent(2단계) → close-agent(3단계)를 subagent chain으로 순차 실행한다.

## 책임 분담

| 단계 | 에이전트 | 범위 |
|------|----------|------|
| 1단계 | start-agent | Jira 이슈 파악 + To Do 전환 (Jira 세계만) |
| 2단계 | code-agent | 브랜치~코드~커밋~MR~Worklog~코멘트 (개발 전 과정) |
| 3단계 | close-agent | Jira Resolved 전환만 (사용자 확인 필수) |

## 실행 전 준비

1. `~/.config/han/han-config.md` 파일을 읽어 환경을 확인한다.
2. 환경변수 `JIRA_USER`, `JIRA_TOKEN`이 설정되어 있는지 확인한다.
3. `.han/state/sessions/` 디렉토리를 생성한다.
4. 기존 세션 파일이 있으면 stage를 확인하여 재개 지점을 결정한다:
   - `pre_done` → 2단계(code-agent)부터
   - `code_done` → 3단계(close-agent)부터
   - `close_done` → "이미 완료" 안내
   - `security_blocked` → "보안 이슈 해결 필요" 안내 후 중단

## subagent chain 실행

```
subagent({
  chain: [
    {
      agent: "start-agent",
      task: "이슈 {{ISSUE_KEY}}에 대한 개발 전단계를 수행하세요. han_jira 도구로 이슈를 조회하고 To Do 상태로 전환한 뒤 .han/state/sessions/default.json에 컨텍스트를 저장하세요."
    },
    {
      agent: "code-agent",
      task: "개발 2단계 전 과정을 수행하세요. 이전 단계 결과: {previous}. .han/state/sessions/default.json에서 이슈 정보를 읽고, 브랜치 생성 → Jira In Progress → 코드 구현 → 보안 검토 → 커밋 → MR 생성 → Worklog 기록 → 코멘트 추가까지 완료하세요."
    },
    {
      agent: "close-agent",
      task: "마무리 3단계를 수행하세요. 이전 단계 결과: {previous}. .han/state/sessions/default.json에서 컨텍스트를 읽고, 사용자 확인 후 Jira 상태를 Resolved로 전환하세요. Done으로는 절대 전환하지 마세요."
    }
  ],
  agentScope: "project"
})
```

## 완료 후

결과를 요약하여 표시한다:
- 이슈 키 및 제목
- 브랜치명
- 커밋 SHA
- MR URL
- 작업 시간
- Jira 상태 전환 결과
