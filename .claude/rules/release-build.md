# 릴리즈 빌드 규약

## 빌드 순서

Tauri `beforeBuildCommand`는 desktop 패키지의 `npm run build`(Vite) + `npm run build:server`(esbuild)만 실행한다.
**coding-agent TypeScript 컴파일은 포함되지 않는다.**

`loader.ts` 등 coding-agent 소스를 수정한 경우 반드시:
```bash
cd packages/coding-agent && npx tsgo -p tsconfig.build.json
```
를 먼저 실행한 후 `npx tauri build`를 해야 `dist/`에 반영된다.

## Extension VIRTUAL_MODULES

릴리즈 CJS 번들에서는 `node_modules`가 없으므로, extension이 사용하는 모든 외부 모듈을 `loader.ts`의 `VIRTUAL_MODULES`에 등록해야 한다.

**새 extension을 추가하거나 기존 extension에 외부 import를 추가할 때:**
1. `loader.ts` 상단에 `import * as _bundledXxx from "패키지명"` 추가
2. `VIRTUAL_MODULES` 객체에 `"패키지명": _bundledXxx` 매핑 추가
3. 해당 패키지가 `packages/coding-agent/package.json`의 dependencies에 있는지 확인
4. 누락 시 릴리즈에서 `Cannot find module` 에러 발생

## tauri.conf.json 캐싱 주의

Tauri CLI는 `tauri.conf.json`을 빌드 시작 시 한 번 읽고 캐시한다. `beforeBuildCommand`의 `build-server.mjs`가 리소스 항목을 업데이트하지만, Tauri는 이미 캐시된 설정으로 번들링한다.

리소스 구조가 변경된 경우 `npm run build:server`를 먼저 실행하여 `tauri.conf.json`을 업데이트한 후 `npx tauri build`를 실행하거나, 두 번 연속 빌드해야 한다.

## .pi/ 리소스 번들링

`build-server.mjs`가 `.pi/` 에셋을 `dist-server/.pi/`에 복사하고, `tauri.conf.json`의 `bundle.resources`에 자동 등록한다.

- Tauri의 `**/*` glob은 디렉토리를 flat하게 설치하므로, `collectLeafDirs()`로 각 리프 디렉토리마다 명시적 항목을 생성
- 동일 파일명이 여러 디렉토리에 있으면 WiX ICE30 에러 발생 (NSIS도 동일)
- 새 `.pi/` 하위 디렉토리 추가 시 build-server.mjs가 자동 처리하므로 수동 등록 불필요

## HWP MCP 서버

`@hancom/hwp-cli/dist/mcp-stdio-server.mjs`를 `dist-server/hwp-mcp/`에 복사하여 번들에 포함한다.
릴리즈에서 `resolveHwpMcpServer()`는 `{cwd}/hwp-mcp/mcp-stdio-server.mjs`를 먼저 확인한다.

## 깨진 심볼릭 링크

`.pi/extensions/subagent/`는 Linux 심볼릭 링크로, Windows에서는 경로 문자열만 담긴 파일이 된다.
로더가 ParseError를 로깅하지만 앱 동작에는 영향 없다.
