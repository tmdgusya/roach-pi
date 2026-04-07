# Deep Research Feature

## Idea Core
사용자가 검색 키워드만 입력하면, 여러 subagent들이 각자의 browser session에서 독립적으로 웹을 탐색하여 정보를 수집하고, 결과를 임시 문서로 저장한 뒤 main agent가 최종 취합하는 분산형 웹 리서치 시스템.

## Relationship Map
- **검색 키워드** → 입력 → **Main Agent**
- **초기 검색 결과** → 분배 → **Subagent Pool (동적 크기)**
- **Subagent 탐색 결과** → 저장 → **임시 문서群 (doc1.md, doc2.md, ...)**
- **임시 문서 취합** → 처리 → **최종 연구 보고서**

## Key Insights
1. **완전 분산 아키텍처**: 각 subagent는 독립적인 browser session으로 동작, 서로 간의 통신 없음 → 확장성 용이
2. **파일 기반 Handoff**: Subagent들은 발견한 정보를 임시 markdown 문서로 저장, main agent가 나중에 취합 → 복구 가능, 디버깅 용이
3. **선택적 인증 세션**: 사용자가 직접 인증이 필요한 사이트(X, Reddit, LinkedIn 등)에 대한 로그인 세션을 제공할 수 있음 → 특정 소스만 접근 가능
4. **동적 병렬 처리**: 초기 검색 결과를 기반으로 탐색할 agent 수를 동적으로 결정

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Main Agent                        │
│  ┌─────────────────────────────────────────────┐   │
│  │ 1. 키워드 수신                                │   │
│  │ 2. 초기 검색 (agent-browser로 검색엔진 탐색)  │   │
│  │ 3. 발견된 소스 분석 → agent 수 결정           │   │
│  │ 4. Subagent들에게 탐색 명령 + 인증 세션 전달   │   │
│  │ 5. 모든 임시 문서 취합 → 중복 제거            │   │
│  │ 6. 최종 보고서 생성 (citations 포함)          │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │Subagent 1│ │Subagent 2│ │Subagent N│
        │(session1)│ │(session2)│ │(sessionN) │
        └──────────┘ └──────────┘ └──────────┘
              │           │           │
              ▼           ▼           ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │research_1│ │research_2│ │research_N│
        │_agent1.md│ │_agent2.md│ │_agentN.md│
        └──────────┘ └──────────┘ └──────────┘
```

## Component Design

### 1. Main Agent
- **입력**: 검색 키워드 + 선택적 인증 세션 목록
- **초기 탐색**: agent-browser로 Google/DDG 등 검색엔진 탐색
- **소스 분배 로직**: 발견된 URL들을 Similarity 기반으로 그룹핑 → 각 group당 agent 할당
- **인증 세션 관리**: 사용자가 제공한 인증 정보를 subagent에게 전달
- **취합 로직**: 모든 임시 문서 병합 → 중복 제거 → 관련성 정렬

### 2. Subagent
- **입력**: 탐색 키워드 + URL 목록 + 선택적 인증 세션
- **행동**: 각 URL을 agent-browser session으로 방문 → 정보 추출
- **출력**: Markdown 임시 문서 (찾은 소스, 핵심 내용, citation)
- **자율성**: 탐색 깊이/너비를 스스로 결정 (너무 깊으면 중단)

### 3. 인증 세션 관리 (선택적)
- **입력 방식**: 사용자가 session 파일 경로 또는 auth vault 이름 제공
- **지원 대상**: X(Twitter), Reddit, LinkedIn, GitHub 등 인증 필요 사이트
- **적용**: 해당 URL 접근 시에만 해당 세션 사용, 나머지는 anonymous

### 4. 임시 문서 포맷
```markdown
# Research Output - Agent {n}

## Meta
- **Agent ID**: agent_1
- **Session**: session1
- **Timestamp**: 2024-01-15T10:30:00Z
- **Sources Explored**: [url1, url2, ...]

## Findings

### Finding 1
- **Source**: [url](link)
- **Relevance**: High/Medium/Low
- **Summary**: ...
- **Key Quote**: "..."

## Unvisited (Skipped due to time/resources)
- url: reason

## Errors
- url: error message
```

### 5. 최종 보고서 포맷
```markdown
# Deep Research Report: {Topic}

**Generated**: {date}
**Sources**: {n} unique sources
**Agents Used**: {n}

## Executive Summary
{2-3 paragraph overview}

## Findings

### Theme 1
{Merged content from relevant sources}

### Theme 2
...

## Source Index
1. [Title](url) - Brief description
2. ...

## Methodology
- Initial search keywords: ...
- Subagents used: n
- Sessions: n authenticated, n anonymous
```

## Design Decisions

| 결정 | 선택 | 이유 |
|------|------|------|
| Browser 분배 | Named Sessions | 격리성 + 구현 간단, 각 agent 완전 독립 |
| 병렬 수 | 동적 결정 | 초기 검색 결과 기반, 너무 많으면 resource 낭비 |
| 협업 패턴 | 완전 분산 | 중간 통신 없음 → 복잡도 감소, 안정성 증가 |
| Handoff 방식 | 파일 시스템 | 복구 가능, 디버깅 용이, 직렬화 문제 없음 |
| 인증 제공 | 선택적 | 모든 사용자가 인증 정보를 가지는 건 아님 |
| 탐색 전략 | Subagent 자율 | 키워드만 받고 스스로 깊이/방향 결정 |

## Open Questions

- [ ] Subagent 탐색 깊이/너비 제한 정책 (max URLs per agent? max depth?)
- [ ] 중복 제거 알고리즘 (URL 기반? Content 기반? URL + Content hybrid?)
- [ ] 인증 세션의 만료 처리 (만료 시 재인증 요청?)
- [ ] 에러 발생 시 재시도 정책 (max retries?)
- [ ] 사용자에게 진행 상황 보여주는 방식 (streaming? periodic update?)

## Next Steps
- [ ] Detailed implementation plan 작성
- [ ] agent-browser integration design
- [ ] Session management approach 확정
- [ ] Prototype: 2-agent 병렬 탐색 테스트

---
*Brainstormed on 2026-04-07*
