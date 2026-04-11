# Context Brief: subagent에서 ask_user_question 도구 차단

## Goal
subagent 프로세스(currentDepth > 0)에서 `ask_user_question` 도구 자체가 등록되지 않도록 하여, subagent가 자기 자신에게 질문/답변하는 루프를 원천 차단한다.

## Scope
- **In scope**:
  - `extensions/agentic-harness/index.ts:68` — `pi.registerTool({ name: "ask_user_question", ... })` 호출을 `depthConfig.currentDepth === 0` 조건으로 감싼다 (기존 `subagent` 도구의 `canDelegate` 가드와 동일한 패턴).
  - `extensions/agentic-harness/tests/extension.test.ts` — 환경변수 없이 실행되는 기존 테스트는 그대로 통과해야 한다. subagent 컨텍스트(`PI_SUBAGENT_DEPTH=1`)에서 `ask_user_question`이 **등록되지 않음**을 검증하는 신규 테스트 케이스를 추가한다.
- **Out of scope**:
  - `subagent`, `webfetch` 도구는 현상 유지.
  - agent 정의(`agents/*`)의 tools 화이트리스트 수정 불필요 (등록 자체가 안 되므로 불필요).
  - `/ask` 슬래시 커맨드는 루트 세션 전용이므로 변경 없음.
  - 런타임 시점 에러 반환 방식은 선택하지 않음.

## Technical Context
- `resolveDepthConfig()`는 `PI_SUBAGENT_DEPTH` 환경변수를 읽어 `currentDepth`를 결정한다. 루트 세션에서는 0, spawn된 subagent에서는 1+ (`subagent.ts:39-58`).
- 동일 패턴이 이미 `index.ts:152`의 `if (depthConfig.canDelegate)` 가드에 존재 — `subagent` 도구를 깊이가 허용될 때만 등록.
- `depthConfig`는 `index.ts:121`에서 extension 초기화 시점에 한 번 resolve된다. `ask_user_question` 등록 블록(라인 68) 보다 뒤에 있으므로 등록 이전으로 이동시키거나, 등록 블록을 `depthConfig` 뒤로 이동시켜야 한다.
- subagent 프로세스는 `pi -p --no-session ...`으로 spawn되며 동일 extension을 로드한다. 같은 `index.ts` 코드 경로를 타므로 등록 자체를 조건부로 막으면 subagent의 도구 목록에서 자연히 빠진다.

## Constraints
- 기존 테스트(`"should register ask_user_question tool"` 등)를 깨지 않아야 한다 — depth 0 경로에서는 동작 불변.
- `depthConfig` resolve 시점은 extension 함수 초기에 한 번만 호출.

## Success Criteria
1. 루트 세션(`PI_SUBAGENT_DEPTH` unset): `ask_user_question` 정상 등록·호출 가능.
2. subagent 컨텍스트(`PI_SUBAGENT_DEPTH=1` 또는 그 이상): `ask_user_question`이 도구 목록에 존재하지 않음 — 모델 컨텍스트에도 노출되지 않음.
3. 기존 `extension.test.ts` 모든 케이스 통과.
4. 신규 테스트: subagent 컨텍스트에서 `tools.get("ask_user_question")`이 `undefined`임을 검증.

## Complexity Assessment

| Signal | Score | Note |
|---|---|---|
| Scope breadth | 1 | 단일 조건 가드 추가 |
| File impact | 1 | 2개 파일 (`index.ts`, `extension.test.ts`) |
| Interface boundaries | 1 | 기존 `canDelegate` 패턴 재사용, 신규 인터페이스 없음 |
| Dependency depth | 1 | 순서 의존 없음 |
| Risk surface | 1 | 외부 시스템/스키마/호환성 영향 없음 |

**Score:** 5
**Verdict:** Simple
**Rationale:** 기존의 동일 패턴(`canDelegate` 가드)을 한 군데 더 적용하는 대칭 변경으로, 영향 범위가 단일 파일의 한 블록에 국한된다.

## Suggested Next Step
`plan-crafting` 건너뛰고 바로 구현으로 진행.
