# AI Slop Cleanup Pilot Implementation Plan

> **Worker note:** Execute this plan task-by-task using the run-plan skill or subagents. Each step uses checkbox (`- [ ]`) syntax for progress tracking.

**Goal:** Stabilize the current `extensions/agentic-harness` baseline, then remove a narrow first batch of high-confidence AI slop from low-risk files without changing observable behavior.

**Architecture:** This plan starts by restoring the green verification baseline because `extensions/agentic-harness/tests/extension.test.ts` currently fails on a missing `/ask` command that is still documented in the project README files. After the baseline is green, the cleanup stays intentionally narrow: remove dead imports and obvious comment/banner noise only in low-risk leaf files, while deferring prompt-heavy files, shared contracts, and fallback/error-handling behavior to a later plan.

**Tech Stack:** TypeScript, Vitest, pi extension APIs, TypeBox

**Work Scope:**
- **In scope:** restore `/ask` command registration, align tests with shipped command surface, remove dead imports in `footer.ts` and `agents.ts`, remove obvious non-behavioral banner/comment noise in `footer.ts`, `discipline.ts`, `render.ts`, and `index.ts`
- **Out of scope:** prompt text rewrites, `agents/*.md`, `subagent.ts`, `types.ts`, `runner-events.ts`, `state.ts`, `compaction.ts`, `validator-template.ts`, renaming APIs, changing fallback/error-handling behavior, removing defensive guards, large refactors

**Verification Strategy:**
- **Level:** test-suite
- **Command:** `cd extensions/agentic-harness && npm test`
- **What it validates:** all extension registration, command delegation, event wiring, parser, render, subagent, and ultraplan tests still pass after the cleanup pilot

---

## File Structure Mapping

### Files to modify
- `extensions/agentic-harness/index.ts`
  - Restore `/ask` command registration
  - Remove one empty section header block and obvious comment banners only where behavior is unchanged
- `extensions/agentic-harness/tests/extension.test.ts`
  - Lock `/ask` command registration and handler behavior
- `extensions/agentic-harness/footer.ts`
  - Remove unused imports and low-value inline comments
- `extensions/agentic-harness/agents.ts`
  - Remove unused `basename` import
- `extensions/agentic-harness/discipline.ts`
  - Remove obvious section banner comments only
- `extensions/agentic-harness/render.ts`
  - Remove obvious section banner comments only

### Files explicitly not modified in this pilot
- `extensions/agentic-harness/agents/*.md`
- `extensions/agentic-harness/subagent.ts`
- `extensions/agentic-harness/types.ts`
- `extensions/agentic-harness/runner-events.ts`
- `extensions/agentic-harness/state.ts`
- `extensions/agentic-harness/compaction.ts`
- `extensions/agentic-harness/validator-template.ts`

## Project Capability Discovery

### Project agents / skills available to workers
- Bundled agents exist under `extensions/agentic-harness/agents/*.md`, including `explorer`, `plan-compliance`, `plan-worker`, and `plan-validator`.
- During execution, use the bundled `explorer` agent for any read-only re-checks if needed.
- For plan execution, use the standard worker-validator flow (`plan-compliance` → `plan-worker` → `plan-validator`) if subagents are chosen.

### Verification commands available
- Test suite: `cd extensions/agentic-harness && npm test`
- Type check build: `cd extensions/agentic-harness && npm run build`

---

### Task 1: Restore Green Baseline for Command Registration

**Dependencies:** None (must run first)
**Files:**
- Modify: `extensions/agentic-harness/index.ts:623-705`
- Modify: `extensions/agentic-harness/tests/extension.test.ts:52-61`
- Modify: `extensions/agentic-harness/tests/extension.test.ts:229-276`

- [ ] **Step 1: Add a focused failing test for `/ask` command behavior**

Insert this test block in `extensions/agentic-harness/tests/extension.test.ts` after the `/plan Command` tests and before `Goal Document Tracking`:

```ts
describe("/ask Command", () => {
  it("should register /ask and delegate a manual ask_user_question prompt", async () => {
    const { mockPi, commands } = createMockPi();
    extension(mockPi);

    const ask = commands.get("ask");
    expect(ask).toBeDefined();

    const mockCtx: any = {
      ui: {
        confirm: vi.fn().mockResolvedValue(true),
        setStatus: vi.fn(),
      },
    };

    await ask.handler("What should I work on next?", mockCtx);

    expect(mockPi.sendUserMessage).toHaveBeenCalledTimes(1);
    const prompt = mockPi.sendUserMessage.mock.calls[0][0];
    expect(prompt).toContain("ask_user_question");
    expect(prompt).toContain("What should I work on next?");
  });
});
```

