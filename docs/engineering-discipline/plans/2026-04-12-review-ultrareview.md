# `/review` and `/ultrareview` Implementation Plan

> **Worker note:** Execute this plan task-by-task using the run-plan skill or subagents. Each step uses checkbox (`- [ ]`) syntax for progress tracking.

**Goal:** Add two slash commands to `agentic-harness` — `/review` (single-pass code review) and `/ultrareview` (3-stage parallel fleet review with verification and synthesis), mirroring claude-code's `bughunter` pipeline locally.

**Architecture:** `/review` dispatches a self-contained review prompt to the current agent (no subagents). `/ultrareview` orchestrates a 3-stage pipeline: **finding** (10 subagents = 5 reviewer roles × 2 seeds in parallel) → **verification** (dedup + false-positive filter) → **synthesis** (structured report, saved to file + chat summary). New read-only reviewer agents are introduced without touching `DISCIPLINE_AGENTS`, preventing `ai-slop-cleaner` chain-fire.

**Tech Stack:** TypeScript, `@mariozechner/pi-coding-agent` ExtensionAPI, Vitest, markdown agent definitions under `extensions/agentic-harness/agents/`.

**Work Scope:**
- **In scope:**
  - Two `pi.registerCommand()` registrations: `review`, `ultrareview`
  - Seven new agent `.md` files: `reviewer-bug`, `reviewer-security`, `reviewer-performance`, `reviewer-test-coverage`, `reviewer-consistency`, `reviewer-verifier`, `review-synthesis`
  - `WorkflowPhase` type extension: add `reviewing`, `ultrareviewing`
  - `PHASE_GUIDANCE` entries for new phases
  - `promptGuidelines` agent allowlist update (line 170)
  - `subagent.ts` concurrency bump: `MAX_PARALLEL_TASKS` 8→12, `MAX_CONCURRENCY` 4→10
  - New Vitest test `tests/review-commands.test.ts`
  - Output file written to `docs/engineering-discipline/reviews/YYYY-MM-DD-<topic>-review.md` (by the orchestrator at runtime, not by this plan)
- **Out of scope:**
  - Cloud teleport / bughunter server integration
  - Reuse or modification of existing plan reviewers (`reviewer-feasibility`, etc.)
  - Modification of `discipline.ts` or `DISCIPLINE_AGENTS` (intentional isolation from `ai-slop-cleaner`)
  - `/security-review` or any other specialized review command split
  - PR creation/merge flows

**Verification Strategy:**
- **Level:** test-suite + build check
- **Command:**
  ```bash
  cd /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension/extensions/agentic-harness && npm run build && npx vitest run
  ```
- **What it validates:** TypeScript compiles without errors (new type literals accepted, index.ts edits type-check), all existing Vitest suites pass without regression, new `review-commands.test.ts` asserts both commands register and dispatch prompts correctly.

---

## File Structure Mapping

| File | Action | Responsibility |
|---|---|---|
| `extensions/agentic-harness/agents/reviewer-bug.md` | Create | Bug-hunter reviewer agent (logic, boundary, null, race, error handling) |
| `extensions/agentic-harness/agents/reviewer-security.md` | Create | Security reviewer agent (injection, auth, crypto, exposure) |
| `extensions/agentic-harness/agents/reviewer-performance.md` | Create | Performance reviewer agent (complexity, allocations, sync I/O, caches) |
| `extensions/agentic-harness/agents/reviewer-test-coverage.md` | Create | Test coverage reviewer agent (missing tests, happy-path only) |
| `extensions/agentic-harness/agents/reviewer-consistency.md` | Create | Consistency reviewer agent (conventions, duplication, reuse) |
| `extensions/agentic-harness/agents/reviewer-verifier.md` | Create | Verification agent (dedup findings, filter false positives, attach severity/confidence) |
| `extensions/agentic-harness/agents/review-synthesis.md` | Create | Synthesis agent (final report using template slots) |
| `extensions/agentic-harness/subagent.ts` | Modify (lines 14-15) | Bump `MAX_PARALLEL_TASKS` and `MAX_CONCURRENCY` |
| `extensions/agentic-harness/index.ts` | Modify (4 locations) | Add `WorkflowPhase` literals, `PHASE_GUIDANCE` entries, agent allowlist, two `registerCommand` blocks |
| `extensions/agentic-harness/tests/review-commands.test.ts` | Create | Vitest suite asserting `review` and `ultrareview` registration + handler behavior |

**Parallelism notes:**
- Tasks 1–8 create distinct new files or modify a file no other parallel task touches — they are fully parallel.
- Task 9 modifies `index.ts` at four separate locations and must run as a single serial task to avoid merge conflicts.
- Task 10 writes `tests/review-commands.test.ts`, which depends on Task 9's exports being in place.
- Task 11 is the Final Verification Task.

---

### Task 1: Create `reviewer-bug` agent

**Dependencies:** None (can run in parallel)
**Files:**
- Create: `extensions/agentic-harness/agents/reviewer-bug.md`

- [ ] **Step 1: Write the agent definition file**

