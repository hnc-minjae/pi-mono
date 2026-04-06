---
globs: "packages/desktop/src/**/*.ts"
---

# Desktop 프론트엔드 규약

## 기술 스택
- Lit (mini-lit) + Vite + Tailwind CSS v4
- `@tauri-apps/api` — JS↔Rust 통신
- `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs` — 네이티브 기능
- `pi-web-ui`, `pi-ai` — 내부 공유 패키지 의존

## Tauri API 사용 패턴

```typescript
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open, save } from '@tauri-apps/plugin-dialog';

// Rust 커맨드 호출 — 인자는 camelCase 객체
const result = await invoke('read_file_text', { path: filePath });

// 이벤트 수신
const unlisten = await listen('event-name', (event) => { /* ... */ });
```

## 주의사항
- Tauri 커맨드 호출 시 인자명은 **camelCase** (Rust 쪽 snake_case와 자동 매핑)
- `invoke`는 Promise 반환 — 에러는 `.catch()` 또는 try/catch로 처리
- 파일 경로는 Tauri path API 또는 dialog로 획득 — 하드코딩 금지
- 새 Rust 커맨드 추가 시 `src-tauri/src/lib.rs`의 `generate_handler!`에도 등록 필요