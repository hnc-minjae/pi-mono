# @hancom/han-mcp

HWP 파일 기반 MCP 서버 래퍼. LG ChatExaone 에이전트 연동용.

HWP 파일 MCP 서버의 빌드 산출물(`vendor/mcp-stdio-server.mjs`)을 **패키지 내부에 자체 포함**하므로 외부 npm 레지스트리나 한컴 GitLab 토큰 없이 설치·실행 가능하다.

## 설치

```bash
npm install -g @hancom/han-mcp
```

외부 의존성 없음. 설치와 동시에 `vendor/` 내 MCP 서버 번들이 함께 배포된다.

## 사용

글로벌 설치 후 `han-mcp-hwp-file` 명령이 PATH에 노출된다. MCP 클라이언트 설정 파일에서 `command`로 등록한다.

**mcp.json 예시**

```json
{
  "mcpServers": {
    "hwp-cowriter-file": {
      "command": "han-mcp-hwp-file"
    }
  }
}
```

`stdio` transport로 MCP handshake 완료 후 HWP 파일 조작 도구 32종이 노출된다.

## 요구 사항

- Node.js 20.0.0 이상
- `winax` **불필요** — 파일 기반 조작만 지원
- 한컴 GitLab 접근 권한 **불필요** — 번들 자체 포함

## 포함 범위

- HWP 파일 기반 문서 조작 (`cowriter:file` 서비스)
- 32개 HWP 문서 조작 도구 (`hwp_file_open_document`, `hwp_file_save_document`, `hwp_file_fill_click_field` 등)

## 제외 범위

- HWP COM 자동화 모드 (`cowriter:auto` — Windows `winax` 의존)
- Atlassian MCP, OAuth, 토큰 저장소

## 내부 구조

```
@hancom/han-mcp/
├── package.json
├── bin/han-mcp-hwp-file.mjs       # PATH 진입점
├── src/resolve-hwp-cli.mjs         # vendor 경로 해석
├── vendor/
│   └── mcp-stdio-server.mjs        # HWP MCP 서버 번들 (1.66MB, 자체 포함)
└── README.md
```

`bin/han-mcp-hwp-file.mjs`는 `vendor/mcp-stdio-server.mjs`를 `--service cowriter:file` 인자로 `node` 서브프로세스 실행하고 stdio를 pass-through한다.