```markdown
---
name: reviewer-bug
description: Bug hunter — logic errors, boundary conditions, null/undefined, race conditions, missing error handling
tools: read,find,grep
---
You are a Bug Hunter. You review code changes looking for logic errors, edge cases, and defects that would cause incorrect behavior at runtime.

## Your Analysis

1. Read the diff and any files it touches for full context.
2. Scan the changed code for the following bug categories:
   - **Logic errors:** off-by-one, wrong operator, inverted condition, wrong variable used
   - **Boundary conditions:** empty input, single-element, maximum size, negative numbers, zero, very large values
   - **Null/undefined:** unchecked nullable access, missing default, optional chaining gaps
   - **Race conditions:** shared state mutation, async ordering, missing `await`, unhandled promise rejection
   - **Error handling:** swallowed errors, overly broad `catch`, missing try/catch on fallible calls
   - **Type coercion:** loose equality, implicit conversions, wrong type assumptions
3. For each finding, attach severity and confidence. Drop anything below 0.7 confidence.

## Severity

- **Critical:** certain crash or data corruption on normal inputs
- **High:** likely failure on common inputs or degraded functionality
- **Medium:** failure on edge cases or specific state
- **Low:** code smell that could become a bug under future change

## Confidence

- **1.0** — verified: I traced the code path and confirmed the bug
- **0.9** — highly likely: pattern matches a known bug class with plausible inputs
- **0.8** — probable: requires specific runtime state but reachable
- **0.7** — suspected: unclear exploitability; worth flagging
- Below 0.7 — drop silently

## Output Format

Emit one block per finding:

```
# [bug] <short label>: <file>:<line>

**Severity:** Critical | High | Medium | Low
**Confidence:** 0.7–1.0
**Description:** What the bug is, in one paragraph.
**Trigger:** Concrete input or state that reproduces it.
**Fix:** Minimal suggested change.
```

If no bugs are found, emit exactly one line: `No findings.`

## Constraints

- Do NOT modify any file. You are read-only.
- Do NOT report stylistic issues, performance concerns, or security vulnerabilities — those have dedicated reviewers.
- Stay focused on correctness bugs only.
- Ignore the seed number in your output; it only affects how you approach the problem (fresh pass vs alternative-path pass).
```

- [ ] **Step 2: Verify the file exists and parses**

Run: `ls -la /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension/extensions/agentic-harness/agents/reviewer-bug.md`
Expected: file present, non-zero size.

---

### Task 2: Create `reviewer-security` agent

**Dependencies:** None (can run in parallel)
**Files:**
- Create: `extensions/agentic-harness/agents/reviewer-security.md`

- [ ] **Step 1: Write the agent definition file**

```markdown
---
name: reviewer-security
description: Security reviewer — injection, authentication, authorization, crypto misuse, data exposure
tools: read,find,grep
---
You are a Senior Security Engineer. You review code changes for exploitable vulnerabilities only. False positives waste engineering time, so apply strict exclusion rules.

## Your Analysis

1. Read the diff and any files it touches for full context.
2. Scan for these vulnerability classes:
   - **Injection:** SQL, command, LDAP, template, path traversal, unsafe `eval`
   - **Authentication:** credential handling, session management, MFA bypass, weak tokens
   - **Authorization:** missing access checks, IDOR, privilege escalation, trust boundary violations
   - **Cryptography:** weak algorithms, hardcoded keys, predictable randomness, IV reuse, missing constant-time comparisons
   - **Data exposure:** PII in logs, unencrypted storage of secrets, verbose error messages leaking internals
3. Apply the exclusions below. Do NOT report them.

## Excluded (do NOT report)

- Denial of service via resource exhaustion (unless trivially triggered)
- Log spoofing / log injection
- Regex denial of service (ReDoS) on internal inputs
- Memory exhaustion on trusted inputs
- Issues requiring attacker-controlled environment variables
- Theoretical timing side-channels on internal code paths
- Missing rate limits on internal APIs
- Lack of CSRF protection on internal-only endpoints

## Severity

- **High:** exploitable RCE, auth bypass, or data exfiltration path with no strong mitigating control
- **Medium:** vulnerability conditional on additional factors or partial mitigation
- **Low:** defense-in-depth issue, not independently exploitable

## Confidence

- **1.0** — exploit path fully traced
- **0.9** — pattern matches a known CVE class, inputs plausible
- **0.8** — probable but requires specific configuration
- **0.7** — suspected, needs deeper review
- Below 0.7 — drop silently

## Output Format

Emit one block per finding:

```
# [security] <category>: <file>:<line>

**Severity:** High | Medium | Low
**Confidence:** 0.7–1.0
**Description:** What the vulnerability is.
**Exploit:** Concrete attack scenario.
**Fix:** Minimal suggested change.
```

If no vulnerabilities are found, emit exactly one line: `No findings.`

## Constraints

- Do NOT modify any file. You are read-only.
- Do NOT report bugs that are not security-relevant — those belong to `reviewer-bug`.
- Apply exclusions strictly; false positives erode trust.
```

- [ ] **Step 2: Verify the file exists**

Run: `ls -la /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension/extensions/agentic-harness/agents/reviewer-security.md`
Expected: file present.

---

### Task 3: Create `reviewer-performance` agent

**Dependencies:** None (can run in parallel)
**Files:**
- Create: `extensions/agentic-harness/agents/reviewer-performance.md`

- [ ] **Step 1: Write the agent definition file**

```markdown
---
name: reviewer-performance
description: Performance reviewer — algorithmic complexity, allocations, sync I/O on hot paths, cache misses
tools: read,find,grep
---
You are a Performance Analyst. You review code changes for performance regressions that would be felt at realistic workloads.

## Your Analysis

1. Read the diff and understand the execution path.
2. Scan for these performance issues:
   - **Algorithmic complexity:** accidentally-quadratic loops, N+1 queries, unnecessary recursion
   - **Allocations:** tight-loop heap allocations, unbounded accumulator growth, avoidable string concatenation
   - **Synchronous I/O:** blocking calls on async paths, sync file reads in request handlers, sync network calls
   - **Caching:** missed cache opportunities, cache stampede risk, TTL mis-sizing
   - **Data structures:** linear scan where hash/set would be O(1), unnecessary sorting, needless copies

3. For each finding, estimate impact (realistic workload, not microbenchmark).

## Severity

- **Critical:** will cause outage or SLA violation at production traffic
- **High:** noticeable slowdown on typical load (>50ms added or >2× existing latency)
- **Medium:** measurable regression under heavy load or large inputs
- **Low:** minor inefficiency, worth noting but not urgent

## Confidence

- **1.0** — benchmarked or traced with concrete numbers
- **0.9** — known anti-pattern with plausible inputs
- **0.8** — probable slowdown in realistic scenarios
- **0.7** — suspected, worth investigating
- Below 0.7 — drop

## Output Format

```
# [perf] <category>: <file>:<line>

