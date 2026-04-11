# Context Brief: `/review` and `/ultrareview` commands

## Goal
`pi-engineering-discipline-extension`에 `/review`(단일 패스)와 `/ultrareview`(병렬 다중 에이전트 + 검증 + 통합) 슬래시 커맨드를 추가해, 코드 변경분을 품질/버그/보안/성능/테스트/일관성 관점에서 리뷰한다.

## Scope

**In scope:**
- `pi.registerCommand("review", …)`, `pi.registerCommand("ultrareview", …)` 2개 등록
- 신규 코드 리뷰어 에이전트 5종: `reviewer-bug`, `reviewer-security`, `reviewer-performance`, `reviewer-test-coverage`, `reviewer-consistency`
- 신규 검증 에이전트 1종: `reviewer-verifier`
- 신규 통합 에이전트 1종: `review-synthesis` (기존 `synthesis` 패턴 차용)
- 대상 자동 감지: 인자 없으면 현재 브랜치 컨텍스트로 PR/로컬 diff 자동 판별. 인자로 PR 번호 또는 브랜치명 명시 가능.
- `/ultrareview` 결과를 `docs/engineering-discipline/reviews/YYYY-MM-DD-<topic>-review.md`에 저장
- `MAX_CONCURRENCY`와 `MAX_PARALLEL_TASKS` 상향 (10개 서브에이전트 한 wave 처리)

**Out of scope:**
- 클라우드 teleport / bughunter 서버 통합 (명시적 제외, 로컬 실행만)
- 기존 5개 플랜 리뷰어(`reviewer-feasibility` 등) 재사용 또는 변경
- `/security-review` 같은 별도 전문 커맨드 분리
- PR 자동 생성/머지 등 후속 액션
- `discipline.ts`의 `DISCIPLINE_AGENTS` 리스트 변경 (ai-slop-cleaner 연쇄 호출 방지를 위해 **절대 건드리지 않음**)

## Technical Context

**커맨드 등록 패턴** (`extensions/agentic-harness/index.ts:690-738` 참조):
- `registerCommand(name, {description, handler})` — 핸들러는 반환값 없이 `pi.sendUserMessage(prompt)`로 에이전트에 프롬프트 주입
- UI 피드백: `ctx.ui.setStatus()`, `ctx.ui.notify()`, `ctx.ui.confirm()`
- 기존 `/plan`, `/ultraplan` 핸들러를 그대로 따라감
- 삽입 위치: `index.ts:739` (`/ultraplan` 닫힌 직후)

**서브에이전트 병렬 실행**:
- `subagent.ts:14-15`에 `MAX_PARALLEL_TASKS = 8`, `MAX_CONCURRENCY = 4` 상수
- parallel 모드 입력: `{tasks: [{agent, task, cwd?}]}`
- 본 작업에서 상향 필요: 10개 동시 실행을 위해 12/10으로 조정

**에이전트 정의**:
- 경로: `extensions/agentic-harness/agents/reviewer-*.md`, `review-synthesis.md`, `reviewer-verifier.md`
- Frontmatter: `tools: read,find,grep` (read-only 고정), 분석적 description
- **`plan-worker`/`worker` 네이밍 절대 금지** — `DISCIPLINE_AGENTS`에 추가되지 않도록 격리해 `ai-slop-cleaner` 자동 발화 경로 차단

**기존 자산**:
- `extensions/autonomous-dev/github.ts`의 `detectRepo()` 등 `gh` CLI 래퍼 재사용 가능
- `synthesis.md` 템플릿 치환 패턴(`{FEASIBILITY_OUTPUT}` 등) 차용

**claude-code 레퍼런스**:
- `security-review.ts`의 rubric (HIGH/MED/LOW severity, 0.7–1.0 confidence, 명시적 false-positive 제외 목록, 고정 마크다운 포맷) — 5개 리뷰어 에이전트의 출력 포맷 기반으로 차용
- bughunter의 3단계 파이프라인 (finding → verifying → synthesizing) — `/ultrareview` 구조의 원형
- bughunter 기본 설정 (fleet_size=5, agent_timeout=600s, max_duration=10min) — 로컬 타임아웃 설정 참고값

## Execution Model

**`/review` — 단일 패스:**
```
handler(args, ctx)
  → pi.sendUserMessage("You are an expert code reviewer. [rubric 요약]
                         Review the diff at [auto-detected target].")
  → 현재 에이전트가 직접 diff 읽고 리뷰, 채팅 스트림에 출력, 파일 저장 없음
```

