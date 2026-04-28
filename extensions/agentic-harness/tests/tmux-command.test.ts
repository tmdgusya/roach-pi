import { describe, expect, it } from "vitest";
import { buildTmuxShellCommand } from "../subagent.js";

// Regression guard: literal LF (0x0A) bytes inside a tmux send-keys payload
// are interpreted by the pane pty as Enter. If buildTmuxShellCommand ever
// produces a payload that contains a raw control byte (because shellQuote
// stops escaping them, or because the function adds a literal newline of its
// own), tmux backend runs will desync mid-command. These tests fail fast if
// either regression is reintroduced.
describe("buildTmuxShellCommand", () => {
  it("never emits raw control bytes when args contain newlines", () => {
    const multilineTask = [
      "# Team Worker Assignment",
      "",
      "Team goal: explore resource leaks in team mode",
      "",
      "## Runtime rules",
      "- Do not orchestrate.",
      "- Report concrete evidence.",
    ].join("\n");

    const cmd = buildTmuxShellCommand({
      command: "/usr/local/bin/pi",
      args: ["--mode", "json", "--task", multilineTask],
      cwd: "/Users/test/with space/proj",
      env: { PI_TEAM_WORKER: "1", PI_SUBAGENT_MAX_DEPTH: "1" },
    });

    expect(/[\x00-\x1f\x7f]/.test(cmd)).toBe(false);
    // The multi-line task content survives as escape sequences, not raw bytes.
    expect(cmd).toContain("$'");
    expect(cmd).toContain("\\n");
  });

  it("never emits raw control bytes when env values contain newlines", () => {
    const cmd = buildTmuxShellCommand({
      command: "/usr/local/bin/pi",
      args: [],
      cwd: "/tmp",
      env: { MULTILINE_VAR: "line1\nline2\nline3" },
    });

    expect(/[\x00-\x1f\x7f]/.test(cmd)).toBe(false);
    expect(cmd).toContain("MULTILINE_VAR=$'line1\\nline2\\nline3'");
  });

  it("preserves printf exit-marker payload as literal escape sequence (not Enter keys)", () => {
    const cmd = buildTmuxShellCommand({
      command: "true",
      args: [],
      cwd: "/tmp",
      env: {},
    });

    // The printf format must contain the escape sequence "\n" as the two
    // characters (backslash + n), so the shell — not tmux — interprets it
    // as a newline at runtime.
    expect(cmd).toContain("printf '\\n__PI_TMUX_EXIT:%s\\n'");
    expect(/[\x00-\x1f\x7f]/.test(cmd)).toBe(false);
  });

  it("keeps simple POSIX quoting when no control characters are present", () => {
    const cmd = buildTmuxShellCommand({
      command: "/bin/echo",
      args: ["hello", "world"],
      cwd: "/tmp",
      env: { FOO: "bar" },
    });

    expect(cmd).not.toContain("$'");
    expect(cmd).toContain("'/bin/echo'");
    expect(cmd).toContain("'hello'");
    expect(cmd).toContain("FOO='bar'");
  });
});