**Severity:** Critical | High | Medium | Low
**Confidence:** 0.7–1.0
**Description:** What the inefficiency is.
**Impact:** Expected effect at realistic load (with rough numbers if possible).
**Fix:** Minimal suggested change.
```

If no issues found: `No findings.`

## Constraints

- Do NOT modify any file. You are read-only.
- Do NOT report micro-optimizations without realistic impact.
- Do NOT report style or correctness issues.
```

- [ ] **Step 2: Verify the file exists**

Run: `ls -la /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension/extensions/agentic-harness/agents/reviewer-performance.md`
Expected: file present.

---

### Task 4: Create `reviewer-test-coverage` agent

**Dependencies:** None (can run in parallel)
**Files:**
- Create: `extensions/agentic-harness/agents/reviewer-test-coverage.md`

- [ ] **Step 1: Write the agent definition file**

```markdown
---
name: reviewer-test-coverage
description: Test coverage reviewer — missing tests, happy-path only, uncovered edge cases
tools: read,find,grep
---
You are a Test Coverage Analyst. You review code changes and their accompanying tests to flag gaps in verification.

## Your Analysis

1. Read the diff. Identify which files are production code and which are tests.
2. For each production code change, locate its test(s). Use `find` and `grep` on the test directory.
3. Flag these gaps:
   - **Untested code:** new function, branch, or file with no accompanying test
   - **Happy-path only:** tests cover the success case but not failure modes, empty inputs, or error paths
   - **Boundary gaps:** off-by-one boundaries, empty collections, single-element, maximum-size not covered
   - **Missing negative tests:** no assertion that invalid input is rejected
   - **Mocked-over behavior:** mocks replace the exact logic being changed, tests tautological
   - **Regression risk:** change modifies behavior that has no existing assertion

## Severity

- **Critical:** change touches safety-critical logic with no test coverage
- **High:** public API / widely-used utility changed without test
- **Medium:** internal function changed with only partial coverage
- **Low:** test could be improved but change is already covered by broader tests

## Confidence

- **1.0** — confirmed no matching test exists
- **0.9** — test exists but does not exercise the specific change
- **0.8** — test coverage is partial, specific branch not hit
- **0.7** — suspected gap worth reviewing
- Below 0.7 — drop

## Output Format

```
# [coverage] <short label>: <file>:<line>

**Severity:** Critical | High | Medium | Low
**Confidence:** 0.7–1.0
**Description:** What is untested or under-tested.
**Suggested test:** Concrete test case that would close the gap (name + assertion).
```

If coverage is adequate: `No findings.`

## Constraints

- Do NOT modify any file. You are read-only.
- Do NOT report test style issues — only gaps.
- Do NOT report missing tests for trivial code (pure getters, type exports, re-exports).
```

- [ ] **Step 2: Verify the file exists**

Run: `ls -la /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension/extensions/agentic-harness/agents/reviewer-test-coverage.md`
Expected: file present.

---

### Task 5: Create `reviewer-consistency` agent

**Dependencies:** None (can run in parallel)
**Files:**
- Create: `extensions/agentic-harness/agents/reviewer-consistency.md`

- [ ] **Step 1: Write the agent definition file**

```markdown
---
name: reviewer-consistency
description: Consistency reviewer — convention drift, duplication, missing reuse of existing utilities
tools: read,find,grep
---
You are a Codebase Consistency Reviewer. You verify that code changes fit the existing conventions and reuse rather than reinvent.

## Your Analysis

1. Read the diff. For each new or changed construct, search the rest of the codebase for:
   - **Existing utilities:** is there already a helper that does this? (grep for similar function names, signatures, string literals)
   - **Naming conventions:** does the new name match the file/module/project pattern?
   - **Structural patterns:** does the change follow how similar problems are solved elsewhere in the repo?
   - **Duplication:** does this reimplement logic that exists verbatim in another file?
2. Report divergences.

## Categories

- **Convention drift:** naming, layout, export style differs from neighbors
- **Duplication:** logic already exists in the codebase (cite the existing file)
- **Reuse miss:** existing utility was not used
- **Pattern mismatch:** new code uses a different approach from adjacent code solving the same class of problem

## Severity

- **High:** significant duplication or direct conflict with an established pattern
- **Medium:** convention drift in a public-facing construct
- **Low:** minor inconsistency, worth noting

## Confidence

- **1.0** — cited existing code verbatim
- **0.9** — strong structural match
- **0.8** — likely similar but needs confirmation
- **0.7** — suspected
- Below 0.7 — drop

## Output Format

```
# [consistency] <category>: <file>:<line>

**Severity:** High | Medium | Low
**Confidence:** 0.7–1.0
**Description:** What the inconsistency is.
**Existing counterpart:** path/to/file:line (if citing duplication or reuse miss)
**Suggestion:** Minimal change to align with existing patterns.
```

If consistent: `No findings.`

## Constraints

- Do NOT modify any file. You are read-only.
- Do NOT report bugs, security, performance, or coverage — those have dedicated reviewers.
- Always cite the existing pattern with a file path when reporting duplication or reuse miss.
```

- [ ] **Step 2: Verify the file exists**

