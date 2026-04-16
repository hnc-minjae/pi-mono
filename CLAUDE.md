# pi-monorepo

## Commands

```bash
# 의존성 설치 (GITLAB_NPM_TOKEN 환경변수 필요 — ~/.bashrc에 설정)
npm ci

# 전체 빌드 (패키지 순서: tui → ai → agent → coding-agent → mom → web-ui → pods)
npm run build

# 린트 + 타입 체크 (biome + tsgo --noEmit)
npm run check

# 전체 테스트
npm test

# 릴리즈 바이너리 빌드 (5개 플랫폼)
./scripts/build-binaries.sh
./scripts/build-binaries.sh --platform linux-x64  # 단일 플랫폼
```

## Packages

| 패키지 | 역할 |
|--------|------|
| `packages/ai` | AI 프로바이더 추상화, 모델 레지스트리 |
| `packages/agent` | 에이전트 코어 |
| `packages/coding-agent` | CLI 코딩 에이전트 (pi) |
| `packages/desktop` | Tauri 데스크톱 앱 |
| `packages/mom` | 메시지 오케스트레이터 |
| `packages/tui` | TUI 컴포넌트 |
| `packages/web-ui` | 웹 UI 컴포넌트 |
| `packages/pods` | vLLM GPU Pod 관리 CLI |

## Gotchas

- **`packages/ai/src/models.generated.ts`는 자동 생성 파일** — 직접 수정 금지, `npm run generate-models`로 재생성
- **`@hancom` 패키지 설치 시 `GITLAB_NPM_TOKEN` 필요** — 없으면 `npm ci` 실패
- **pre-commit 훅이 `npm run check` 실행** — biome + tsgo 에러가 있으면 커밋 차단
- **테스트는 패키지 루트에서 실행** — 레포 루트에서 `npm test` 금지, 자세한 내용은 `.claude/rules/test.md` 참조

## Rules

세부 코딩 규약은 `.claude/rules/`에 있습니다:
- `typescript.md` — 포맷팅, import, 타입 규약
- `tauri-rust.md` — Tauri Rust 커맨드/플러그인
- `tauri-config.md` — capabilities, tauri.conf.json
- `desktop-frontend.md` — Lit + Tauri API 패턴
- `test.md` — 테스트 실행 및 작성 규칙
