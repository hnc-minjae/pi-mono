# Tauri v2 아키텍처 & 핵심 개념

> 출처: https://v2.tauri.app/concept/

## 목차
1. [아키텍처 개요](#아키텍처-개요)
2. [프로세스 모델](#프로세스-모델)
3. [IPC (Inter-Process Communication)](#ipc)
4. [핵심 크레이트](#핵심-크레이트)
5. [업스트림 라이브러리](#업스트림-라이브러리)

---

## 아키텍처 개요

Tauri는 Rust 백엔드 + OS WebView 프론트엔드 구성의 멀티프로세스 데스크톱/모바일 앱 툴킷이다.

- Electron과 달리 Chromium을 번들하지 않고 OS 네이티브 WebView를 사용 → 바이너리 크기 최소화
- WebView는 동적 링크 (번들 X) → 앱 크기 작지만 플랫폼별 차이 존재
- VM이나 가상화 환경이 아닌, WRY/TAO를 통한 직접 OS 시스템 콜

**플랫폼별 WebView:**
| 플랫폼 | WebView |
|--------|---------|
| Windows | Microsoft Edge WebView2 |
| macOS | WKWebView |
| Linux | webkitgtk |

## 프로세스 모델

Tauri는 **Core Process**와 **WebView Process** 2개의 프로세스로 구성된다.

### Core Process (Rust)
- 앱의 단일 진입점, 전체 OS 접근 권한 보유
- 윈도우 생성/관리, 시스템 트레이, 알림
- **모든 IPC를 중앙 체크포인트에서 라우팅** → 보안 필터링
- 전역 상태 관리 (설정, DB 연결, 비즈니스 로직)
- 멀티 윈도우 간 상태 동기화

### WebView Process (HTML/CSS/JS)
- UI 렌더링만 담당, OS 레벨 접근 불가
- HTML/CSS/JavaScript 실행 (브라우저 환경)
- 프론트엔드 프레임워크 사용 가능 (React, Vue, Svelte 등)
- 사용자 입력은 반드시 sanitize, 시크릿은 프론트엔드에 두지 않음

### 보안 모델
1. **관심사 분리** — UI 로직과 시스템 접근 격리
2. **중앙 IPC 필터링** — Core가 모든 프로세스간 메시지를 검증
3. **프론트엔드 제한** — 최소 권한 원칙 적용
4. **최소 공격 표면** — 프로세스별 최소 권한

## IPC

Tauri는 **비동기 메시지 패싱**으로 IPC를 구현한다. 격리된 프로세스가 직렬화된 요청/응답을 교환하며, 수신자는 악의적 요청을 거부할 수 있다.

### 두 가지 IPC 원시 타입

**Events (이벤트):**
- Fire-and-forget, 단방향 메시지
- 라이프사이클 이벤트, 상태 변경에 적합
- 프론트엔드와 Core 양쪽에서 발신 가능 (양방향)

**Commands (커맨드):**
- FFI와 유사한 추상화, 내부적으로는 IPC 메시지
- `invoke` API로 JS에서 Rust 함수 호출
- 인자/반환값은 반드시 JSON 직렬화 가능해야 함 (JSON-RPC 유사 프로토콜)
- 실제 FFI가 아닌 메시지 패싱이므로 메모리 공유 취약점 없음

### IPC 패턴
- **Brownfield** — 기존 시스템과 통합
- **Isolation** — 보안 프로세스 분리 (iframe sandboxing)

## 핵심 크레이트

| 크레이트 | 역할 |
|---------|------|
| `tauri` | 중심 크레이트. 런타임, 매크로, 유틸리티, API 통합. `tauri.conf.json` 컴파일 타임 파싱 |
| `tauri-runtime` | Tauri와 하위 WebView 라이브러리 간 추상화 레이어 |
| `tauri-macros` | `tauri-codegen`을 통한 context, handler, command 매크로 생성 |
| `tauri-utils` | 설정 파싱, 플랫폼 감지, CSP 삽입, 에셋 관리 유틸리티 |
| `tauri-build` | 빌드 타임 cargo 매크로 적용 |
| `tauri-codegen` | 컴파일 타임 에셋 임베딩, 해싱, 압축. Config 구조체 생성 |
| `tauri-runtime-wry` | WRY 기반 시스템 레벨 상호작용 (프린팅, 모니터 감지) |

## 업스트림 라이브러리

**TAO**: 크로스 플랫폼 윈도우 생성 라이브러리. winit의 Rust 포크로 메뉴 바, 시스템 트레이 기능 확장. Windows/macOS/Linux/iOS/Android 지원.

**WRY**: 크로스 플랫폼 WebView 렌더링 라이브러리. 플랫폼별 WebView 구현체를 추상화.