**`/ultrareview` — 3단계:**
```
handler(args, ctx)
  → pi.sendUserMessage(
      "Stage 1 (finding): Dispatch 5 reviewers × 2 seeds = 10 subagents in parallel:
        reviewer-bug, reviewer-security, reviewer-performance,
        reviewer-test-coverage, reviewer-consistency
       Stage 2 (verification): Dispatch reviewer-verifier on aggregated findings
       Stage 3 (synthesis): Dispatch review-synthesis to produce final report
       Save to docs/engineering-discipline/reviews/YYYY-MM-DD-<topic>-review.md
       Stream summary to chat.")
```

## Constraints

- **ai-slop-cleaner 격리**: 모든 신규 에이전트는 read-only, analytical, 이름에 `worker` 포함 금지. `discipline.ts` 수정 금지.
- **동시성**: 10 서브에이전트를 한 wave로 처리하려면 `MAX_PARALLEL_TASKS` 및 `MAX_CONCURRENCY` 상향 필요.
- **인자 파싱**: PR 번호(숫자) / 브랜치명(문자열) 자동 구분. 없으면 `git rev-parse --abbrev-ref HEAD`로 현재 브랜치, `gh pr list --head <branch>`로 PR 존재 여부 확인.
- **레퍼런스 참조**: claude-code의 `security-review.ts` rubric과 bughunter 파이프라인을 적극 참고할 것.

## Success Criteria

1. `/review` 실행 시 현재 변경사항에 대한 통합 코드 리뷰가 채팅에 스트리밍됨
2. `/ultrareview` 실행 시:
   - 10개 서브에이전트가 병렬 실행되고 진행 단계가 보임 (finding → verifying → synthesizing)
   - `docs/engineering-discipline/reviews/` 하위에 날짜+토픽 기반 파일이 생성됨
   - 파일에 severity/confidence 태그가 포함된 findings가 구조화돼 있음
   - synthesis 결과가 채팅에도 요약 형태로 노출됨
3. `/ultrareview`나 `/review` 실행 후 `ai-slop-cleaner`가 자동 발화되지 않음
4. 빈 diff일 경우 명시적 "리뷰할 변경 없음" 메시지로 조기 종료
5. `cd extensions/agentic-harness && npm run build`가 에러 없이 통과
6. `cd extensions/agentic-harness && npx vitest run`가 모든 기존 테스트 + 신규 테스트 통과

## Assumptions (Open Questions에서 잠정 확정)

1. **`/review`의 rubric 수준**: 5-카테고리를 프롬프트에 언급하되 자유 서술 허용 (경량).
2. **`<topic>` 네이밍 규칙**: PR 모드 → `pr-<number>`, 브랜치 모드 → sanitized branch name.
3. **`MAX_CONCURRENCY` 최종 값**: 10 (한 wave 처리), `MAX_PARALLEL_TASKS`: 12.
4. **Verifier 입력 포맷**: reviewer 5종의 출력을 role별로 묶어 하나의 메시지로 결합 후 verifier에 전달. verifier는 dedup + false-positive 필터링 + severity/confidence 부여.
5. **`review-synthesis` 템플릿 슬롯**: `{BUG_OUTPUT}`, `{SECURITY_OUTPUT}`, `{PERFORMANCE_OUTPUT}`, `{TEST_COVERAGE_OUTPUT}`, `{CONSISTENCY_OUTPUT}`, `{VERIFIED_FINDINGS}`.
6. **`/ultrareview` 타임아웃**: 별도 타임아웃 설정 없이 서브에이전트 기본값에 위임.

## Complexity Assessment

| Signal | Score | Notes |
|---|---|---|
| Scope breadth | 2 | 2 커맨드 + 7 에이전트, 같은 extension 내부 |
| File impact | 2 | ~10 파일 (index.ts 수정, subagent.ts 수정, 7 신규 .md, 1 테스트) |
| Interface boundaries | 1 | 기존 `registerCommand`/`subagent` 인터페이스 내부에서 작동 |
| Dependency depth | 2 | finding → verification → synthesis 선형 체인 |
| Risk surface | 2 | ai-slop-cleaner 연쇄 호출 리스크(격리 필요), 전역 concurrency 상향 영향 |

**Score: 9** — Borderline
**Verdict**: `plan-crafting` 추천 (borderline이나 단일 plan 사이클로 충분)

## Suggested Next Step

`plan-crafting` 스킬로 진행 — 단일 plan 사이클. Task 분해 시 Assumptions를 명시하고 reviewer 에이전트들은 병렬 create 가능하도록 설계.
