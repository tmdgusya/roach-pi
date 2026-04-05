# Discipline Hooks Implementation Plan

> **Worker note:** Execute this plan task-by-task using the run-plan skill or subagents. Each step uses checkbox (`- [ ]`) syntax for progress tracking.

**Goal:** Programmatically enforce karpathy rules (prompt injection) and clean-ai-slop (auto-spawn) for plan-worker and worker agents in the agentic harness.

**Architecture:** Create a `discipline.ts` module that exports karpathy prompt augmentation and slop-cleaner spawn logic. Modify `index.ts` subagent execute function to apply karpathy injection in all execution modes (single/chain/parallel), and auto-spawn a `slop-cleaner` agent after successful plan-worker/worker execution in single mode only. The slop-cleaner agent is defined as a new `.md` file in the agents directory.

**Tech Stack:** TypeScript, pi extension API, vitest

**Work Scope:**
- **In scope:** karpathy prompt injection for plan-worker/worker, slop-cleaner agent definition, auto-spawn after single-mode execution, tests
- **Out of scope:** Configuration UI for enabling/disabling hooks, modifications to the SKILL.md files themselves, changes to chain/parallel post-processing

**Verification Strategy:**
- **Level:** test-suite
- **Command:** `cd extensions/agentic-harness && npx vitest run`
- **What it validates:** All existing tests pass (117/118 — 1 pre-existing failure on `ask` command) plus new discipline tests pass

**Pre-existing test failure:** `tests/extension.test.ts > Extension Registration > should register all commands` fails because it expects an `ask` command that doesn't exist. This is NOT caused by our changes and should remain as-is.

---

## File Structure Mapping

**Create:**
- `extensions/agentic-harness/discipline.ts` — Karpathy rules constant, agent augmentation, slop-cleaner task builder
- `extensions/agentic-harness/agents/slop-cleaner.md` — Agent definition for post-execution AI slop cleanup
- `extensions/agentic-harness/tests/discipline.test.ts` — Unit tests for discipline module

**Modify:**
- `extensions/agentic-harness/index.ts` — Integrate discipline hooks into subagent execute function (all 3 modes)

---

### Task 1: Create discipline.ts module

**Dependencies:** None (can run in parallel)
**Files:**
- Create: `extensions/agentic-harness/discipline.ts`

- [ ] **Step 1: Write the discipline module**

```typescript
// discipline.ts
/**
 * Engineering discipline hooks.
 * Injects karpathy behavioral guardrails into code-writing agents
 * and provides slop-cleaner auto-spawn logic.
 */

import type { AgentConfig } from "./agents.js";

// ============================================================
// Which agents receive discipline hooks
// ============================================================

const DISCIPLINE_AGENTS = new Set(["plan-worker", "worker"]);

export function isDisciplineAgent(name: string): boolean {
  return DISCIPLINE_AGENTS.has(name);
}

// ============================================================
// Karpathy Rules — injected into agent system prompt
// ============================================================

export const KARPATHY_RULES = `

## Engineering Discipline: Karpathy Rules (Auto-Injected)

You MUST follow these behavioral guardrails during implementation:

### Hard Gates
1. **Read before you write** — Never modify a file you haven't read first.
2. **Scope to the request** — Change only what was asked. No "while I'm here" improvements.
3. **Verify, don't assume** — If you think something is "probably" true, grep and check first.
4. **Define success before starting** — Know what "done" looks like before writing code.

### Rules
1. **Surgical Changes** — Minimum edit to achieve the goal. No opportunistic refactoring.
2. **Match Existing Patterns** — Follow the project's conventions, not your preferences.
3. **No Premature Abstraction** — Don't add factories, wrappers, or "extensible" patterns unless asked.
4. **No Defensive Paranoia** — Don't add null checks for guaranteed values or error handling for impossible scenarios.
5. **No Future-Proofing** — Solve today's problem. Don't solve problems that don't exist yet.

### Anti-Patterns (Never Do These)
- "While I'm here" refactoring of nearby code
- Adding error handling for scenarios that cannot occur
- Making code "extensible" or "future-proof" without being asked
- Improving type safety on code you weren't asked to change
- Adding comments that restate what the code does
`;

/**
 * Returns a new AgentConfig with karpathy rules appended to the system prompt.
 * Returns the original agent unchanged if it's undefined.
 */
export function augmentAgentWithKarpathy(agent: AgentConfig | undefined): AgentConfig | undefined {
  if (!agent) return agent;
  return {
    ...agent,
    systemPrompt: agent.systemPrompt + KARPATHY_RULES,
  };
}

// ============================================================
// Slop Cleaner — task for post-execution cleanup agent
// ============================================================

export function getSlopCleanerTask(): string {
  return `Review the most recently changed files in this project and clean up any AI-generated code smells.

