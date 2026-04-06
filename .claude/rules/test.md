---
globs: "packages/*/test/**/*.ts"
---

# 테스트 규약

## 실행
- 테스트는 **패키지 루트**에서 실행 (레포 루트 아님)
- 특정 테스트만 실행:
  ```bash
  npx tsx ../../node_modules/vitest/dist/cli.js --run test/specific.test.ts
  ```
- `npm test`, `npm run build` 실행 금지

## 작성 규칙
- 테스트 파일을 생성/수정하면 반드시 해당 테스트를 실행하고 통과할 때까지 반복
- 테스트 실행 → 문제 식별 (테스트 or 구현) → 수정 → 재실행 사이클
- 외부 API 타입은 `node_modules`에서 확인하여 정확한 타입 사용