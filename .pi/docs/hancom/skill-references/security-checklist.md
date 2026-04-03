# 보안 체크리스트 참조

> 이 파일은 스킬이 아닌 참조 문서입니다.
> han-security에서 보안 검토 위임 시 참조합니다.
> PROJECT_TYPE에 맞는 섹션을 Read로 읽어 security-reviewer 에이전트에 전달합니다.

---

## OWASP Top 10 체크 항목

```
1. A01 - 접근 제어 취약점 (Broken Access Control)
2. A02 - 암호화 실패 (Cryptographic Failures)
3. A03 - 인젝션 (Injection): SQL, OS, LDAP, XPath
4. A04 - 안전하지 않은 설계 (Insecure Design)
5. A05 - 보안 설정 오류 (Security Misconfiguration)
6. A06 - 취약하고 오래된 컴포넌트 (Vulnerable Components)
7. A07 - 인증 및 식별 실패 (Identification/Authentication Failures)
8. A08 - 소프트웨어 및 데이터 무결성 실패 (Software/Data Integrity Failures)
9. A09 - 보안 로깅 및 모니터링 실패 (Security Logging/Monitoring Failures)
10. A10 - 서버 사이드 요청 위조 (SSRF)
```

---

## 심각도 분류 기준

| 심각도 | 정의 | han-close 영향 |
|--------|------|---------------|
| Critical | 즉시 악용 가능, 데이터 유출/시스템 장악 직결 | **차단** |
| High | 악용 가능성 높음, 인증 우회/권한 상승 | **차단** |
| Medium | 조건부 악용 가능, 정보 노출/서비스 영향 | 경고 (차단 없음) |
| Low | 잠재적 위험, 모범 사례 위반 | 정보 출력 (차단 없음) |

---

## 제품 타입별 특화 위험 목록

### cpp-office (한글/한컴오피스 C++/C#)

```
- 버퍼 오버플로우: 고정 크기 배열, strcpy/sprintf 사용 여부
- 정수 오버플로우: 파일 크기/인덱스 계산 시 오버플로우 가능성
- Use-After-Free: 동적 할당 해제 후 포인터 재사용
- 포맷 스트링 취약점: printf 계열 함수의 사용자 입력 직접 전달
- 파일 경로 조작: 상대 경로, Path Traversal (../../) 가능성
- 악성 문서 파싱: HWP/HWPX 파일 파서의 입력 검증 미흡
- 임시 파일 경쟁 조건: TOCTOU (Time-of-Check-Time-of-Use)
- DLL 하이재킹: 상대 경로 DLL 로드
```

### dataloader (데이터로더 Python/JS/TS)

```
- SQL Injection: 동적 쿼리 생성 시 파라미터 바인딩 미사용
- Path Traversal: 파일 경로에 사용자 입력 직접 포함
- XSS: 사용자 입력을 HTML에 비이스케이프 출력
- API 인증 누락: 엔드포인트별 인증/인가 체크 부재
- 민감 데이터 노출: 로그, 에러 메시지에 API 키/비밀번호 포함
- SSRF: 외부 URL 페치 시 내부 네트워크 접근 가능성
- 안전하지 않은 역직렬화: pickle, eval, exec 사용
- 하드코딩된 시크릿: 소스 코드 내 API 키, 토큰, 비밀번호
```

### ai-assistant (한컴어시스턴트/피디아)

```
- 프롬프트 인젝션: 사용자 입력이 LLM 시스템 프롬프트를 변조 가능한지 여부
- LLM API 키 노출: 환경변수 미사용, 코드 내 하드코딩
- 에이전트 권한 과잉: 에이전트가 필요 이상의 파일시스템/네트워크 권한 보유
- 출력 검증 미흡: LLM 응답을 검증 없이 실행 (코드 실행, 명령어 수행)
- 컨텍스트 오염: 사용자 간 대화 컨텍스트 격리 미흡
- 모델 응답 로깅: 민감 정보가 포함된 대화 내용 무단 저장
- 레이트 리밋 미적용: API 남용으로 인한 비용 폭증 방지 장치 부재
- 안전하지 않은 역직렬화: LLM 응답의 JSON/도구 호출 파싱 취약점
```

### mixed (복합 타입)

해당 파일 확장자에 맞는 위 섹션을 모두 적용한다.
