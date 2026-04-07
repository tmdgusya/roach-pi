# Brainstorming Skill Implementation Plan

> **Worker note:** Execute this plan task-by-task. This is a single-file skill creation — no parallel execution needed.

**Goal:** Create `agentic-brainstorming` skill that guides users through Q&A dialogue to clarify and develop their ideas, outputting a structured markdown idea document.

**Architecture:** A standalone skill that uses iterative Q&A to help users articulate and structure their thoughts. The skill follows a "funnel in" approach — starting broad, then drilling deeper into specific aspects until the user feels their thinking is complete. Output is a markdown document with idea hierarchy and relationship mappings.

**Tech Stack:** SKILL.md markdown format (existing pattern), existing agentic-harness infrastructure

**Work Scope:**
- **In scope:** SKILL.md creation with Q&A logic, markdown output format with relationship diagrams
- **Out of scope:** Actual skill implementation by subagents, code execution, integration with other skills

---

**Verification Strategy:**
- **Level:** build-only
- **Command:** N/A (this is a documentation deliverable)
- **What it validates:** SKILL.md is valid markdown with proper structure and trigger phrases

---

## Context

Based on clarification with the user:

| Item | Decision |
|------|----------|
| Purpose | Idea brainstorming assistant |
| Method | **Q&A deep conversation** — accompanies user until thinking is self-clarified |
| Output | Markdown idea notes with **lists + relationship diagrams** |
| Location | `extensions/agentic-harness/skills/agentic-brainstorming/SKILL.md` |
| Pattern | Single SKILL.md file (matching existing skill structure) |
| Integration | **Standalone** — callable independently anytime |

---

## Task 1: Create agentic-brainstorming SKILL.md

**Dependencies:** None
**Files:**
- Create: `extensions/agentic-harness/skills/agentic-brainstorming/SKILL.md`

- [ ] **Step 1: Define SKILL.md metadata header**

```markdown
---
name: agentic-brainstorming
description: Ideation companion that helps users articulate and develop ideas through deep Q&A dialogue. Use when user says "brainstorm", "아이디어", "아이디어 정리", "생각을 정리하고 싶어", "무엇이든 떠오르는 대로", or wants to explore possibilities before committing to a plan.
---

# Brainstorming Skill

[Long description follows]
```

- [ ] **Step 2: Write Core Principle section**

```markdown
## Core Principle

**Ideas emerge through dialogue, not extraction.** The brainstorms are not a question machine — they are a thinking mirror. This skill reflects, expands, and connects the user's thoughts until they feel ready to move forward.

Three pillars:
1. **Listen first** — absorb what the user says without judgment
2. **Expand thoughtfully** — offer perspectives, connections, alternatives
3. **Structure at the end** — organize chaos into usable markdown
```

- [ ] **Step 3: Write Hard Gates section**

```markdown
## Hard Gates

1. **Never lead, always follow.** Ask "why" before suggesting "what if".
2. **One question at a time.** Never bundle multiple questions in one turn.
3. **Silence is valid.** If the user pauses, wait. Don't fill space.
4. **Output is a gift, not a demand.** The markdown is offered, never imposed.
5. **Exit gracefully.** User declares "I'm done" — we format and close.
```

- [ ] **Step 4: Define When To Use / When NOT To Use**

```markdown
## When To Use

- User wants to explore an idea without a specific goal
- User has a vague concept and needs to flesh it out
- User is stuck and needs a fresh perspective
- User says: "brainstorm", "아이디어", "생각을 정리하고 싶어", "무엇이든 떠오르는 대로"

## When NOT To Use

- User has a clear, specific task (use agentic-clarification instead)
- User wants implementation help (use agentic-plan-crafting after brainstorming)
- User is asking a factual question (use explorer agent)
```

- [ ] **Step 5: Write Q&A Process section with question types**