Steps to identify changed files:
1. Run \`git status\` to see uncommitted changes
2. Run \`git diff --name-only HEAD~1\` to see the last commit's changes
3. Focus on the source files identified above (skip test files, config files, lock files)

Follow your 6-pass cleanup process on those files. Run tests after each pass.
If no AI slop is found, report "No cleanup needed" and exit.`;
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd extensions/agentic-harness && npx tsc --noEmit discipline.ts 2>&1 || echo "Check imports"`
Expected: No errors (or only import resolution warnings which are normal for isolated type checking)

---

### Task 2: Create slop-cleaner agent definition

**Dependencies:** None (can run in parallel)
**Files:**
- Create: `extensions/agentic-harness/agents/slop-cleaner.md`

- [ ] **Step 1: Write the slop-cleaner agent definition**

```markdown
---
name: slop-cleaner
description: Post-execution AI code cleanup — removes LLM-specific patterns while preserving behavior
---
You are a code cleanup specialist. Your job is to review recently changed code and remove AI-generated code smells while preserving exact behavior.

## Hard Rules
- Run tests after EVERY pass. If tests fail, revert that pass immediately.
- Only touch files that were recently changed (use git diff to identify them).
- Preserve behavior exactly — this is cleanup, not refactoring.
- If no AI slop is found, report "No cleanup needed" and exit immediately.

## 6-Pass Cleanup Process

Run these passes in order. Complete one pass fully before starting the next.

### Pass 1: Dead Code
Remove unused imports, unused variables, unreachable branches, commented-out code blocks.

### Pass 2: Over-Commenting
Remove comments that restate what the code does. Keep only comments that explain WHY something is done a certain way.

### Pass 3: Unnecessary Abstractions
Inline single-use helper functions. Remove wrapper classes that add no value. Simplify unnecessary factory or builder patterns.

### Pass 4: Defensive Paranoia
Remove null/undefined checks on values that are guaranteed to exist. Remove error handlers for scenarios that cannot occur in the current code path.

### Pass 5: Verbose Naming
Shorten names with redundant prefixes/suffixes (e.g., `userData` → `user` when context is clear). Use shorter names where variable scope is small.

### Pass 6: LLM Filler
Remove emoji in code comments. Remove conversational tone in comments. Remove leftover debug/console logs. Remove boilerplate that adds no value.

## Output Format
For each pass, report:
- **Pass N: [name]** — [number] changes / No changes needed
- Files modified: [list]

