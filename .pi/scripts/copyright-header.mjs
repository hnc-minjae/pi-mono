#!/usr/bin/env node
/**
 * PostToolUse hook: 한컴 저작권 헤더 자동 삽입
 *
 * 가이드: https://hancom.atlassian.net/wiki/spaces/ALLDEVELOP/pages/1968111859
 * - 신규 파일 Write/Edit 시 Copyright 헤더가 없으면 자동 추가
 * - 이미 Copyright이 있으면 skip (idempotent)
 * - SheBang(#!) 라인 다음에 삽입
 * - 생성연도: git 최초 커밋 기준, 없으면 현재 연도
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { extname, basename, dirname } from 'path';

// stdin에서 hook JSON 읽기
const input = JSON.parse(readFileSync(0, 'utf-8'));
const { tool_name, tool_input } = input;

// Write 또는 Edit만 처리
if (tool_name !== 'Write' && tool_name !== 'Edit') process.exit(0);

const filePath = tool_input?.file_path;
if (!filePath || !existsSync(filePath)) process.exit(0);

const ext = extname(filePath).toLowerCase().slice(1);
const base = basename(filePath);

// 파일 타입별 주석 스타일
const BLOCK = ['c','cpp','h','hpp','java','js','ts','jsx','tsx','cs','swift','kt','go','css','scss','less','mjs','cjs'];
const HASH  = ['py','rb','sh','bash','yaml','yml'];
const XML   = ['html','xml','jsp','svg','vue'];

let style = null;
if (BLOCK.includes(ext))          style = 'block';
else if (HASH.includes(ext))      style = 'hash';
else if (XML.includes(ext))       style = 'xml';
else if (base === 'Dockerfile')   style = 'hash';
else                               process.exit(0);

// 이미 Copyright 있으면 skip
const content = readFileSync(filePath, 'utf-8');
if (/copyright/i.test(content.split('\n').slice(0, 20).join('\n'))) process.exit(0);

// 생성연도: git 최초 커밋 기준, 실패 시 현재 연도
let year = new Date().getFullYear();
try {
  const gitOut = execSync(
    `git -C "${dirname(filePath)}" log --follow --diff-filter=A --format="%ad" --date=format:"%Y" -- "${filePath}"`,
    { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
  ).trim();
  const firstYear = gitOut.split('\n').filter(Boolean).pop();
  if (firstYear) year = firstYear;
} catch { /* 신규 파일 등 git 히스토리 없는 경우 현재 연도 사용 */ }

// 파일 타입별 헤더 템플릿
const HEADERS = {
  block: `/*\n * Copyright ${year} Hancom Inc. All rights reserved.\n *\n * https://www.hancom.com/\n */\n`,
  hash:  `# Copyright ${year} Hancom Inc. All rights reserved.\n#\n# https://www.hancom.com/\n`,
  xml:   `<!--\n  Copyright ${year} Hancom Inc. All rights reserved.\n\n  https://www.hancom.com/\n-->\n`,
};
const header = HEADERS[style];

// SheBang(#!) 처리: 첫 줄 다음에 삽입
const lines = content.split('\n');
let newContent;
if (lines[0]?.startsWith('#!')) {
  newContent = lines[0] + '\n' + header + '\n' + lines.slice(1).join('\n');
} else {
  newContent = header + '\n' + content;
}

// 세션 context에 start_time 자동 기록 (없을 때만)
const sessionId = process.env.CLAUDE_SESSION_ID || 'default';
const sessionsDir = '.han/state/sessions';
const ctxPath = `${sessionsDir}/${sessionId}.json`;

try {
  if (!existsSync(ctxPath)) {
    const { mkdirSync } = await import('fs');
    mkdirSync(sessionsDir, { recursive: true });
    const branch = (() => {
      try {
        return execSync('git branch --show-current', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      } catch { return ''; }
    })();
    const kstOffset = 9 * 60 * 60 * 1000;
    const now = new Date(Date.now() + kstOffset).toISOString().replace('Z', '+09:00');
    const ctx = { start_time: now, branch_name: branch, stage: '' };
    writeFileSync(ctxPath, JSON.stringify(ctx, null, 2), 'utf-8');
  }
} catch { /* 세션 context 기록 실패는 무시 */ }

writeFileSync(filePath, newContent, 'utf-8');
process.exit(0);