```markdown
## Q&A Process

### Phase 1: Discovery (2-4 exchanges)
Start with open-ended questions to understand the domain:
- "무엇에 대해 이야기하고 싶으신가요?"
- "어떤 맥락에서 이 아이디어가 떠올랐나요?"
- "이미 어떤 생각들이 있으신가요?"

### Phase 2: Expansion (3-6 exchanges)
Dive deeper into specific aspects:
- **Clarification probes:** "그건 정확히 무엇을 의미하나요?"
- **Alternative prompts:** "같은 목표를 다른 방식으로 접근한다면?"
- **Constraint challenges:** "만약 제약이 없다면 어떻게 달라질까요?"
- **Connection requests:** "이것과 이전에 말씀하신 ___는 어떻게 연결되나요?"

### Phase 3: Structure (2-3 exchanges)
Help organize the output:
- "이 아이디어의 핵심 요소들을 정리해볼까요?"
- "이 요소들 사이에 어떤 관계가 있나요?"
- "가장 중요한 것부터 순서를 매겨볼까요?"

### Phase 4: Output (1 exchange)
Present the markdown and confirm completion:
- Present structured markdown
- "이 정리된 내용으로 충분하신가요, 더 살펴보고 싶은 부분이 있으신가요?"
- On "done" → close gracefully
```

- [ ] **Step 6: Define Output Format with relationship diagram syntax**

```markdown
## Output Format

The brainstorming result is a markdown document with two parts:

### Part 1: Idea Core
```markdown
## [Idea Title]

### 핵심 요소 (Core Elements)
- **Element 1:** Description
- **Element 2:** Description
- **Element 3:** Description

### 목표 (Goal)
> One-sentence summary of what this idea aims to achieve.

### 동기 (Motivation)
> Why this idea matters to the user.
```

### Part 2: Relationship Map
```markdown
## 관계도 (Relationship Map)

```
[Element A] --supports--> [Element B]
[Element C] --conflicts-with--> [Element A]
[Element B] --enables--> [Element D]
```

### 아이디어 스케치 (Idea Sketch)
Free-form notes, fragments, questions that emerged during conversation:
- ...
```

### Part 3: Key Insights (if any)
```markdown
## 핵심 통찰 (Key Insights)
- Insight 1
- Insight 2
```
```

- [ ] **Step 7: Write Anti-Patterns section**

```markdown
## Anti-Patterns

| Anti-Pattern | Why It Fails |
|---|---|
| "Here's a better idea..." | Leads rather than follows — kills user ownership |
| "Let me summarize..." after every turn | Disrupts flow, user hasn't finished thinking |
| "What about X, Y, Z?" (multiple at once) | Overwhelms, doesn't allow depth |
| Skipping Discovery, jumping to Structure | User feels unheard, ideas are shallow |
| Offering the markdown before asking | Imposing structure, not co-creating |
```

- [ ] **Step 8: Write Minimal Checklist and Transition sections**

```markdown
## Minimal Checklist

- [ ] Started with open-ended Discovery question
- [ ] Asked one question per turn
- [ ] Waited for user response before next question
- [ ] Expanded ideas through thoughtful probes
- [ ] Offered Structure phase when conversation naturally matured
- [ ] Presented markdown as a gift, not a demand
- [ ] Closed gracefully on "done"

## Transition

After brainstorming is complete:
- If user wants to implement → `agentic-clarification` then `agentic-plan-crafting`
- If user wants to explore another idea → continue brainstorming (new session)
- If user wants to save ideas → markdown is already saved

This skill does not auto-transition. User chooses next step.
```

- [ ] **Step 9: Save the file**

Create directory and save:
```bash
mkdir -p extensions/agentic-harness/skills/agentic-brainstorming
# Then save SKILL.md content
```

- [ ] **Step 10: Verify structure**

Verify the SKILL.md contains all required sections:
- [ ] name and description (frontmatter)
- [ ] Core Principle
- [ ] Hard Gates (5 rules)
- [ ] When To Use / When NOT To Use
- [ ] Q&A Process (4 phases with examples)
- [ ] Output Format (with relationship diagram syntax)
- [ ] Anti-Patterns
- [ ] Minimal Checklist
- [ ] Transition

---

## Final Verification

### Task 2 (Final): Verify Brainstorming Skill Completeness

**Dependencies:** Task 1 complete
**Files:** None (read-only verification)

- [ ] **Step 1: Verify SKILL.md exists at correct path**

Path: `extensions/agentic-harness/skills/agentic-brainstorming/SKILL.md`

- [ ] **Step 2: Verify all required sections present**

Run: Read the file and check for all 8 sections listed above

- [ ] **Step 3: Verify trigger phrases in description**

The description must include: "brainstorm", "아이디어", "아이디어 정리", "생각을 정리하고 싶어", "무엇이든 떠오르는 대로"

- [ ] **Step 4: Verify Q&A process is concrete**

Each phase must have actual example questions (not placeholders)

- [ ] **Step 5: Verify output format is copy-paste ready**

The relationship diagram syntax must be complete and valid
