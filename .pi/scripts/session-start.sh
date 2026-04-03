#!/bin/bash
# Copyright 2026 Hancom Inc. All rights reserved.
#
# https://www.hancom.com/

# SessionStart hook: 이전 세션의 미완료 han-dev 작업 감지 → 재개 안내
# 현재 세션 ID와 다른 파일 중 stage가 close_done이 아닌 항목을 탐색한다.

SESSION_ID="${CLAUDE_SESSION_ID:-default}"
SESSIONS_DIR=".han/state/sessions"

[ -d "$SESSIONS_DIR" ] || exit 0

python3 - <<'PYEOF'
import json, os, glob

session_id = os.environ.get('CLAUDE_SESSION_ID', 'default')
sessions_dir = '.han/state/sessions'
done_stages = {'close_done', 'security_blocked', ''}

incomplete = []
for path in glob.glob(f"{sessions_dir}/*.json"):
    fname = os.path.basename(path).replace('.json', '')
    if fname == session_id:
        continue  # 현재 세션은 제외
    try:
        c = json.load(open(path))
        stage = c.get('stage', '')
        if stage not in done_stages:
            incomplete.append({
                'file': path,
                'issue_key': c.get('issue_key', '(이슈 미연결)'),
                'branch': c.get('branch_name', '(브랜치 없음)'),
                'stage': stage,
                'start_time': c.get('start_time', ''),
            })
    except Exception:
        pass

if incomplete:
    print('\n[han-dev] 미완료 작업이 감지되었습니다:')
    for i, w in enumerate(incomplete, 1):
        print(f"  [{i}] 이슈: {w['issue_key']} | 브랜치: {w['branch']} | 단계: {w['stage']}")
        print(f"       시작: {w['start_time']} | 파일: {w['file']}")
    print('\n재개하려면 해당 작업의 브랜치로 전환 후 /han-dev:han-code 또는 /han-dev:han-close 를 실행하세요.')
    print('해당 세션 context를 현재 세션으로 복사하려면:')
    for w in incomplete:
        new_path = f".han/state/sessions/{session_id}.json"
        print(f"  cp \"{w['file']}\" \"{new_path}\"")
PYEOF

exit 0
