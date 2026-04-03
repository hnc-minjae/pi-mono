#!/bin/bash
# Copyright 2026 Hancom Inc. All rights reserved.
#
# https://www.hancom.com/

# PreToolUse:Edit|Write hook: 첫 코드 수정 시 세션 컨텍스트에 start_time 기록
# han-start/han-code를 거치지 않은 직접 개발에서도 worklog 시간 계산이 가능하도록 한다.
# start_time이 이미 존재하면 아무것도 하지 않는다 (멱등).

SESSION_ID="${CLAUDE_SESSION_ID:-default}"
SESSIONS_DIR=".han/state/sessions"
CTX="${SESSIONS_DIR}/${SESSION_ID}.json"

# git 저장소가 아닌 곳에서는 스킵
[ -d ".git" ] || exit 0

python3 -c "
import json, os, sys
from datetime import datetime, timezone, timedelta

ctx_path = '${CTX}'
sessions_dir = '${SESSIONS_DIR}'
KST = timezone(timedelta(hours=9))
now = datetime.now(KST).isoformat()

# 세션 파일이 있으면 로드, 없으면 빈 dict
ctx = {}
if os.path.exists(ctx_path):
    try:
        ctx = json.load(open(ctx_path))
    except Exception:
        ctx = {}

# start_time이 이미 있으면 스킵
if ctx.get('start_time'):
    sys.exit(0)

# start_time 기록
os.makedirs(sessions_dir, exist_ok=True)
ctx['start_time'] = now
json.dump(ctx, open(ctx_path, 'w'), indent=2, ensure_ascii=False)
print(f'[han-dev] 작업 시작 시간 기록: {now}')
" 2>/dev/null

exit 0
