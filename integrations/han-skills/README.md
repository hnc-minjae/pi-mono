# han-skills (LG ChatExaone 연동용 번들)

기획서·보고서 HWPX 자동 생성 스킬 2종을 파일 기반 번들로 제공한다.

## 구성

```
han-skills/
├── skills/
│   ├── doc-draft/SKILL.md            # 기획서 생성 스킬
│   └── doc-report/SKILL.md           # 보고서 생성 스킬
├── templates/
│   ├── 기획서.hwpx                    # 기획서 누름틀 템플릿
│   └── 보고서.hwpx                    # 보고서 누름틀 템플릿
└── README.md
```

## 설치

LG ChatExaone의 스킬 로드 경로 하위에 `han-skills/` 디렉토리 전체를 배치한다.
스킬 로더는 `skills/*/SKILL.md`를 스캔하여 slash command로 노출한다.

## 실행 환경

스킬 실행 시 cwd(현재 작업 디렉토리)를 **`han-skills/` 번들 루트**로 설정한다.
스킬 본문의 경로(`templates/`, `output/`)가 번들 루트 기준 상대경로로 resolve되어야 한다.

## 선결 조건

- `@hancom/han-mcp` 패키지가 설치되어 있고 MCP 클라이언트에 `hwp-cowriter-file` 서버로 등록되어 있어야 한다.
- 두 스킬 모두 `mcp__hwp_file__*` 도구를 호출한다.

## 포함 스킬

| 스킬 | 슬래시 명령 | 기능 | 출력 경로 |
|------|-------------|------|-----------|
| `doc-draft` | `/doc-draft [주제]` | 기획서 HWPX 자동 생성 | `output/기획서_{topic}.hwpx` |
| `doc-report` | `/doc-report [핵심 내용]` | 보고서 HWPX 자동 생성 | `output/보고서_{coreContents}.hwpx` |

## 템플릿

`templates/기획서.hwpx`, `templates/보고서.hwpx` 두 파일은 **누름틀만 정의된 빈 템플릿**이다.
스킬이 실행되면 템플릿을 열어 누름틀에 AI 생성 내용을 채우고 `output/`에 결과물을 저장한다.
