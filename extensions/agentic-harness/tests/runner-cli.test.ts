// tests/runner-cli.test.ts
import { describe, it, expect } from "vitest";
import { parseInheritedCliArgs } from "../runner-cli.js";

describe("parseInheritedCliArgs", () => {
  it("should skip session-specific flags", () => {
    const argv = ["node", "pi", "--mode", "json", "-p", "--no-session", "--session", "foo"];
    const result = parseInheritedCliArgs(argv);
    expect(result.alwaysProxy).not.toContain("--mode");
    expect(result.alwaysProxy).not.toContain("json");
    expect(result.alwaysProxy).not.toContain("-p");
    expect(result.alwaysProxy).not.toContain("--no-session");
  });

  it("should capture --model as fallback", () => {
    const argv = ["node", "pi", "--model", "claude-sonnet"];
    const result = parseInheritedCliArgs(argv);
    expect(result.fallbackModel).toBe("claude-sonnet");
    expect(result.alwaysProxy).not.toContain("--model");
  });

  it("should capture --tools as fallback", () => {
    const argv = ["node", "pi", "--tools", "read,edit,bash"];
    const result = parseInheritedCliArgs(argv);
    expect(result.fallbackTools).toBe("read,edit,bash");
  });

  it("should proxy --extension with path", () => {
    const argv = ["node", "pi", "--extension", "/abs/path/ext"];
    const result = parseInheritedCliArgs(argv);
    expect(result.extensionArgs).toContain("--extension");
    expect(result.extensionArgs).toContain("/abs/path/ext");
  });

  it("should proxy --provider verbatim", () => {
    const argv = ["node", "pi", "--provider", "anthropic"];
    const result = parseInheritedCliArgs(argv);
    expect(result.alwaysProxy).toContain("--provider");
    expect(result.alwaysProxy).toContain("anthropic");
  });

  it("should proxy --api-key verbatim", () => {
    const argv = ["node", "pi", "--api-key", "sk-123"];
    const result = parseInheritedCliArgs(argv);
    expect(result.alwaysProxy).toContain("--api-key");
    expect(result.alwaysProxy).toContain("sk-123");
  });

  it("should handle --no-tools flag", () => {
    const argv = ["node", "pi", "--no-tools"];
    const result = parseInheritedCliArgs(argv);
    expect(result.fallbackNoTools).toBe(true);
  });

  it("should handle empty argv", () => {
    const argv = ["node", "pi"];
    const result = parseInheritedCliArgs(argv);
    expect(result.extensionArgs).toEqual([]);
    expect(result.alwaysProxy).toEqual([]);
    expect(result.fallbackModel).toBeUndefined();
  });

  it("should proxy --skill with path", () => {
    const argv = ["node", "pi", "--skill", "/path/to/skill"];
    const result = parseInheritedCliArgs(argv);
    expect(result.alwaysProxy).toContain("--skill");
  });

  it("should capture --thinking as fallback", () => {
    const argv = ["node", "pi", "--thinking", "enabled"];
    const result = parseInheritedCliArgs(argv);
    expect(result.fallbackThinking).toBe("enabled");
  });
});
