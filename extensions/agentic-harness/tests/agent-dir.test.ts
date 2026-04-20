import { describe, expect, it } from "vitest";
import { resolvePiAgentDir } from "../index.js";

describe("resolvePiAgentDir", () => {
  it("uses ~/.pi/agent when env var is unset", () => {
    expect(resolvePiAgentDir(undefined, "/Users/tester")).toBe("/Users/tester/.pi/agent");
  });

  it("expands '~' to home", () => {
    expect(resolvePiAgentDir("~", "/Users/tester")).toBe("/Users/tester");
  });

  it("expands '~/...' to home subpath", () => {
    expect(resolvePiAgentDir("~/.custom-agent", "/Users/tester")).toBe("/Users/tester/.custom-agent");
  });

  it("uses explicit absolute path as-is", () => {
    expect(resolvePiAgentDir("/tmp/pi-agent", "/Users/tester")).toBe("/tmp/pi-agent");
  });
});