- [ ] **Step 2: Run the targeted test and confirm the current baseline failure**

Run: `cd extensions/agentic-harness && npx vitest run tests/extension.test.ts`
Expected: FAIL because `commands.get("ask")` is `undefined`

- [ ] **Step 3: Implement the `/ask` command in `index.ts`**

Add this command block immediately after the `/ultraplan` command block and before the `/reset-phase` block in `extensions/agentic-harness/index.ts`:

```ts
  pi.registerCommand("ask", {
    description: "Manual smoke test for the ask_user_question tool",
    handler: async (args, ctx) => {
      const topic = args?.trim() || "Ask me one focused question using the ask_user_question tool.";
      const confirmed = await ctx.ui.confirm(
        "Run /ask",
        "The agent will send a manual prompt that requires one ask_user_question tool call.\n\nProceed?"
      );
      if (!confirmed) return;

      currentPhase = "idle";
      ctx.ui.setStatus("harness", "Manual ask_user_question test in progress...");

      pi.sendUserMessage(
        `Manual tool test: use the ask_user_question tool exactly once, then stop. User context: \"${topic}\"`
      );
    },
  });
```

- [ ] **Step 4: Re-run the targeted test and confirm it passes**

Run: `cd extensions/agentic-harness && npx vitest run tests/extension.test.ts`
Expected: PASS

- [ ] **Step 5: Run the package build to ensure the new command is typed correctly**

Run: `cd extensions/agentic-harness && npm run build`
Expected: PASS with no TypeScript errors

- [ ] **Step 6: Commit the baseline restoration**

```bash
git add extensions/agentic-harness/index.ts extensions/agentic-harness/tests/extension.test.ts
git commit -m "fix: restore ask command baseline"
```

### Task 2: Remove Dead Imports from Leaf Files

**Dependencies:** Runs after Task 1 completes
**Files:**
- Modify: `extensions/agentic-harness/footer.ts:1-5`
- Modify: `extensions/agentic-harness/agents.ts:1-4`
- Test: `extensions/agentic-harness/tests/agents.test.ts`
- Test: `extensions/agentic-harness/tests/extension.test.ts`

- [ ] **Step 1: Make the dead-code edits exactly as shown**

Update `extensions/agentic-harness/footer.ts` imports to:

```ts
import type { Component } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import type { ReadonlyFooterDataProvider } from "@mariozechner/pi-coding-agent";
import { basename } from "path";
```

Update `extensions/agentic-harness/agents.ts` imports to:

```ts
import { readdir, readFile } from "fs/promises";
import { join, dirname } from "path";
import { homedir } from "os";
import { existsSync } from "fs";
```

- [ ] **Step 2: Run targeted tests for the touched leaf files**

Run: `cd extensions/agentic-harness && npx vitest run tests/agents.test.ts tests/extension.test.ts`
Expected: PASS

- [ ] **Step 3: Run the package build to catch unused-import or type regressions**

Run: `cd extensions/agentic-harness && npm run build`
Expected: PASS

- [ ] **Step 4: Commit the dead-code pass**

```bash
git add extensions/agentic-harness/footer.ts extensions/agentic-harness/agents.ts
git commit -m "chore: remove dead imports from harness leaf files"
```

### Task 3: Remove Non-Behavioral Comment Noise from Low-Risk Files

**Dependencies:** Runs after Task 2 completes
**Files:**
- Modify: `extensions/agentic-harness/footer.ts:55-101`
- Modify: `extensions/agentic-harness/discipline.ts:1-77`
- Modify: `extensions/agentic-harness/render.ts:1-195`
- Modify: `extensions/agentic-harness/index.ts:22-57`
- Modify: `extensions/agentic-harness/index.ts:405-417`
- Modify: `extensions/agentic-harness/index.ts:693-714`
- Test: `extensions/agentic-harness/tests/render.test.ts`
- Test: `extensions/agentic-harness/tests/discipline.test.ts`
- Test: `extensions/agentic-harness/tests/extension.test.ts`

- [ ] **Step 1: Remove only the inline comments shown below from `footer.ts`**

Delete these comment lines and leave all executable code untouched:

```ts
    // === Data ===
    // === Line 1: dir │ branch │ model ===
    // === Line 2: ctx bar │ cache │ tools ===
    // Active tools