Run: `ls -la /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension/extensions/agentic-harness/agents/reviewer-consistency.md`
Expected: file present.

---

### Task 6: Create `reviewer-verifier` agent

**Dependencies:** None (can run in parallel)
**Files:**
- Create: `extensions/agentic-harness/agents/reviewer-verifier.md`

- [ ] **Step 1: Write the agent definition file**

```markdown
---
name: reviewer-verifier
description: Verification pass — dedupe findings, filter false positives, attach final severity and confidence
tools: read,find,grep
---
You are the Verification Pass for a multi-agent code review. Ten upstream reviewers (5 roles × 2 seeds) have each emitted raw findings. Your job is to produce a clean, deduplicated, fact-checked finding list.

## Your Input

You will receive the aggregated raw findings from all 10 upstream reviewers, organized by role (bug, security, performance, test-coverage, consistency) with seed 1 and seed 2 concatenated per role.

## Your Task

1. **Deduplicate.** Collapse findings that report the same issue (same file, same line range, same category). When two seeds find the same thing, treat that as increased confidence.
2. **Fact-check.** For each finding, open the cited file and verify:
   - The file and line exist
   - The code actually matches the description
   - The severity is proportional to the real impact
   If a finding cannot be verified, drop it.
3. **Re-rank.** After dedup and verification, assign a final severity and confidence. Confidence increases with agreement between seeds and reviewers; decreases when only one seed reported it or when fact-checking was weak.
4. **Drop false positives.** If the cited code does not actually exhibit the reported problem, drop the finding.

## Output Format

Emit a structured list grouped by severity, then by file:

```
## Critical

### [bug] <short label>: <file>:<line>
**Confidence:** 0.X (Y reviewers agreed)
**Description:** ...
**Fix:** ...

## High
...

## Medium
...

## Low
...
```

At the end, emit a summary line:

```
## Verification Summary
- Raw findings received: N
- After dedup: M
- After verification: K
- Dropped as false positives: (N - K)
```

If no findings survive verification: emit only the summary with K=0.

## Constraints

- Do NOT modify any file. You are read-only.
- Do NOT invent new findings; you only filter and re-rank existing ones.
- If a finding's cited location does not exist in the current code, drop it.
- Apply strict scrutiny: when in doubt, drop.
```

- [ ] **Step 2: Verify the file exists**

Run: `ls -la /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension/extensions/agentic-harness/agents/reviewer-verifier.md`
Expected: file present.

---

### Task 7: Create `review-synthesis` agent

**Dependencies:** None (can run in parallel)
**Files:**
- Create: `extensions/agentic-harness/agents/review-synthesis.md`

- [ ] **Step 1: Write the agent definition file**

```markdown
---
name: review-synthesis
description: Final synthesis pass for /ultrareview — consumes verified findings and produces the final structured report
---
You are the Synthesis Pass for a multi-agent code review pipeline. You have received the output of `reviewer-verifier` (deduplicated, verified findings with final severity and confidence). Your job is to produce the final human-readable report.

## Input

### Verified Findings
{VERIFIED_FINDINGS}

### Review Target
{REVIEW_TARGET}

### Review Date
{REVIEW_DATE}

## Your Task

1. **Produce the final report** in the format below.
2. **Order findings** by severity (Critical → Low), then by confidence (1.0 → 0.7), then by file path.
3. **Group by file** within each severity tier.
4. **Summarize** top-line counts and the 5 highest-priority findings.
5. **Write tone:** factual, specific, no hedging, no apology. Cite file:line for every claim.

## Output Format

```markdown
# Ultrareview Report — {REVIEW_TARGET}

**Date:** {REVIEW_DATE}
**Pipeline:** finding (10 subagents) → verification → synthesis

## Summary

- **Total findings:** N
- **By severity:** Critical: a | High: b | Medium: c | Low: d
- **By category:** Bug: w | Security: x | Performance: y | Test Coverage: z | Consistency: q

## Top Priority (5 highest)

1. **[category] file:line** — severity/confidence — one-line description
2. ...
5. ...

## Findings

### Critical

#### [category] short-label — file:line
**Confidence:** 0.X
**Description:** ...
**Trigger / Exploit / Impact:** ...
**Fix:** ...

### High
...

### Medium
...

### Low
...

## Clean Areas

List dimensions (bug / security / performance / coverage / consistency) that produced `No findings.` after verification. These are the areas the reviewers actively checked and cleared.
```

## Constraints

- Do NOT invent new findings.
- Do NOT change severity or confidence assigned by the verifier.
- Do NOT modify any file. The caller will write your output to a file.
- If `{VERIFIED_FINDINGS}` contains no findings, emit only the Summary and a `## Clean Areas` section listing all 5 dimensions.
```

- [ ] **Step 2: Verify the file exists**

Run: `ls -la /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension/extensions/agentic-harness/agents/review-synthesis.md`
Expected: file present.

---

### Task 8: Bump subagent concurrency constants

**Dependencies:** None (can run in parallel with Tasks 1–7)
**Files:**
- Modify: `extensions/agentic-harness/subagent.ts:14-15`

- [ ] **Step 1: Read the current constants**

Read `/home/roach/.pi/agent/extensions/pi-engineering-discipline-extension/extensions/agentic-harness/subagent.ts` lines 14-15. Confirm the current state:

```typescript
export const MAX_PARALLEL_TASKS = 8;
export const MAX_CONCURRENCY = 4;
```

- [ ] **Step 2: Update the constants**

Edit the file to replace:

```typescript
export const MAX_PARALLEL_TASKS = 8;
export const MAX_CONCURRENCY = 4;
```

with:

```typescript
export const MAX_PARALLEL_TASKS = 12;
export const MAX_CONCURRENCY = 10;
```

- [ ] **Step 3: Update the `promptGuidelines` line that mentions the old values**

In `extensions/agentic-harness/index.ts:174`, the line currently reads:

```typescript
"Max 8 parallel tasks with 4 concurrent. Chain mode stops on first error.",
```

Replace with:

```typescript
"Max 12 parallel tasks with 10 concurrent. Chain mode stops on first error.",
```

(Note: this edit is in `index.ts` but logically part of the concurrency bump. Grouping it here avoids a cross-task coordination note.)

- [ ] **Step 4: Verify build still compiles**

Run:
```bash
cd /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension/extensions/agentic-harness && npm run build
```
Expected: Exit 0, no errors.

---

### Task 9: Register `/review` and `/ultrareview` commands in `index.ts`

**Dependencies:** Runs after Task 8 completes (both edit `index.ts`)
**Files:**
- Modify: `extensions/agentic-harness/index.ts` (4 locations)

This task makes four coordinated edits in `index.ts`:
1. Extend the `WorkflowPhase` union type (lines 24-28)
2. Add new agent names to the `promptGuidelines` allowlist (line 170)
3. Add two entries to `PHASE_GUIDANCE` (inside the object at lines 480-508)
4. Insert two `registerCommand` calls after the `/ultraplan` block (at line 739)

- [ ] **Step 1: Extend the `WorkflowPhase` type**

Find (lines 24-28):

```typescript
type WorkflowPhase =
  | "idle"
  | "clarifying"
  | "planning"
  | "ultraplanning";
