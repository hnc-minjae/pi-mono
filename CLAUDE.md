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
| `packages/pods` | 통합 패키지 |

## MCP 서버 구성

MCP 서버를 추가/수정할 때 **3곳 모두** 반영해야 한다:

| 파일 | 역할 | 변경 내용 |
|------|------|-----------|
| `.pi/extensions/mcp-bridge/index.ts` | 코딩 에이전트(pi)용 MCP 연결 | `MCP_SERVERS` 배열에 서버 추가 |
| `packages/desktop/server/bridge.ts` | 데스크톱 bridge 서버 | `stdioServers` Set + `servers` 배열에 추가 |
| `packages/desktop/src/main.ts` | 데스크톱 프론트엔드 UI | `servers` 배열에 추가 (하드코딩, bridge 응답으로 자동 추가 안 됨) |

- `@hancom/hwp-cli/dist/mcp-stdio-server.mjs`가 MCP stdio 서버 바이너리
- `--service cowriter:file` (파일 기반), `--service cowriter:auto` (한글 COM 자동화)
- stdio 서버는 토큰 없이 연결 가능, HTTP 서버(Atlassian)는 OAuth 필요

## Desktop 앱 구조

```
packages/desktop/
├── src/                    # 프론트엔드 (Lit + Vite)
│   ├── main.ts             # 메인 앱 엔트리 (MCP 설정 UI 포함)
│   ├── mcp-settings-tab.ts # MCP 설정 탭 컴포넌트
│   └── rpc-adapter.ts      # WebSocket RPC 어댑터
├── server/                 # Bridge 서버 (Node.js)
│   ├── start.ts            # 서버 엔트리
│   └── bridge.ts           # RPC bridge + MCP 상태 관리
└── src-tauri/              # Tauri Rust 백엔드
    └── src/lib.rs          # 커맨드, 플러그인 등록

.pi/extensions/mcp-bridge/
└── index.ts                # 코딩 에이전트용 MCP 브릿지 확장
```

- 실행: `npx tauri dev` (packages/desktop에서)
- bridge 서버는 Tauri가 sidecar로 자동 실행 (`tsx server/start.ts`)

## Gotchas

- **`packages/ai/src/models.generated.ts`는 자동 생성 파일** — 직접 수정 금지, `npm run generate-models`로 재생성
- **`@hancom` 패키지 설치 시 `GITLAB_NPM_TOKEN` 필요** — 없으면 `npm ci` 실패
- **pre-commit 훅이 `npm run check` 실행** — biome + tsgo 에러가 있으면 커밋 차단
- **테스트는 패키지 루트에서 실행** — 레포 루트에서 `npm test` 금지, 자세한 내용은 `.claude/rules/test.md` 참조
- **MCP 서버 추가 시 3곳 동시 수정 필수** — 위 "MCP 서버 구성" 참조

## Docs

프로젝트 참조 문서는 `.claude/docs/`에 있습니다. **작업 전 해당 문서를 먼저 읽을 것.**

| 문서 | 참조 시점 |
|------|-----------|
| `architecture.md` | 프로젝트 전체 구조, 패키지 의존 관계, 데이터 흐름 파악 시 |
| `desktop-app.md` | Desktop 프론트엔드/서버/Tauri 수정 시 |
| `mcp-system.md` | MCP 서버 추가/수정, OAuth, 토큰 관리 작업 시 |
| `rpc-protocol.md` | RPC 명령/응답/이벤트 추가, 통신 디버깅 시 |
| `extension-system.md` | .pi/ 확장/스킬/에이전트 추가/수정 시 |

## Rules

세부 코딩 규약은 `.claude/rules/`에 있습니다:
- `typescript.md` — 포맷팅, import, 타입 규약
- `tauri-rust.md` — Tauri Rust 커맨드/플러그인
- `tauri-config.md` — capabilities, tauri.conf.json
- `desktop-frontend.md` — Lit + Tauri API 패턴
- `test.md` — 테스트 실행 및 작성 규칙
