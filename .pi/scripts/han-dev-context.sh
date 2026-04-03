#!/bin/bash
# Copyright 2026 Hancom Inc. All rights reserved.
#
# https://www.hancom.com/

# UserPromptSubmit hook: 활성 han-dev 워크플로우 상태 표시
# 현재 세션(CLAUDE_SESSION_ID)의 context 파일을 읽어 이슈/브랜치/단계를 출력한다.

SESSION_ID="${CLAUDE_SESSION_ID:-default}"
CTX=".han/state/sessions/${SESSION_ID}.json"
[ -f "$CTX" ] || exit 0

python3 -c "
import json
try:
    c = json.load(open('.han/state/sessions/${SESSION_ID}.json'))
    s = c.get('stage', '')
    if s and s != 'close_done':
        print('[han-dev] 이슈:', c.get('issue_key', 'N/A'),
              '| 브랜치:', c.get('branch_name', 'N/A'),
              '| 단계:', s)
except Exception:
    pass
" 2>/dev/null

exit 0
