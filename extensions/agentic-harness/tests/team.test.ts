import { describe, expect, it } from "vitest";
import {
  PI_TEAM_WORKER_ENV,
  buildTeamWorkerPrompt,
  createDefaultTeamTasks,
  formatTeamRunSummary,
  runTeam,
  synthesizeTeamRun,
} from "../team.js";
import { MAX_PARALLEL_TASKS } from "../subagent.js";
import { emptyUsage, type SingleResult } from "../types.js";

function result(agent: string, task: string, text: string, exitCode = 0): SingleResult {
  return {
    agent,
    agentSource: "bundled",
    task,
    exitCode,
    messages: exitCode === 0 ? [{ role: "assistant", content: [{ type: "text", text }] }] : [],
    stderr: exitCode === 0 ? "" : text,
    usage: emptyUsage(),
    stopReason: exitCode === 0 ? undefined : "error",
    errorMessage: exitCode === 0 ? undefined : text,
  };
}

describe("createDefaultTeamTasks", () => {
  it("creates stable dependency-free tasks with owners and selected agent", () => {
    const tasks = createDefaultTeamTasks("ship team mode", 2, "planner");

    expect(tasks.map((task) => task.id)).toEqual(["task-1", "task-2"]);
    expect(tasks.map((task) => task.owner)).toEqual(["worker-1", "worker-2"]);
    expect(tasks.every((task) => task.agent === "planner")).toBe(true);
    expect(tasks.every((task) => task.status === "pending")).toBe(true);
    expect(tasks.every((task) => task.blockedBy.length === 0)).toBe(true);
  });

  it("clamps worker count to MAX_PARALLEL_TASKS", () => {
    expect(createDefaultTeamTasks("many lanes", MAX_PARALLEL_TASKS + 4).length).toBe(MAX_PARALLEL_TASKS);
  });
});

describe("buildTeamWorkerPrompt", () => {
  it("contains worker non-orchestration protocol and reporting requirements", () => {
    const task = createDefaultTeamTasks("demo", 1)[0];
    const prompt = buildTeamWorkerPrompt(task, { goal: "demo", workerCount: 1 });

    expect(prompt).toContain("not the team leader");
    expect(prompt).toContain("Do not spawn subagents");
    expect(prompt).toContain("Do not run team, ultrawork, autopilot, ralph");
    expect(prompt).toContain("Changed files");
    expect(prompt).toContain("Verification commands/results");
    expect(prompt).toContain("Blockers/risks");
  });
});

describe("synthesis", () => {
  it("reports success only when every task completed", () => {
    const tasks = createDefaultTeamTasks("green path", 2);
    tasks[0].status = "completed";
    tasks[0].resultSummary = "first done";
    tasks[1].status = "completed";
    tasks[1].resultSummary = "second done";
    const summary = synthesizeTeamRun("green path", tasks, [result("worker", "a", "ok"), result("worker", "b", "ok")]);

    expect(summary.success).toBe(true);
    expect(summary.completedCount).toBe(2);
    expect(summary.failedCount).toBe(0);
    expect(summary.verificationEvidence.checksRun).toHaveLength(2);
    expect(formatTeamRunSummary(summary)).toContain("Structured verification evidence");
  });

  it("reports failure if any worker failed", () => {
    const tasks = createDefaultTeamTasks("partial", 2);
    tasks[0].status = "completed";
    tasks[1].status = "failed";
    tasks[1].errorMessage = "boom";
    const summary = synthesizeTeamRun("partial", tasks, [result("worker", "a", "ok"), result("worker", "b", "boom", 1)]);

    expect(summary.success).toBe(false);
    expect(summary.failedCount).toBe(1);
    expect(summary.finalSynthesis).toContain("finished with failures");
    expect(summary.verificationEvidence.failed[0]).toContain("boom");
  });
});

describe("runTeam", () => {
  it("executes an injectable e2e-style parallel team run", async () => {
    const calls: Array<{ prompt: string; extraEnv: Record<string, string> }> = [];
    const summary = await runTeam({ goal: "fake demo", workerCount: 2 }, {
      findAgent: (name) => ({ name, description: "fake", systemPrompt: "", source: "bundled", filePath: "/fake" }),
      runTask: async (input) => {
        calls.push({ prompt: input.prompt, extraEnv: input.extraEnv });
        return result(input.agentName, input.prompt, `${input.task.id} done`);
      },
    });

    expect(calls).toHaveLength(2);
    expect(calls.every((call) => call.extraEnv[PI_TEAM_WORKER_ENV] === "1")).toBe(true);
    expect(calls.every((call) => call.extraEnv.PI_SUBAGENT_MAX_DEPTH === "1")).toBe(true);
    expect(summary.success).toBe(true);
    expect(summary.verificationEvidence.passed).toHaveLength(2);
  });

  it("keeps overall status failed when one fake worker fails", async () => {
    const summary = await runTeam({ goal: "failure demo", workerCount: 2 }, {
      findAgent: (name) => ({ name, description: "fake", systemPrompt: "", source: "bundled", filePath: "/fake" }),
      runTask: async (input, index) => result(input.agentName, input.prompt, index === 0 ? "ok" : "failed", index === 0 ? 0 : 1),
    });

    expect(summary.success).toBe(false);
    expect(summary.completedCount).toBe(1);
    expect(summary.failedCount).toBe(1);
    expect(summary.verificationEvidence.failed).toHaveLength(1);
  });
});
