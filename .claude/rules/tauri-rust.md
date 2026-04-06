---
globs: "packages/desktop/src-tauri/**/*.rs"
---

# Tauri Rust 코딩 규약

## 프로젝트 구조
- 진입점: `src/lib.rs` (커맨드 등록, 플러그인 초기화)
- 커맨드가 늘어나면 `src/commands.rs` 모듈로 분리
- Edition 2021, Tauri v2, serde/serde_json 사용

## 커맨드 정의
- `#[tauri::command]` 어트리뷰트 사용
- 커맨드 이름은 고유해야 함
- 에러는 `Result<T, String>` 또는 커스텀 에러 타입 (`thiserror` + `Serialize`) 반환
- `lib.rs`에서 `generate_handler!`에 등록

```rust
#[tauri::command]
fn my_command(param: String) -> Result<String, String> {
    // ...
}

// lib.rs
.invoke_handler(tauri::generate_handler![my_command])
```

## 상태 관리
- 변경 가능 상태는 `Mutex`로 감싸기 (Arc 불필요 — Tauri 내부 처리)
- `State<'_, Mutex<T>>` 타입 정확히 매칭 (불일치 시 런타임 패닉)

## 플러그인
- 현재 사용 중: `tauri-plugin-dialog`, `tauri-plugin-fs`, `tauri-plugin-shell`
- 추가 시 `Cargo.toml` + `lib.rs` `.plugin()` + `capabilities/default.json` 모두 업데이트
- 자동 설치: `npm run tauri add <plugin>` (패키지 디렉토리에서 실행)

## 참조
- Tauri 레퍼런스 스킬: `.claude/skills/tauri-reference/`
- Rust API: https://docs.rs/tauri/~2/