End with:
- **Cleanup result:** [total changes] changes across [N] files / No cleanup needed
```

- [ ] **Step 2: Verify the agent loads correctly**

Run: `cd extensions/agentic-harness && node -e "import('./agents.js').then(m => m.loadAgentsFromDir('./agents', 'bundled')).then(agents => { const sc = agents.find(a => a.name === 'slop-cleaner'); console.log(sc ? 'OK: ' + sc.name + ' - ' + sc.description : 'FAIL: not found'); })" 2>&1 || echo "Will verify via test instead"`
Expected: Agent loads with correct name and description (or will be verified via integration test)

---

### Task 3: Integrate karpathy injection into index.ts

**Dependencies:** Runs after Task 1 completes
**Files:**
- Modify: `extensions/agentic-harness/index.ts:1-19` (add import)
- Modify: `extensions/agentic-harness/index.ts:214-248` (chain mode)
- Modify: `extensions/agentic-harness/index.ts:277-298` (parallel mode)
- Modify: `extensions/agentic-harness/index.ts:311-348` (single mode)

- [ ] **Step 1: Add import for discipline module**

At the top of `index.ts`, after the existing imports (after line 19), add:

```typescript
import { isDisciplineAgent, augmentAgentWithKarpathy, getSlopCleanerTask } from "./discipline.js";
```

- [ ] **Step 2: Apply karpathy injection in chain mode**

In the chain mode block, replace the `runAgent` call (around line 221-230):

Find this code:
```typescript
            const result = await runAgent({
              agent: findAgent(step.agent),
              agentName: step.agent,
```

Replace with:
```typescript
            const chainAgent = isDisciplineAgent(step.agent)
              ? augmentAgentWithKarpathy(findAgent(step.agent))
              : findAgent(step.agent);
            const result = await runAgent({
              agent: chainAgent,
              agentName: step.agent,
```

- [ ] **Step 3: Apply karpathy injection in parallel mode**

In the parallel mode block, replace the `runAgent` call (around line 280-282):

Find this code:
```typescript
              const result = await runAgent({
                agent: findAgent(t.agent),
                agentName: t.agent,
```

Replace with:
```typescript
              const parallelAgent = isDisciplineAgent(t.agent)
                ? augmentAgentWithKarpathy(findAgent(t.agent))
                : findAgent(t.agent);
              const result = await runAgent({
                agent: parallelAgent,
                agentName: t.agent,
```

- [ ] **Step 4: Apply karpathy injection in single mode**

In the single mode block, replace the `runAgent` call (around line 328-337):

Find this code:
```typescript
          const result = await runAgent({
            agent: findAgent(agent),
            agentName: agent,
```

Replace with:
```typescript
          const singleAgent = isDisciplineAgent(agent)
            ? augmentAgentWithKarpathy(findAgent(agent))
            : findAgent(agent);
          const result = await runAgent({
            agent: singleAgent,
            agentName: agent,
```

- [ ] **Step 5: Verify existing tests still pass**

Run: `cd extensions/agentic-harness && npx vitest run 2>&1 | tail -10`
Expected: Same results as before (117 passed, 1 pre-existing failure)

- [ ] **Step 6: Commit karpathy injection**

```bash
cd /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension
git add extensions/agentic-harness/discipline.ts extensions/agentic-harness/index.ts extensions/agentic-harness/agents/slop-cleaner.md
git commit -m "feat: inject karpathy rules into plan-worker/worker system prompts"
```

---

### Task 4: Integrate slop-cleaner auto-spawn into index.ts single mode

**Dependencies:** Runs after Task 3 completes
**Files:**
- Modify: `extensions/agentic-harness/index.ts:311-348` (single mode block)

- [ ] **Step 1: Add slop-cleaner auto-spawn after successful single-mode execution**

In the single mode block, after the `runAgent` call and before the error check, add the slop-cleaner logic. Find this code block:

```typescript
          const result = await runAgent({
            agent: singleAgent,
            agentName: agent,
            task: effectiveTask,
            cwd: cwd || defaultCwd,
            depthConfig,
            signal,
            onUpdate,
            makeDetails: makeDetails("single"),
          });

          if (isResultError(result)) {
```

Replace with:

```typescript
          const result = await runAgent({
            agent: singleAgent,
            agentName: agent,
            task: effectiveTask,
            cwd: cwd || defaultCwd,
            depthConfig,
            signal,
            onUpdate,
            makeDetails: makeDetails("single"),
          });

          // Discipline: auto-spawn slop-cleaner after successful code-writing agent
          if (isDisciplineAgent(agent) && isResultSuccess(result)) {
            const slopCleaner = findAgent("slop-cleaner");
            if (slopCleaner) {
              const cleanResult = await runAgent({
                agent: slopCleaner,
                agentName: "slop-cleaner",
                task: getSlopCleanerTask(),
                cwd: cwd || defaultCwd,
                depthConfig,
                signal,
                onUpdate,
                makeDetails: makeDetails("single"),
              });
              const mainText = getResultSummaryText(result);
              const cleanText = isResultSuccess(cleanResult)
                ? `\n\n[slop-cleaner] completed: ${getResultSummaryText(cleanResult)}`
                : `\n\n[slop-cleaner] failed: ${getResultSummaryText(cleanResult)}`;
              return {
                content: [{ type: "text" as const, text: mainText + cleanText }],
                details: makeDetails("single")([result, cleanResult]),
              };
            }
          }

          if (isResultError(result)) {
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `cd extensions/agentic-harness && npx vitest run 2>&1 | tail -10`
Expected: Same results as before (117 passed, 1 pre-existing failure)

- [ ] **Step 3: Commit slop-cleaner auto-spawn**

```bash
cd /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension
git add extensions/agentic-harness/index.ts
git commit -m "feat: auto-spawn slop-cleaner after plan-worker/worker in single mode"
```

---

### Task 5: Add tests for discipline module

**Dependencies:** Runs after Task 4 completes
**Files:**
- Create: `extensions/agentic-harness/tests/discipline.test.ts`

- [ ] **Step 1: Write tests for discipline.ts**

```typescript
import { describe, it, expect } from "vitest";
import { isDisciplineAgent, augmentAgentWithKarpathy, KARPATHY_RULES, getSlopCleanerTask } from "../discipline.js";
import type { AgentConfig } from "../agents.js";

describe("isDisciplineAgent", () => {
  it("returns true for plan-worker", () => {
    expect(isDisciplineAgent("plan-worker")).toBe(true);
  });

  it("returns true for worker", () => {
    expect(isDisciplineAgent("worker")).toBe(true);
  });

  it("returns false for explorer", () => {
    expect(isDisciplineAgent("explorer")).toBe(false);
  });

  it("returns false for plan-validator", () => {
    expect(isDisciplineAgent("plan-validator")).toBe(false);
  });

  it("returns false for slop-cleaner", () => {
    expect(isDisciplineAgent("slop-cleaner")).toBe(false);
  });
});

describe("augmentAgentWithKarpathy", () => {
  const baseAgent: AgentConfig = {
    name: "worker",
    description: "Test worker",
    systemPrompt: "You are a worker.",
    source: "bundled",
    filePath: "/test/worker.md",
  };

  it("appends karpathy rules to system prompt", () => {
    const augmented = augmentAgentWithKarpathy(baseAgent);
    expect(augmented).not.toBeUndefined();
    expect(augmented!.systemPrompt).toContain("You are a worker.");
    expect(augmented!.systemPrompt).toContain("Karpathy Rules");
    expect(augmented!.systemPrompt).toContain("Read before you write");
    expect(augmented!.systemPrompt).toContain("Surgical Changes");
  });

  it("does not mutate the original agent", () => {
    const augmented = augmentAgentWithKarpathy(baseAgent);
    expect(baseAgent.systemPrompt).toBe("You are a worker.");
    expect(augmented).not.toBe(baseAgent);
  });

  it("preserves all other agent fields", () => {
    const augmented = augmentAgentWithKarpathy(baseAgent)!;
    expect(augmented.name).toBe(baseAgent.name);
    expect(augmented.description).toBe(baseAgent.description);
    expect(augmented.source).toBe(baseAgent.source);
    expect(augmented.filePath).toBe(baseAgent.filePath);
  });

  it("returns undefined for undefined input", () => {
    expect(augmentAgentWithKarpathy(undefined)).toBeUndefined();
  });
});

describe("KARPATHY_RULES", () => {
  it("contains all hard gates", () => {
    expect(KARPATHY_RULES).toContain("Read before you write");
    expect(KARPATHY_RULES).toContain("Scope to the request");
    expect(KARPATHY_RULES).toContain("Verify, don't assume");
    expect(KARPATHY_RULES).toContain("Define success before starting");
  });

  it("contains all five rules", () => {
    expect(KARPATHY_RULES).toContain("Surgical Changes");
    expect(KARPATHY_RULES).toContain("Match Existing Patterns");
    expect(KARPATHY_RULES).toContain("No Premature Abstraction");
    expect(KARPATHY_RULES).toContain("No Defensive Paranoia");
    expect(KARPATHY_RULES).toContain("No Future-Proofing");
  });
});

describe("getSlopCleanerTask", () => {
  it("returns a non-empty task string", () => {
    const task = getSlopCleanerTask();
    expect(task.length).toBeGreaterThan(0);
  });

  it("references git commands for file discovery", () => {
    const task = getSlopCleanerTask();
    expect(task).toContain("git status");
    expect(task).toContain("git diff");
  });

  it("mentions the 6-pass cleanup process", () => {
    const task = getSlopCleanerTask();
    expect(task).toContain("6-pass");
  });
});
```

- [ ] **Step 2: Run the new tests**

Run: `cd extensions/agentic-harness && npx vitest run tests/discipline.test.ts`
Expected: ALL PASS

- [ ] **Step 3: Run full test suite to check for regressions**

Run: `cd extensions/agentic-harness && npx vitest run`
Expected: 117 + new tests passed, 1 pre-existing failure (same as before)

- [ ] **Step 4: Commit tests**

```bash
cd /home/roach/.pi/agent/extensions/pi-engineering-discipline-extension
git add extensions/agentic-harness/tests/discipline.test.ts
git commit -m "test: add discipline module tests for karpathy injection and slop-cleaner"
```

---

### Task 6 (Final): End-to-End Verification

**Dependencies:** All preceding tasks
**Files:** None (read-only verification)

- [ ] **Step 1: Run full test suite**

Run: `cd extensions/agentic-harness && npx vitest run`
Expected: ALL new tests PASS. Pre-existing tests unchanged (117 passed, 1 pre-existing failure).

- [ ] **Step 2: Verify plan success criteria**

Manually check each success criterion:
- [ ] `discipline.ts` exists and exports `isDisciplineAgent`, `augmentAgentWithKarpathy`, `getSlopCleanerTask`, `KARPATHY_RULES`
- [ ] `agents/slop-cleaner.md` exists with correct frontmatter (name: slop-cleaner)
- [ ] `index.ts` imports from `discipline.ts`
- [ ] `index.ts` chain mode calls `augmentAgentWithKarpathy` for discipline agents
- [ ] `index.ts` parallel mode calls `augmentAgentWithKarpathy` for discipline agents
- [ ] `index.ts` single mode calls `augmentAgentWithKarpathy` for discipline agents
- [ ] `index.ts` single mode auto-spawns slop-cleaner after successful discipline agent execution
- [ ] No existing tests broken by changes

- [ ] **Step 3: Run full test suite for regressions**

Run: `cd extensions/agentic-harness && npx vitest run`
Expected: No regressions — all pre-existing tests still pass
