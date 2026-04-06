---
globs: "packages/*/src/**/*.ts"
---

# TypeScript 코딩 규약

## 포맷팅 (Biome)
- 인덴트: **tab**, 폭 3
- 라인 폭: 120자
- 변경 후 `npm run check` 통과 필수 (biome check + tsgo --noEmit)

## 타입
- `any` 사용 금지 (불가피한 경우만 허용)
- 외부 API 타입은 추측하지 말고 `node_modules`에서 확인
- 타입 에러를 코드 다운그레이드로 해결하지 말 것 — 의존성을 업그레이드

## Import
- **인라인 import 절대 금지** — `await import("./foo.js")`, `import("pkg").Type` 사용 불가
- 반드시 파일 상단에 표준 `import` 문 사용
- ESM 모듈 (`"type": "module"`) — 상대 경로에 `.js` 확장자 포함

## 모듈 시스템
- target: ES2022, module: Node16
- `strict: true` — 모든 strict 옵션 활성화
- `experimentalDecorators: true`, `useDefineForClassFields: false`

## 일반
- `useConst` 필수 — 재할당 없으면 `const` 사용
- 키바인딩을 하드코딩하지 말 것 — `DEFAULT_EDITOR_KEYBINDINGS` 또는 `DEFAULT_APP_KEYBINDINGS`에 추가
- 의도적으로 보이는 코드는 삭제 전 반드시 확인
- 하위 호환성 유지하지 않음 (명시적 요청 없는 한)