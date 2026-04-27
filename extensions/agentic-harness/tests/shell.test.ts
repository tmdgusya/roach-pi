import { describe, expect, it } from "vitest";
import { shellQuote } from "../shell.js";

describe("shellQuote", () => {
  it("quotes paths with spaces and shell metacharacters", () => {
    expect(shellQuote("/Users/John Doe/a;b&c`d$e.log")).toBe("'/Users/John Doe/a;b&c`d$e.log'");
  });

  it("escapes embedded single quotes", () => {
    expect(shellQuote("/tmp/it's.log")).toBe("'/tmp/it'\\''s.log'");
  });
});
