#!/bin/bash
# PreToolUse(Bash) hook: git commit/push 시 민감 정보 패턴 감지 → 차단
# CLAUDE_TOOL_INPUT 환경변수에서 실행 예정 명령어를 추출한다.

CMD=$(echo "$CLAUDE_TOOL_INPUT" | python3 -c \
    "import json,sys; d=json.load(sys.stdin); print(d.get('command',''))" 2>/dev/null)

# git commit 또는 push 명령이 아니면 통과
echo "$CMD" | grep -qE "git (commit|push)" || exit 0

# 스테이징된 파일에서 민감 정보 패턴 검사
if git diff --cached 2>/dev/null | grep -iqE \
    "(api[_-]?key|password|secret|token)\s*[=:\"']+\s*.{8,}"; then
    echo "경고: 민감 정보 패턴이 감지되었습니다 — 커밋을 중단합니다."
    echo "스테이징된 파일을 확인하고 환경변수 또는 .gitignore 처리 후 재시도하세요."
    exit 2
fi

exit 0
