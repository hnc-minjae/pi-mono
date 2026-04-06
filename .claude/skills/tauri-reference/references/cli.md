# Tauri v2 CLI 레퍼런스

> 출처: https://v2.tauri.app/reference/cli/

## 목차
1. [핵심 명령어](#핵심-명령어)
2. [모바일 명령어](#모바일-명령어)
3. [플러그인 관리](#플러그인-관리)
4. [보안 & 서명](#보안--서명)
5. [유틸리티](#유틸리티)
6. [공통 플래그](#공통-플래그)

---

## 핵심 명령어

### `tauri init`
기존 디렉토리에 Tauri 프로젝트 초기화. 앱 이름, 윈도우 제목, 프론트엔드 dist 경로, 개발 URL 설정.

### `tauri dev`
개발 모드 실행. Rust 코드 핫 리로딩 지원.
- `build.devUrl` 사용
- `build.beforeDevCommand` 실행
```bash
npm run tauri dev
npm run tauri dev -- --port 3001        # 프론트엔드 포트 지정
npm run tauri dev -- --target aarch64   # 타겟 지정
```

### `tauri build`
릴리스 모드 빌드 + 번들/인스톨러 생성.
- `build.beforeBuildCommand` → `build.beforeBundleCommand` 순서 실행
```bash
npm run tauri build
npm run tauri build -- --target x86_64-unknown-linux-gnu
npm run tauri build -- --config src-tauri/tauri.prod.conf.json
npm run tauri build -- --debug   # 디버그 빌드
```

### `tauri bundle`
이미 빌드된 앱의 번들/인스톨러만 생성.
- `build.beforeBundleCommand` 실행

## 모바일 명령어

### Android
```bash
tauri android init              # Android 타겟 초기화
tauri android dev               # 개발 모드 (핫 리로딩)
tauri android build             # 릴리스 빌드 (APK/AAB)
tauri android run               # 프로덕션 모드 실행
```

### iOS
```bash
tauri ios init                  # iOS 타겟 초기화
tauri ios dev                   # 개발 모드
tauri ios build                 # 릴리스 빌드 (IPA)
tauri ios run                   # 프로덕션 모드 실행
```

## 플러그인 관리

```bash
tauri add <plugin>              # 플러그인 추가 (Cargo + npm 자동)
tauri remove <plugin>           # 플러그인 제거

tauri plugin new <name>         # 새 플러그인 프로젝트 생성
tauri plugin init               # 기존 디렉토리에 플러그인 초기화
tauri plugin android init       # 플러그인 Android 프로젝트 초기화
tauri plugin ios init           # 플러그인 iOS 프로젝트 초기화
```

## 보안 & 서명

```bash
# 서명 키 생성/관리
tauri signer generate -w ~/.tauri/myapp.key
tauri signer sign <file>

# 권한 관리
tauri permission new             # 새 permission 파일 생성
tauri permission add             # capability에 permission 추가
tauri permission rm              # permission 파일 및 참조 삭제
tauri permission ls              # 사용 가능한 앱 permission 나열

# capability 관리
tauri capability new             # 새 capability 파일 생성

# Windows 관련
tauri inspect wix-upgrade-code   # MSI 인스톨러 기본 Upgrade Code 출력
```

## 유틸리티

```bash
tauri info                      # 환경 정보 (Rust, Node.js, 프로젝트 설정)
tauri icon <source>             # 모든 플랫폼용 아이콘 생성
tauri completions <shell>       # 셸 자동완성 생성 (bash, zsh, powershell, fish)
tauri migrate                   # v1 → v2 마이그레이션
```

## 공통 플래그

| 플래그 | 설명 |
|--------|------|
| `-v, --verbose` | 상세 로깅 활성화 |
| `-c, --config <path\|json>` | JSON/TOML 설정 병합 (JSON Merge Patch) |
| `-f, --features <features>` | Cargo feature 활성화 |
| `-t, --target <triple>` | 컴파일 타겟 트리플 지정 |
| `-d, --debug` | 디버그 모드 빌드 |
| `--ci` | CI 환경 (값 입력 프롬프트 건너뜀) |

### 설정 병합 예시
```bash
# 파일로 병합
cargo tauri build --config src-tauri/tauri.beta.conf.json

# 인라인 JSON으로 병합
cargo tauri build --config '{"identifier":"com.example.beta","productName":"MyApp Beta"}'
```
