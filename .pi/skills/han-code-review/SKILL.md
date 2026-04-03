---
name: han-code-review
description: 커밋 전 코드 리뷰 게이트. 로컬 변경사항(git diff)을 분석하여 로직 오류, 보안, 성능, 엣지 케이스를 점검한다. han-code Step 7(커밋) 직전에 자동 호출된다.
user_invocable: false
argument: "(없음) — han-code 파이프라인 내부에서 자동 호출"
---

# 커밋 전 코드 리뷰 게이트

han-code 파이프라인에서 커밋 직전에 호출되어 변경사항을 종합 리뷰한다.
문제가 발견되면 커밋을 차단하고 수정을 요청한다.

---

## Step 0: 변경사항 수집

```bash
git diff --cached
git diff
```

- staged + unstaged 변경 모두 리뷰 대상
- 변경사항이 없으면 → "리뷰할 변경사항이 없습니다." 출력 후 `REVIEW_STATUS=pass` 반환

---

## Step 1: han-reviewer 에이전트 위임

`han-reviewer` 에이전트를 spawn하여 변경사항 리뷰를 위임한다.

에이전트에 전달할 컨텍스트:
- 변경된 파일 목록 (`git diff --name-only` + `git diff --cached --name-only`)
- 이슈 정보 (han-code에서 전달받은 `ISSUE_KEY`, `ISSUE_SUMMARY`)
- 구현 계획 (han-code Step 4b에서 승인된 계획이 있다면)

han-reviewer는 Read-only로 코드를 분석하여 심각도별 리뷰 결과를 반환한다.

---

## Step 2: 리뷰 결과 판정

han-reviewer 반환 결과의 심각도별 건수에 따라 판정:

| 판정 | 조건 | 동작 |
|------|------|------|
| **차단** | Critical 1건 이상 | 커밋 차단, 수정 요청 |
| **경고 후 진행** | Major만 있음 (Critical 없음) | 경고 표시, 사용자에게 진행 여부 확인 |
| **통과** | Minor/Nit만 있거나 문제 없음 | 커밋 진행 |

### 차단 시

```
코드 리뷰 결과: 커밋 차단
  Critical: {N}건 — 수정 필수
  {han-reviewer 리뷰 결과 요약}

수정 후 다시 진행하세요.
```

`REVIEW_STATUS=blocked` 반환 → han-code가 커밋을 진행하지 않는다.

### 경고 후 진행 시

```
코드 리뷰 결과: Major 이슈 발견
  Major: {N}건
  {han-reviewer 리뷰 결과 요약}

이대로 커밋하시겠습니까?
[Y/n]:
```

- Y → `REVIEW_STATUS=pass` 반환
- N → `REVIEW_STATUS=blocked` 반환

### 통과 시

```
코드 리뷰 통과 (Minor {N}건, Nit {M}건)
```

`REVIEW_STATUS=pass` 반환

---

## 반환값

| 변수 | 값 | 용도 |
|------|-----|------|
| `REVIEW_STATUS` | `pass` / `blocked` | han-code Step 7 진행 여부 결정 |