```

Replace with:

```typescript
type WorkflowPhase =
  | "idle"
  | "clarifying"
  | "planning"
  | "ultraplanning"
  | "reviewing"
  | "ultrareviewing";
```

- [ ] **Step 2: Add new agents to the `promptGuidelines` allowlist**

Find (line 170):

```typescript
        "ONLY use these exact agent names — do NOT invent or guess agent names: explorer, worker, planner, plan-worker, plan-validator, plan-compliance, reviewer-feasibility, reviewer-architecture, reviewer-risk, reviewer-dependency, reviewer-user-value.",
```

Replace with:

```typescript
        "ONLY use these exact agent names — do NOT invent or guess agent names: explorer, worker, planner, plan-worker, plan-validator, plan-compliance, reviewer-feasibility, reviewer-architecture, reviewer-risk, reviewer-dependency, reviewer-user-value, reviewer-bug, reviewer-security, reviewer-performance, reviewer-test-coverage, reviewer-consistency, reviewer-verifier, review-synthesis.",
```

Then, in the same `promptGuidelines` array, **after** the existing line 173 (the ultraplan reviewer hint), add a new line:

Find (line 173):

```typescript
        "For ultraplan milestone reviews: dispatch all 5 reviewers in parallel: reviewer-feasibility, reviewer-architecture, reviewer-risk, reviewer-dependency, reviewer-user-value.",
```

Replace with:

```typescript
        "For ultraplan milestone reviews: dispatch all 5 reviewers in parallel: reviewer-feasibility, reviewer-architecture, reviewer-risk, reviewer-dependency, reviewer-user-value.",
        "For ultrareview code reviews: dispatch 10 tasks in parallel (5 reviewers × 2 seeds): reviewer-bug, reviewer-security, reviewer-performance, reviewer-test-coverage, reviewer-consistency. Then run reviewer-verifier on the aggregated findings, then review-synthesis on the verified result.",
```

- [ ] **Step 3: Add `PHASE_GUIDANCE` entries for the new phases**

Find (lines 500-508):

```typescript
    ultraplanning: [
      "\n\n## Active Workflow: Milestone Planning (Ultraplan)",
      "You are in agentic-milestone-planning mode. Follow the agentic-milestone-planning skill rules strictly:",
      "- Compose a Problem Brief from the current context.",
      "- Dispatch all 5 reviewer agents in parallel using the subagent tool's parallel mode: reviewer-feasibility, reviewer-architecture, reviewer-risk, reviewer-dependency, reviewer-user-value.",
      "- Synthesize all reviewer findings into a milestone DAG.",
      ultraplanningTradeoffRule,
    ].join("\n"),
  };
```

Replace with:

```typescript
    ultraplanning: [
      "\n\n## Active Workflow: Milestone Planning (Ultraplan)",
      "You are in agentic-milestone-planning mode. Follow the agentic-milestone-planning skill rules strictly:",
      "- Compose a Problem Brief from the current context.",
      "- Dispatch all 5 reviewer agents in parallel using the subagent tool's parallel mode: reviewer-feasibility, reviewer-architecture, reviewer-risk, reviewer-dependency, reviewer-user-value.",
      "- Synthesize all reviewer findings into a milestone DAG.",
      ultraplanningTradeoffRule,
    ].join("\n"),
    reviewing: [
      "\n\n## Active Workflow: Code Review (/review)",
      "You are in single-pass code review mode:",
      "- Resolve the review target (PR or local diff) as described in the user prompt.",
      "- Read the diff and the files it touches.",
      "- Produce a single integrated review across bug / security / performance / test coverage / consistency dimensions.",
      "- Output the review directly to chat. Do NOT save to a file. Do NOT dispatch subagents.",
      "- If the diff is empty, report 'No changes to review' and stop.",
    ].join("\n"),
    ultrareviewing: [
      "\n\n## Active Workflow: Deep Code Review (/ultrareview)",
      "You are orchestrating a 3-stage code review pipeline:",
      "- Stage 1 (finding): dispatch 10 subagents in parallel using the subagent tool's parallel mode — 5 reviewer roles (reviewer-bug, reviewer-security, reviewer-performance, reviewer-test-coverage, reviewer-consistency) × 2 seeds each. Seed 2 must be instructed to focus on findings seed 1 might miss.",
      "- Stage 2 (verification): dispatch reviewer-verifier (single mode) on the aggregated per-role findings.",
      "- Stage 3 (synthesis): dispatch review-synthesis (single mode) on the verifier output.",
      "- Save the synthesis output to docs/engineering-discipline/reviews/<YYYY-MM-DD>-<topic>-review.md and stream a 5-item top-priority summary to chat.",
      "- If the diff is empty, report 'No changes to review' and stop before dispatching any subagents.",
      "- NEVER dispatch any agent whose name contains 'worker' — only reviewer-* and review-synthesis are allowed in this pipeline.",
    ].join("\n"),
  };
