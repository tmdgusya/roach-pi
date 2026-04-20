import { describe, it, expect, vi } from "vitest";
import { resolveSandboxLaunch } from "../sandbox/executor.js";

describe("sandbox approval policy", () => {
  it("requires approval for user_bash commands when policy is enabled", async () => {
    const approvalResolver = vi.fn().mockResolvedValue({ approved: true, scope: "once" as const });

    const launch = await resolveSandboxLaunch({
      command: "bash",
      args: ["-lc", "git push"],
      cwd: "/repo",
      env: process.env,
      platform: process.platform,
      sandbox: {
        enabled: true,
        workspaceRoot: "/repo",
        networkMode: "on",
        requireApprovalForAllCommands: true,
        approvalMode: "ask",
        approvalResolver,
        approvalStore: {
          getApprovedScope: () => undefined,
          setApprovedScope: async () => undefined,
        },
      },
    });

    expect(approvalResolver).toHaveBeenCalledTimes(1);
    expect(launch.applied).toBe(false);
    expect(launch.command).toBe("bash");
  });

  it("blocks execution when user denies approval", async () => {
    const approvalResolver = vi.fn().mockResolvedValue({ approved: false });

    await expect(
      resolveSandboxLaunch({
        command: "bash",
        args: ["-lc", "npx vitest run"],
        cwd: "/repo",
        env: process.env,
        platform: process.platform,
        sandbox: {
          enabled: true,
          workspaceRoot: "/repo",
          networkMode: "on",
          requireApprovalForAllCommands: true,
          approvalMode: "ask",
          approvalResolver,
          approvalStore: {
            getApprovedScope: () => undefined,
            setApprovedScope: async () => undefined,
          },
        },
      }),
    ).rejects.toThrow("Command denied: explicit approval required.");
  });

  it("reuses session approval cache", async () => {
    const approvalResolver = vi.fn();

    const launch = await resolveSandboxLaunch({
      command: "bash",
      args: ["-lc", "git push"],
      cwd: "/repo",
      env: process.env,
      platform: process.platform,
      sandbox: {
        enabled: true,
        workspaceRoot: "/repo",
        networkMode: "on",
        requireApprovalForAllCommands: true,
        approvalMode: "ask",
        approvalResolver,
        approvalStore: {
          getApprovedScope: () => "session",
          setApprovedScope: async () => undefined,
        },
      },
    });

    expect(approvalResolver).not.toHaveBeenCalled();
    expect(launch.applied).toBe(false);
  });
});
