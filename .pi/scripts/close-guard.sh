#!/bin/bash
# Copyright 2026 Hancom Inc. All rights reserved.
#
# https://www.hancom.com/

# Stop hook: han-close 미완료 상태에서 세션 종료 시 경고 출력
# stage 가 code_done(커밋 완료, MR/Jira 미처리) 일 때만 경고한다.

SESSION_ID="${CLAUDE_SESSION_ID:-default}"
CTX=".han/state/sessions/${SESSION_ID}.json"
[ -f "$CTX" ] || exit 0

python3 -c "
import json
try:
    c = json.load(open('.han/state/sessions/${SESSION_ID}.json'))
    s = c.get('stage', '')
    if s == 'code_done':
        print('⚠️  han-close 가 완료되지 않았습니다.')
        print('   이슈:', c.get('issue_key', '?'), '| MR/Jira/Worklog 처리가 남아 있습니다.')
        print('   계속하려면: /han-dev:han-close')
except Exception:
    pass
" 2>/dev/null

exit 0