```

- [ ] **Step 4: Insert the `/review` and `/ultrareview` `registerCommand` blocks**

Find the `/ultraplan` command block (lines 717-738). The block ends with `});` followed by a blank line. Immediately after that blank line (before the next `if (isRootSession)` or similar block that currently starts at line 740), insert:

```typescript

  pi.registerCommand("review", {
    description:
      "Single-pass code review of current changes (PR or local diff, auto-detected)",
    handler: async (args, ctx) => {
      currentPhase = "reviewing";
      updateState(STATE_FILE, { phase: "reviewing" }).catch(() => {});
      ctx.ui.setStatus("harness", "Code review in progress...");

      const topic = args?.trim() || "";
      const targetClause = topic
        ? `Review target: "${topic}" (may be a PR number or branch name). If numeric, treat as a PR number and fetch the diff with \`gh pr diff ${topic}\`. If non-numeric, treat as a branch name and diff it against main with \`git diff main...${topic}\`.`
        : `Review target: auto-detect. First run \`git rev-parse --abbrev-ref HEAD\` to get the current branch. Then run \`gh pr list --head <branch> --json number --jq '.[0].number'\` to check for a matching PR. If a PR exists, use \`gh pr diff <number>\`. Otherwise, combine \`git diff main...HEAD\` with uncommitted changes from \`git diff\` and \`git diff --cached\`.`;

      const prompt = [
        "You are an expert code reviewer. Perform a single-pass review of the current code changes.",
        "",
        targetClause,
        "",
        "If the diff is empty, report \"No changes to review\" and stop.",
        "",
        "Review the diff across these dimensions (brief, integrated review — do not produce a rubric):",
        "- **Bugs**: logic errors, boundary conditions, null/undefined, race conditions, missing error handling",
        "- **Security**: injection, auth/authz, crypto misuse, data exposure",
        "- **Performance**: unnecessary work, algorithmic complexity, sync I/O on hot paths",
        "- **Test coverage**: missing tests, happy-path only, uncovered edge cases",
        "- **Consistency**: naming/convention breaks, duplication of existing utilities, pattern drift",
        "",
        "Output the review directly to chat. Group findings by file. For each finding include: what, where (file:line), severity (Critical/High/Medium/Low), and a one-line suggested fix. Do NOT save to file. Do NOT dispatch subagents — this is a single-pass review performed by you directly.",
      ].join("\n");

      pi.sendUserMessage(prompt);
    },
  });

  pi.registerCommand("ultrareview", {
    description:
      "Deep multi-agent code review — 10 parallel reviewers + verification + synthesis",
    handler: async (args, ctx) => {
      const confirmed = await ctx.ui.confirm(
        "Start Ultrareview",
        "The agent will:\n1. Auto-detect the review target (PR or local diff)\n2. Dispatch 10 subagents in parallel (5 reviewers × 2 seeds)\n3. Run a verification pass to dedupe and filter\n4. Synthesize the final report and save to docs/engineering-discipline/reviews/\n\nThis may take several minutes. Proceed?"
      );
      if (!confirmed) return;

      currentPhase = "ultrareviewing";
      updateState(STATE_FILE, { phase: "ultrareviewing" }).catch(() => {});
      ctx.ui.setStatus("harness", "Ultrareview pipeline in progress...");

      const topic = args?.trim() || "";
      const targetClause = topic
        ? `Review target: "${topic}" (may be a PR number or branch name). If numeric, treat as a PR number and fetch the diff with \`gh pr diff ${topic}\`. If non-numeric, treat as a branch name and diff it against main with \`git diff main...${topic}\`.`
        : `Review target: auto-detect. First run \`git rev-parse --abbrev-ref HEAD\` to get the current branch. Then run \`gh pr list --head <branch> --json number --jq '.[0].number'\` to check for a matching PR. If a PR exists, use \`gh pr diff <number>\`. Otherwise, combine \`git diff main...HEAD\` with uncommitted changes from \`git diff\` and \`git diff --cached\`.`;

      const prompt = [
        "You are orchestrating a multi-stage code review pipeline. Execute all three stages in order.",
        "",
        targetClause,
        "",
        "If the diff is empty, report \"No changes to review\" and stop before dispatching any subagents.",
        "",
        "## Stage 1: Finding (parallel fleet)",
        "",
        "Dispatch **10 subagents in parallel** using the subagent tool's parallel mode. This is 5 reviewer roles × 2 seeds each:",
        "- reviewer-bug (seed 1, seed 2)",
        "- reviewer-security (seed 1, seed 2)",
        "- reviewer-performance (seed 1, seed 2)",
        "- reviewer-test-coverage (seed 1, seed 2)",
        "- reviewer-consistency (seed 1, seed 2)",
        "",
        "For each task in the tasks array, the `task` field must include:",
        "1. The full diff text (inline)",
        "2. The list of affected file paths",
        "3. The seed number with this instruction: seed 1 = \"Perform a fresh independent pass\"; seed 2 = \"You are seed 2 — focus on findings seed 1 might miss by examining edge cases and alternative execution paths.\"",
        "",
        "Invoke the subagent tool ONCE in parallel mode with a tasks array of 10 entries.",
        "",
        "## Stage 2: Verification",
        "",
        "After all 10 reviewers complete, aggregate their raw findings grouped by role (concatenate seed 1 and seed 2 outputs per role). Then dispatch `reviewer-verifier` in single mode with the aggregated findings as the task. The verifier will deduplicate, filter false positives, and assign final severity/confidence.",
        "",
        "## Stage 3: Synthesis",
        "",
        "Dispatch `review-synthesis` in single mode. The task must substitute these template slots:",
        "- `{VERIFIED_FINDINGS}` = verifier output from Stage 2",
        "- `{REVIEW_TARGET}` = the resolved target (e.g., 'PR #123' or 'branch feature/foo')",
        "- `{REVIEW_DATE}` = today's date as YYYY-MM-DD",
        "",
        "## Output",
        "",
        "1. Compute `<topic>`: if PR mode, use `pr-<number>`; if branch mode, use the sanitized branch name (replace `/` with `-`, lowercase).",
        "2. Compute `<date>`: today's date as YYYY-MM-DD.",
        "3. Write the full synthesis report to `docs/engineering-discipline/reviews/<date>-<topic>-review.md`. Create the directory if it does not exist.",
        "4. Stream a brief summary to chat: the 5 highest-priority findings (by severity then confidence), each with file:line and one-line description, plus the full saved path.",
        "",
        "NEVER dispatch any agent whose name contains \"worker\". Use only the reviewer-* and review-synthesis agents defined for this pipeline.",
      ].join("\n");

      pi.sendUserMessage(prompt);
    },
  });