```

- [ ] **Step 2: Remove section-banner comments from `discipline.ts` without changing exports or prompt strings**

Delete these comment blocks only:

```ts
// ============================================================
// Which agents receive discipline hooks
// ============================================================

// ============================================================
// Karpathy Rules — injected into agent system prompt
// ============================================================

// ============================================================
// Slop Cleaner — task for post-execution cleanup agent
// ============================================================
```

Do **not** change `KARPATHY_RULES` or the text returned by `getSlopCleanerTask()`.

- [ ] **Step 3: Remove section-banner comments from `render.ts` without changing any function body**

Delete these comment blocks only:

```ts
// ---------------------------------------------------------------------------
// Formatting helpers (exported for testing)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Shared rendering helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// renderCall — shown while the tool is being invoked
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// renderResult — shown after the tool completes (or during streaming)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Single-mode result
// ---------------------------------------------------------------------------
```

Leave all remaining code, strings, and signatures unchanged.

- [ ] **Step 4: Remove low-value section banners from `index.ts` and delete the empty session-start header block**

Delete these comment blocks only:

```ts
// ============================================================
// Workflow State
// ============================================================
// Tracks which phase the agent is in so before_agent_start
// can inject appropriate guidance into the system prompt.
// ============================================================
```

```ts
// ============================================================
// ask_user_question Tool
// ============================================================
// The agent calls this autonomously when it encounters ambiguity.
// The agent generates the question text and choices dynamically.
// ============================================================
```

```ts
// ============================================================
// resources_discover: Register bundled skills
// ============================================================
```

```ts
// ============================================================
// before_agent_start: Inject workflow phase guidance
// ============================================================
```

```ts
// ============================================================
// /reset-phase — reset workflow phase to idle
// ============================================================
```

```ts
// ============================================================
// Session start notification
// ============================================================
```

```ts
// ============================================================
// message_end: Track cache hit rate
// ============================================================
```

Do **not** change any command prompt strings in this task.

- [ ] **Step 5: Run targeted tests for the touched files**

Run: `cd extensions/agentic-harness && npx vitest run tests/render.test.ts tests/discipline.test.ts tests/extension.test.ts`
Expected: PASS

- [ ] **Step 6: Run the package build**

Run: `cd extensions/agentic-harness && npm run build`
Expected: PASS

- [ ] **Step 7: Commit the over-commenting pass**

```bash
git add extensions/agentic-harness/footer.ts extensions/agentic-harness/discipline.ts extensions/agentic-harness/render.ts extensions/agentic-harness/index.ts
git commit -m "chore: trim non-behavioral comment noise"
```

### Task 4 (Final): End-to-End Verification

**Dependencies:** Runs after Task 2 and Task 3 complete
**Files:** None (read-only verification)

- [ ] **Step 1: Run highest-level verification**

Run: `cd extensions/agentic-harness && npm test`
Expected: ALL PASS

- [ ] **Step 2: Verify plan success criteria**

Manually check each success criterion from the plan header:
- [ ] `extensions/agentic-harness/tests/extension.test.ts` is green and `/ask` is registered again
- [ ] No prompt text, fallback behavior, or agent contract changed outside the `/ask` restoration
- [ ] Dead imports are removed from `footer.ts` and `agents.ts`
- [ ] Only comment/banner noise was removed from `footer.ts`, `discipline.ts`, `render.ts`, and the targeted `index.ts` sections
- [ ] No files outside the declared scope were modified

- [ ] **Step 3: Run full type-check build for regressions**

Run: `cd extensions/agentic-harness && npm run build`
Expected: PASS with no regressions

## Self-Review

- **Spec coverage:** The plan covers baseline stabilization first (Task 1), dead-code cleanup (Task 2), over-commenting cleanup (Task 3), and final verification (Task 4). It intentionally excludes prompt rewriting, defensive-guard cleanup, and shared-core files because the user prioritized behavior safety.
- **Placeholder scan:** No `TODO`, `TBD`, or deferred implementation markers are present. Every task has exact files, concrete code snippets, and exact commands.
- **Type consistency:** `/ask` is introduced as a normal `pi.registerCommand` block matching the existing command API style in `index.ts` and the test expects the same registration surface.
- **Dependency verification:** Task 1 must run first because the test suite is currently red. Task 2 and Task 3 both touch `extensions/agentic-harness/footer.ts`, so Task 3 explicitly depends on Task 2 to prevent file conflicts.
- **Verification coverage:** The plan includes a final verification task using the discovered project test suite command and a final `npm run build` regression check.
