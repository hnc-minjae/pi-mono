---
globs: "packages/desktop/src-tauri/**/*.json"
---

# Tauri 설정 파일 규약

## capabilities/default.json
- 새 기능 추가 시 필요한 permission을 여기에 등록
- `<plugin>:default`로 기본 권한 부여 후 개별 `allow-*`로 세분화
- scope가 필요한 플러그인 (fs, http)은 allow/deny 범위 명시

```json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:default",
    "fs:allow-read",
    {
      "identifier": "http:default",
      "allow": [{ "url": "https://api.example.com/**" }]
    }
  ]
}
```

## tauri.conf.json
- `identifier`: 역도메인 형식 (변경 시 기존 설치 영향)
- `build.devUrl`: 프론트엔드 dev 서버 URL
- `bundle.resources`: 추가 파일 번들링
- `bundle.externalBin`: 사이드카 바이너리 경로
- 플랫폼별 오버라이드: `tauri.linux.conf.json` 등 별도 파일

## 보안 원칙
- deny는 항상 allow보다 우선
- 최소 권한 원칙 — 필요한 권한만 부여
- fs scope에 `$APPDATA/**` 등 경로 변수 사용