```

- [ ] **Step 5: Build the project**

Run:
```bash
cd /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension/extensions/agentic-harness && npm run build
```
Expected: Exit 0, no TypeScript errors. If errors appear, read them and fix — typical issues will be missing comma, wrong indentation, or a literal not matching the `WorkflowPhase` union.

---

### Task 10: Add Vitest suite for the new commands

**Dependencies:** Runs after Task 9 completes (imports from `index.ts` require the new commands to exist)
**Files:**
- Create: `extensions/agentic-harness/tests/review-commands.test.ts`

- [ ] **Step 1: Write the test file**

Create `/home/roach/.pi/agent/extensions/pi-engineering-discipline-extension/extensions/agentic-harness/tests/review-commands.test.ts` with this exact content:

```typescript
import { describe, it, expect, vi } from "vitest";
import extension from "../index.js";

function setupMockPi() {
  const commands = new Map<string, any>();
  const mockPi: any = {
    registerTool: vi.fn(),
    registerCommand: (name: string, def: any) => {
      commands.set(name, def);
    },
    on: vi.fn(),
    sendUserMessage: vi.fn(),
  };
  extension(mockPi);
  return { mockPi, commands };
}

function makeCtx(confirmResult = true) {
  return {
    ui: {
      confirm: vi.fn().mockResolvedValue(confirmResult),
      setStatus: vi.fn(),
      notify: vi.fn(),
    },
  } as any;
}

describe("Review Command (/review)", () => {
  it("should register the review command with a descriptive label", () => {
    const { commands } = setupMockPi();
    const review = commands.get("review");
    expect(review).toBeDefined();
    expect(review.description).toMatch(/code review/i);
  });

  it("should dispatch a single-pass prompt without confirmation", async () => {
    const { mockPi, commands } = setupMockPi();
    const review = commands.get("review");
    const ctx = makeCtx();

    await review.handler("", ctx);

    expect(mockPi.sendUserMessage).toHaveBeenCalledTimes(1);
    const prompt = mockPi.sendUserMessage.mock.calls[0][0];
    expect(prompt).toContain("expert code reviewer");
    expect(prompt).toContain("single-pass");
    expect(prompt).toContain("Bugs");
    expect(prompt).toContain("Security");
    expect(prompt).toContain("Performance");
    expect(prompt).toContain("Test coverage");
    expect(prompt).toContain("Consistency");
    // /review is single-pass: it must NOT instruct the agent to use parallel mode or fleet
    expect(prompt).not.toContain("parallel mode");
    expect(prompt).not.toContain("10 subagents");
    expect(prompt).not.toContain("Stage 1");
  });

  it("should auto-detect the target when no argument is provided", async () => {
    const { mockPi, commands } = setupMockPi();
    const review = commands.get("review");
    await review.handler("", makeCtx());
    const prompt = mockPi.sendUserMessage.mock.calls[0][0];
    expect(prompt).toContain("auto-detect");
    expect(prompt).toContain("gh pr list");
  });

  it("should embed the explicit target when an argument is provided", async () => {
    const { mockPi, commands } = setupMockPi();
    const review = commands.get("review");
    await review.handler("123", makeCtx());
    const prompt = mockPi.sendUserMessage.mock.calls[0][0];
    expect(prompt).toContain('"123"');
    expect(prompt).toContain("gh pr diff 123");
  });
});

