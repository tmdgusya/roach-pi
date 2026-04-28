import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { AgentConfig } from "../agents.js";
import { resolveDepthConfig, runAgent } from "../subagent.js";
import { runTeam } from "../team.js";

describe.runIf(process.platform !== "win32")("team mode tmux e2e", () => {
  it("runs team backend=tmux end-to-end without leaking env values in send-keys payload", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "team-e2e-tmux-"));
    const runnerScript = join(tempDir, "runner.mjs");
    const fakeTmux = join(tempDir, "tmux");
    const callsFile = join(tempDir, "tmux-calls.log");
    const tmuxStateFile = join(tempDir, "tmux-state.json");

    writeFileSync(runnerScript, [
      "const message = { role: 'assistant', content: [{ type: 'text', text: 'team worker done' }] };",
      "console.log(JSON.stringify({ type: 'message_end', message }));",
      "console.log(JSON.stringify({ type: 'agent_end', messages: [message] }));",
    ].join("\n"));

    writeFileSync(fakeTmux, [
      `#!${process.execPath}`,
      "const { appendFileSync, existsSync, readFileSync, writeFileSync } = require('fs');",
      "const { spawnSync } = require('child_process');",
      "const args = process.argv.slice(2);",
      `const callsFile = ${JSON.stringify(callsFile)};`,
      `const stateFile = ${JSON.stringify(tmuxStateFile)};`,
      "const load = () => existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : { nextPane: 1, paneLogs: {} };",
      "const save = (state) => writeFileSync(stateFile, JSON.stringify(state), 'utf8');",
      "appendFileSync(callsFile, process.argv[1] + ' ' + args.join(' ') + '\\n');",
      "if (args[0] === 'new-session') {",
      "  const state = load();",
      "  const pane = `%${state.nextPane++}`;",
      "  save(state);",
      "  process.stdout.write(`${pane}\\n`);",
      "  process.exit(0);",
      "}",
      "if (args[0] === 'split-window') {",
      "  const state = load();",
      "  const pane = `%${state.nextPane++}`;",
      "  save(state);",
      "  process.stdout.write(`${pane}\\n`);",
      "  process.exit(0);",
      "}",
      "if (args[0] === 'pipe-pane') {",
      "  const state = load();",
      "  const pane = args[args.indexOf('-t') + 1];",
      "  const cmd = args[args.length - 1] || '';",
      "  const match = cmd.match(/cat\\s*>>\\s*(.+)$/);",
      "  let logFile = match ? match[1].trim() : '';",
      "  if ((logFile.startsWith(\"'\") && logFile.endsWith(\"'\")) || (logFile.startsWith('\"') && logFile.endsWith('\"'))) logFile = logFile.slice(1, -1);",
      "  state.paneLogs[pane] = logFile;",
      "  save(state);",
      "  process.exit(0);",
      "}",
      "if (args[0] === 'send-keys') {",
      "  const state = load();",
      "  const pane = args[args.indexOf('-t') + 1];",
      "  const command = args[args.length - 2];",
      "  const result = spawnSync('/bin/sh', ['-lc', command], { encoding: 'utf8' });",
      "  const logFile = state.paneLogs[pane];",
      "  if (logFile) appendFileSync(logFile, (result.stdout || '') + (result.stderr || ''));",
      "  process.exit(result.status ?? 0);",
      "}",
      "if (args[0] === 'select-layout' || args[0] === 'kill-session' || args[0] === 'kill-pane') process.exit(0);",
      "process.exit(0);",
    ].join("\n"));
    chmodSync(fakeTmux, 0o755);

    const fixtureAgent: AgentConfig = {
      name: "worker",
      description: "fixture worker",
      source: "project",
      filePath: runnerScript,
      systemPrompt: "",
      tools: [],
    };

    const originalPath = process.env.PATH;
    const originalArgv = process.argv;
    const originalTmux = process.env.TMUX;
    const originalTmuxPane = process.env.TMUX_PANE;
    process.env.PATH = `${tempDir}:${originalPath || ""}`;
    delete process.env.TMUX;
    delete process.env.TMUX_PANE;
    process.argv = [process.execPath, runnerScript];

    try {
      const summary = await runTeam(
        {
          goal: "verify tmux team e2e",
          workerCount: 1,
          agent: "worker",
          backend: "tmux",
          runId: "team-e2e-tmux",
        },
        {
          findAgent: () => fixtureAgent,
          runTask: (input) => runAgent({
            agent: input.agent,
            agentName: input.agentName,
            task: input.prompt,
            cwd: tempDir,
            depthConfig: resolveDepthConfig(),
            ownership: { runId: "team-e2e-worker", owner: "test-suite" },
            executionMode: input.task.terminal?.backend === "tmux" ? "tmux" : "native",
            tmuxPane: input.task.terminal?.backend === "tmux"
              ? {
                sessionName: input.task.terminal.sessionName!,
                windowName: input.task.terminal.windowName!,
                paneId: input.task.terminal.paneId!,
                logFile: input.task.terminal.logFile!,
                attachCommand: input.task.terminal.attachCommand!,
                tmuxBinary: input.task.terminal.tmuxBinary,
                sessionAttempt: input.task.terminal.sessionAttempt,
              }
              : undefined,
            extraEnv: {
              ...input.extraEnv,
              PI_DEBUG_SECRET: "super-secret-token-value",
            },
            makeDetails: (results) => ({ mode: "single", results }),
          }),
        },
      );

      expect(summary.success).toBe(true);
      expect(summary.backendUsed).toBe("tmux");
      expect(summary.tasks).toHaveLength(1);
      expect(summary.tasks[0].status).toBe("completed");
      expect(summary.finalSynthesis).toContain("tmux attach -t");

      const calls = readFileSync(callsFile, "utf8");
      expect(calls).toContain("send-keys -t");
      expect(calls).not.toContain("super-secret-token-value");
    } finally {
      process.env.PATH = originalPath;
      if (originalTmux === undefined) delete process.env.TMUX;
      else process.env.TMUX = originalTmux;
      if (originalTmuxPane === undefined) delete process.env.TMUX_PANE;
      else process.env.TMUX_PANE = originalTmuxPane;
      process.argv = originalArgv;
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
