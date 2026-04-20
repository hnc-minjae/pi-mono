# MCP System Reference

## 개요

MCP(Model Context Protocol) 서버를 통해 외부 서비스(Atlassian, HWP)를 에이전트 도구로 연결한다.

## 서버 추가/수정 시 변경 위치 (3곳 필수)

| 파일 | 변경 내용 |
|------|-----------|
| `.pi/extensions/mcp-bridge/index.ts` | `MCP_SERVERS` 배열 |
| `packages/desktop/server/bridge.ts` | `stdioServers` Set + `servers` 배열 |
| `packages/desktop/src/main.ts` | `servers` 배열 (하드코딩, 동적 추가 안 됨) |

## 현재 서버 목록

| key | 타입 | 서비스 | prefix | 인증 |
|-----|------|--------|--------|------|
| `atlassian` | HTTP | Atlassian MCP | `mcp__atlassian` | OAuth 2.0 |
| `hwp-cowriter-file` | stdio | `cowriter:file` | `mcp__hwp_file` | 불필요 |
| `hwp-cowriter-auto` | stdio | `cowriter:auto` | `mcp__hwp_auto` | 불필요 |

- stdio 서버는 토큰 없이 항상 연결 가능
- HTTP 서버는 OAuth 토큰 필요

## 파일 구조

```
.pi/extensions/mcp-bridge/
├── index.ts           # MCP_SERVERS 정의, 도구 등록, 연결 로직
├── oauth-provider.ts  # OAuth 2.0 PKCE 흐름
└── token-store.ts     # 토큰 저장/로드
```

## MCP 서버 설정 타입

```typescript
// HTTP (OAuth 필요)
interface McpHttpServerConfig {
	type: "http";
	key: string;      // 고유 식별자
	name: string;     // 표시 이름
	url: string;      // MCP 서버 URL
	prefix: string;   // 도구 이름 접두어
}

// stdio (토큰 불필요)
interface McpStdioServerConfig {
	type: "stdio";
	key: string;
	name: string;
	command: string;   // 실행 명령
	args: string[];    // 명령 인자
	cwd?: string;
	env?: Record<string, string>;
	prefix: string;
}
```

## HWP MCP 서버

- 바이너리: `@hancom/hwp-cli/dist/mcp-stdio-server.mjs`
- 해결: `require.resolve("@hancom/hwp-cli/dist/mcp-stdio-server.mjs")` → fallback: `node_modules` 직접 탐색
- 서비스: `--service cowriter:file` (파일 기반), `--service cowriter:auto` (COM 자동화)

## 도구 등록 흐름

```
session_start 이벤트
  ↓
각 MCP_SERVERS에 대해:
  ├── HTTP: connectHttpServerWithToken() — 기존 토큰만 시도 (OAuth 없음)
  └── stdio: connectStdioServer() — 즉시 연결
  ↓
client.listTools() — 서버에서 사용 가능한 도구 목록 조회
  ↓
각 도구에 대해 registerMcpTool():
  ├── 도구 이름: ${prefix}__${tool.name}
  ├── JSON Schema → TypeBox 변환
  └── execute: client.callTool() (30초 타임아웃)
```

## OAuth 인증 흐름

수동 연결 시 (`/mcp-connect` 커맨드):

```
1. discoverOAuthMetadata() — OAuth 엔드포인트 탐색
2. registerClient() — 클라이언트 등록 (필요 시)
3. PKCE 생성: code_verifier (32바이트 random) → SHA256 → code_challenge
4. 인증 URL 생성 → 브라우저 열기
5. 콜백 서버 시작 (localhost:9876/oauth/callback)
6. 사용자 인증 → code 수신 (최대 2분 대기)
7. fetchToken() — code → access_token 교환
8. saveTokens() — ~/.config/han/mcp-tokens.json에 저장
```

## 토큰 관리

### 저장 위치

`~/.config/han/mcp-tokens.json`

### 토큰 구조

```json
{
  "atlassian": {
    "accessToken": "Bearer 토큰",
    "refreshToken": "갱신 토큰 (선택)",
    "expiresAt": 1712345678000,
    "clientId": "OAuth 클라이언트 ID",
    "clientInfo": { "client_id": "...", "registered_client_uri": "..." },
    "codeVerifier": "PKCE 검증자"
  }
}
```

### 만료 처리

- `expiresAt = Date.now() + expires_in * 1000` (밀리초)
- 프론트엔드: `Date.now() > expiresAt` → "만료됨"
- bridge: 만료된 토큰 → `connected: false`

## 데스크톱 앱 연동

### MCP 상태 조회

```
프론트엔드 → RpcAgent.getMcpStatus()
  → WebSocket: {type: "mcp_status", id}
  → bridge.ts handleMcpCommand()
  → TOKEN_FILE 읽기 + 만료 체크
  → WebSocket: {type: "mcp_status_response", servers: [...]}
```

### MCP 연결

```
프론트엔드 → RpcAgent.mcpConnect(serverKey)
  → WebSocket: {type: "mcp_connect", server}
  → bridge → RPC stdin: {type: "prompt", message: "/mcp-connect"}
  → mcp-bridge 확장이 OAuth 흐름 실행
  → 15초 후 프론트엔드가 상태 재조회
```

## 상수

| 상수 | 값 | 용도 |
|------|-----|------|
| OAuth 콜백 포트 | 9876 | OAuth redirect 수신 |
| OAuth 콜백 경로 | `/oauth/callback` | redirect path |
| OAuth 타임아웃 | 120초 | 사용자 인증 대기 |
| 도구 실행 타임아웃 | 30초 | MCP tool 호출 |
| 상태 폴링 지연 | 15초 | 연결 후 상태 확인 |

## 새 MCP 서버 추가 절차

1. `.pi/extensions/mcp-bridge/index.ts`의 `MCP_SERVERS`에 추가
2. `packages/desktop/server/bridge.ts`의 `stdioServers`(stdio인 경우) + `servers` 배열에 추가
3. `packages/desktop/src/main.ts`의 `servers` 배열에 추가
4. HTTP 서버라면 OAuth 설정 필요, stdio 서버라면 불필요
5. `npm run build`로 빌드 확인