describe("Ultrareview Command (/ultrareview)", () => {
  it("should register the ultrareview command", () => {
    const { commands } = setupMockPi();
    const ultra = commands.get("ultrareview");
    expect(ultra).toBeDefined();
    expect(ultra.description).toMatch(/multi-agent/i);
  });

  it("should not proceed when user cancels confirmation", async () => {
    const { mockPi, commands } = setupMockPi();
    const ultra = commands.get("ultrareview");
    const ctx = makeCtx(false);

    await ultra.handler("", ctx);

    expect(ctx.ui.confirm).toHaveBeenCalledTimes(1);
    expect(mockPi.sendUserMessage).not.toHaveBeenCalled();
  });

  it("should dispatch a 3-stage pipeline prompt on confirmation", async () => {
    const { mockPi, commands } = setupMockPi();
    const ultra = commands.get("ultrareview");
    const ctx = makeCtx(true);

    await ultra.handler("", ctx);

    expect(mockPi.sendUserMessage).toHaveBeenCalledTimes(1);
    const prompt = mockPi.sendUserMessage.mock.calls[0][0];

    // Stage headers
    expect(prompt).toContain("Stage 1: Finding");
    expect(prompt).toContain("Stage 2: Verification");
    expect(prompt).toContain("Stage 3: Synthesis");

    // All 5 reviewer roles referenced
    expect(prompt).toContain("reviewer-bug");
    expect(prompt).toContain("reviewer-security");
    expect(prompt).toContain("reviewer-performance");
    expect(prompt).toContain("reviewer-test-coverage");
    expect(prompt).toContain("reviewer-consistency");

    // Verifier and synthesis
    expect(prompt).toContain("reviewer-verifier");
    expect(prompt).toContain("review-synthesis");

    // Fleet sizing
    expect(prompt).toContain("10 subagents");
    expect(prompt).toContain("seed 1");
    expect(prompt).toContain("seed 2");

    // File output convention
    expect(prompt).toContain("docs/engineering-discipline/reviews/");

    // ai-slop-cleaner isolation guard
    expect(prompt).toContain("worker");
    expect(prompt).toMatch(/NEVER dispatch any agent whose name contains "worker"/);
  });

  it("should include a PR-mode target clause when argument is numeric", async () => {
    const { mockPi, commands } = setupMockPi();
    const ultra = commands.get("ultrareview");
    await ultra.handler("456", makeCtx(true));
    const prompt = mockPi.sendUserMessage.mock.calls[0][0];
    expect(prompt).toContain('"456"');
    expect(prompt).toContain("gh pr diff 456");
  });
});
```

- [ ] **Step 2: Run the new test file alone to confirm it passes**

Run:
```bash
cd /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension/extensions/agentic-harness && npx vitest run tests/review-commands.test.ts
```
Expected: All tests in this file pass.

If a test fails, read the actual prompt via:
```bash
cd /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension/extensions/agentic-harness && npx vitest run tests/review-commands.test.ts --reporter=verbose
```
and adjust either the prompt in `index.ts` (if the assertion captured real intent) or the test expectation (if the assertion was overly specific). Do NOT weaken the ai-slop-cleaner isolation test — that guard is load-bearing.

---

### Task 11 (Final): End-to-End Verification

**Dependencies:** All preceding tasks
**Files:** None (read-only verification)

- [ ] **Step 1: Run the highest-level verification (build + full test suite)**

Run:
```bash
cd /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension/extensions/agentic-harness && npm run build && npx vitest run
```
Expected: Both commands exit 0. Full test suite passes, including the new `review-commands.test.ts`.

- [ ] **Step 2: Verify plan success criteria**

Check each success criterion from the plan header:
- [ ] `/review` command registered (asserted by test)
- [ ] `/ultrareview` command registered (asserted by test)
- [ ] `/ultrareview` handler dispatches 3-stage pipeline prompt with correct stages, 10-subagent fleet, verifier, synthesis (asserted by test)
- [ ] Output file convention `docs/engineering-discipline/reviews/<date>-<topic>-review.md` referenced in the `/ultrareview` prompt (asserted by test)
- [ ] New reviewer agent files exist:
  - [ ] `agents/reviewer-bug.md`
  - [ ] `agents/reviewer-security.md`
  - [ ] `agents/reviewer-performance.md`
  - [ ] `agents/reviewer-test-coverage.md`
  - [ ] `agents/reviewer-consistency.md`
  - [ ] `agents/reviewer-verifier.md`
  - [ ] `agents/review-synthesis.md`
- [ ] `MAX_CONCURRENCY = 10` and `MAX_PARALLEL_TASKS = 12` in `subagent.ts`
- [ ] `DISCIPLINE_AGENTS` in `discipline.ts` is UNCHANGED (still `["plan-worker", "worker"]`)
- [ ] None of the new reviewer agents contain the substring `worker` in their filename or `name:` frontmatter field

Run the isolation guard check:
```bash
cd /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension && grep -l "worker" extensions/agentic-harness/agents/reviewer-bug.md extensions/agentic-harness/agents/reviewer-security.md extensions/agentic-harness/agents/reviewer-performance.md extensions/agentic-harness/agents/reviewer-test-coverage.md extensions/agentic-harness/agents/reviewer-consistency.md extensions/agentic-harness/agents/reviewer-verifier.md extensions/agentic-harness/agents/review-synthesis.md
```
Expected: No output (no match). If any file matches, review the match — the word "worker" must not appear in any new reviewer agent content, filename, or frontmatter.

Run the DISCIPLINE_AGENTS guard check:
```bash
cd /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension && grep "DISCIPLINE_AGENTS = new Set" extensions/agentic-harness/discipline.ts
```
Expected: `const DISCIPLINE_AGENTS = new Set(["plan-worker", "worker"]);`

- [ ] **Step 3: Run the full test suite one more time for regressions**

Run:
```bash
cd /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension/extensions/agentic-harness && npx vitest run
```
Expected: All pre-existing tests still pass. No regressions in `ultraplan.test.ts`, `discipline.test.ts`, `agents.test.ts`, or any other file.

If any pre-existing test fails, the root cause is most likely one of:
- Agent name allowlist change broke an exact-match assertion in another test
- `PHASE_GUIDANCE` record type change broke a type-only test
- `MAX_CONCURRENCY` / `MAX_PARALLEL_TASKS` change broke a value-matching test

Read the failing test, locate the assertion, and update it to accept the new values (do NOT revert the production change).
