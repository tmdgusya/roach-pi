/**
 * Integration tests for stop/shutdown cleanup behavior.
 *
 * These tests verify the acceptance criteria from the harden-stop issue:
 * - `/autonomous-dev stop` aborts all in-flight workers
 * - session_shutdown stops polling and owned workers
 * - No post-stop mutations to status/history
 * - Logs clearly show stop -> worker abort -> cleanup completion
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AutonomousDevOrchestrator } from "../orchestrator.js";
import { AUTONOMOUS_LABELS } from "../types.js";

vi.mock("../logger.js", () => ({
  logAutonomousDev: vi.fn(),
}));

vi.mock("../github.js", async () => {
  const actual = await vi.importActual("../github.js");
  return {
    ...actual,
    listIssuesByLabel: vi.fn(),
    getIssueWithComments: vi.fn(),
    swapLabels: vi.fn(),
    addLabels: vi.fn(),
    removeLabels: vi.fn(),
    postComment: vi.fn(),
    lockIssue: vi.fn(),
    markNeedsClarification: vi.fn(),
    resumeFromClarification: vi.fn(),
  };
});

import {
  listIssuesByLabel,
  getIssueWithComments,
  swapLabels,
  postComment,
  lockIssue,
  markNeedsClarification,
  resumeFromClarification,
} from "../github.js";
import { logAutonomousDev } from "../logger.js";

const mockListIssues = listIssuesByLabel as unknown as ReturnType<typeof vi.fn>;
const mockGetIssue = getIssueWithComments as unknown as ReturnType<typeof vi.fn>;
const mockSwap = swapLabels as unknown as ReturnType<typeof vi.fn>;
const mockPostComment = postComment as unknown as ReturnType<typeof vi.fn>;
const mockLock = lockIssue as unknown as ReturnType<typeof vi.fn>;
const mockNeedsClarification = markNeedsClarification as unknown as ReturnType<typeof vi.fn>;
const mockResume = resumeFromClarification as unknown as ReturnType<typeof vi.fn>;
const mockLog = logAutonomousDev as unknown as ReturnType<typeof vi.fn>;

// Helper: get all logged event names in order
function getLoggedEvents(): string[] {
  return mockLog.mock.calls.map((call: any[]) => call[1]);
}

describe("stop/shutdown cleanup hardening", () => {
  let orchestrator: AutonomousDevOrchestrator;
  let workerSpawner: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    mockListIssues.mockResolvedValue([]);
    mockGetIssue.mockResolvedValue({
      issue: { number: 0, title: "", body: "", labels: [], author: "", createdAt: "" },
      comments: [],
    });
    mockSwap.mockResolvedValue(undefined);
    mockPostComment.mockResolvedValue(undefined);
    mockLock.mockResolvedValue(undefined);
    mockNeedsClarification.mockResolvedValue(undefined);
    mockResume.mockResolvedValue(undefined);

    workerSpawner = vi.fn().mockResolvedValue({
      status: "completed",
      prUrl: "https://github.com/owner/repo/pull/1",
      summary: "Done",
    });

    orchestrator = new AutonomousDevOrchestrator({
      repo: "owner/repo",
      pollIntervalMs: 60_000,
      maxClarificationRounds: 3,
    });
    orchestrator.setWorkerSpawner(workerSpawner);
  });

  afterEach(() => {
    vi.useRealTimers();
    orchestrator.stop();
  });

  // ========================================================
  // Acceptance: stop() aborts all in-flight workers
  // ========================================================

  describe("stop aborts all in-flight workers", () => {
    it("returns a StopResult reporting aborted workers", async () => {
      let markWorkerStarted: (() => void) | null = null;
      const workerStarted = new Promise<void>((resolve) => {
        markWorkerStarted = resolve;
      });
      let resolveWorker1: ((value: any) => void) | null = null;

      workerSpawner.mockImplementationOnce(async (_issueNumber, _config, _onActivity, signal) => {
        markWorkerStarted?.();
        return new Promise((resolve) => { resolveWorker1 = resolve; });
      });

      mockListIssues.mockResolvedValueOnce([
        { number: 101, title: "Issue A", body: "", labels: [AUTONOMOUS_LABELS.READY], author: "alice", createdAt: "2026-04-01T00:00:00Z" },
      ]);

      const poll1 = orchestrator.pollCycle();
      await workerStarted;

      const result = orchestrator.stop();
      resolveWorker1?.({ status: "completed", prUrl: "https://github.com/owner/repo/pull/1", summary: "Ignored" });
      await poll1;

      expect(result.workersAborted).toBe(1);
      expect(result.abortedIssueNumbers).toContain(101);
      expect(result.pollingStopped).toBe(false); // was never started with setInterval
    });

    it("aborts first worker and prevents remaining issues from being picked up", async () => {
      // Workers are spawned sequentially in pickupReadyIssues.
      // Stop during the first worker should prevent the second issue
      // from being locked and processed.
      let resolveWorker1: ((value: any) => void) | null = null;
      let markWorker1Started: (() => void) | null = null;
      const worker1Started = new Promise<void>((resolve) => {
        markWorker1Started = resolve;
      });

      workerSpawner.mockImplementationOnce(async () => {
        markWorker1Started?.();
        return new Promise((resolve) => { resolveWorker1 = resolve; });
      });

      mockListIssues.mockResolvedValueOnce([
        { number: 201, title: "First", body: "", labels: [AUTONOMOUS_LABELS.READY], author: "a", createdAt: "2026-04-01T00:00:00Z" },
        { number: 202, title: "Second", body: "", labels: [AUTONOMOUS_LABELS.READY], author: "b", createdAt: "2026-04-01T00:00:00Z" },
      ]);

      const pollPromise = orchestrator.pollCycle();
      await worker1Started;

      const result = orchestrator.stop();
      resolveWorker1?.({ status: "completed", prUrl: "", summary: "" });
      await pollPromise;

      // First worker was aborted
      expect(result.workersAborted).toBeGreaterThanOrEqual(1);
      expect(result.abortedIssueNumbers).toContain(201);

      // Second issue should NOT have been locked or processed
      expect(mockLock).toHaveBeenCalledTimes(1);
      expect(mockLock).toHaveBeenCalledWith("owner/repo", 201);
      expect(workerSpawner).toHaveBeenCalledTimes(1);

      // No label swaps at all
      expect(mockSwap).not.toHaveBeenCalled();
    });
  });

  // ========================================================
  // Acceptance: no post-stop status mutations
  // ========================================================

  describe("no post-stop status mutations", () => {
    it("prevents worker activity callback from mutating status after stop", async () => {
      let capturedOnActivity: ((activity: string) => void) | undefined;
      let resolveWorker: ((value: any) => void) | null = null;
      let markWorkerStarted: (() => void) | null = null;
      const workerStarted = new Promise<void>((resolve) => {
        markWorkerStarted = resolve;
      });

      workerSpawner.mockImplementationOnce(async (_issueNumber, _config, onActivity, signal) => {
        capturedOnActivity = onActivity;
        markWorkerStarted?.();
        return new Promise((resolve) => { resolveWorker = resolve; });
      });

      mockListIssues.mockResolvedValueOnce([
        { number: 42, title: "Post-stop test", body: "", labels: [AUTONOMOUS_LABELS.READY], author: "alice", createdAt: "2026-04-01T00:00:00Z" },
      ]);

      const pollPromise = orchestrator.pollCycle();
      await workerStarted;

      orchestrator.stop();

      // Activity callback after stop should be silently ignored
      capturedOnActivity?.("read src/post-stop-file.ts");

      resolveWorker?.({ status: "completed", prUrl: "https://github.com/owner/repo/pull/1", summary: "Should be discarded" });
      await pollPromise;

      const status = orchestrator.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.currentActivity).toBe("stopped");
      expect(status.recentActivities.some((a) => a.text.includes("post-stop-file"))).toBe(false);
      // No completion/failure should have occurred
      expect(mockSwap).not.toHaveBeenCalled();
      expect(mockPostComment).not.toHaveBeenCalled();
    });

    it("prevents worker result from being processed after stop", async () => {
      let resolveWorker: ((value: any) => void) | null = null;
      let markWorkerStarted: (() => void) | null = null;
      const workerStarted = new Promise<void>((resolve) => {
        markWorkerStarted = resolve;
      });

      workerSpawner.mockImplementationOnce(async () => {
        markWorkerStarted?.();
        return new Promise((resolve) => { resolveWorker = resolve; });
      });

      mockListIssues.mockResolvedValueOnce([
        { number: 99, title: "Discard result", body: "", labels: [AUTONOMOUS_LABELS.READY], author: "alice", createdAt: "2026-04-01T00:00:00Z" },
      ]);

      const pollPromise = orchestrator.pollCycle();
      await workerStarted;

      orchestrator.stop();

      // Worker resolves with a result after stop
      resolveWorker?.({ status: "completed", prUrl: "https://github.com/owner/repo/pull/1", summary: "Discarded" });
      await pollPromise;

      // Result should be discarded — no label swap, no comment
      expect(mockSwap).not.toHaveBeenCalled();
      expect(mockPostComment).not.toHaveBeenCalled();

      const events = getLoggedEvents();
      expect(events).toContain("worker.aborted");

      // Verify the aborted log contains "Discarding" message
      const abortedCalls = mockLog.mock.calls.filter((call: any[]) => call[1] === "worker.aborted");
      expect(abortedCalls.length).toBeGreaterThanOrEqual(1);
      const abortedEntry = abortedCalls[0][2];
      expect(abortedEntry.message).toContain("Discarding");
    });
  });

  // ========================================================
  // Acceptance: stopAndWait waits for workers to settle
  // ========================================================

  describe("stopAndWait", () => {
    it("waits for in-flight worker promises to settle", async () => {
      let resolveWorker: ((value: any) => void) | null = null;
      let markWorkerStarted: (() => void) | null = null;
      const workerStarted = new Promise<void>((resolve) => {
        markWorkerStarted = resolve;
      });

      workerSpawner.mockImplementationOnce(async () => {
        markWorkerStarted?.();
        return new Promise((resolve) => { resolveWorker = resolve; });
      });

      mockListIssues.mockResolvedValueOnce([
        { number: 55, title: "Slow worker", body: "", labels: [AUTONOMOUS_LABELS.READY], author: "alice", createdAt: "2026-04-01T00:00:00Z" },
      ]);

      const pollPromise = orchestrator.pollCycle();
      await workerStarted;

      const stopPromise = orchestrator.stopAndWait(5_000);

      // Resolve the worker after a tick
      resolveWorker?.({ status: "completed", prUrl: "", summary: "" });

      const result = await stopPromise;
      await pollPromise;

      expect(result.workersAborted).toBe(1);
      expect(result.abortedIssueNumbers).toContain(55);
    });

    it("times out if worker does not settle within timeout", async () => {
      let markWorkerStarted: (() => void) | null = null;
      const workerStarted = new Promise<void>((resolve) => {
        markWorkerStarted = resolve;
      });

      // Worker that never resolves
      workerSpawner.mockImplementationOnce(async () => {
        markWorkerStarted?.();
        return new Promise(() => {}); // never resolves
      });

      mockListIssues.mockResolvedValueOnce([
        { number: 66, title: "Stuck worker", body: "", labels: [AUTONOMOUS_LABELS.READY], author: "alice", createdAt: "2026-04-01T00:00:00Z" },
      ]);

      const pollPromise = orchestrator.pollCycle();
      await workerStarted;

      const stopPromise = orchestrator.stopAndWait(1_000);

      // Advance past timeout
      vi.advanceTimersByTime(1_500);

      const result = await stopPromise;
      // stopAndWait should still return even if worker didn't settle
      expect(result.workersAborted).toBe(1);
    });
  });

  // ========================================================
  // Acceptance: clear log sequence stop -> abort -> complete
  // ========================================================

  describe("log sequence: stop → worker abort → cleanup complete", () => {
    it("emits engine.stop, worker.abort_sent, and engine.stop.complete in order", async () => {
      let resolveWorker: ((value: any) => void) | null = null;
      let markWorkerStarted: (() => void) | null = null;
      const workerStarted = new Promise<void>((resolve) => {
        markWorkerStarted = resolve;
      });

      workerSpawner.mockImplementationOnce(async () => {
        markWorkerStarted?.();
        return new Promise((resolve) => { resolveWorker = resolve; });
      });

      mockListIssues.mockResolvedValueOnce([
        { number: 77, title: "Logging test", body: "", labels: [AUTONOMOUS_LABELS.READY], author: "alice", createdAt: "2026-04-01T00:00:00Z" },
      ]);

      const pollPromise = orchestrator.pollCycle();
      await workerStarted;

      orchestrator.stop();
      resolveWorker?.({ status: "completed", prUrl: "", summary: "" });
      await pollPromise;

      const events = getLoggedEvents();

      const stopIdx = events.indexOf("engine.stop");
      const abortIdx = events.indexOf("worker.abort_sent");
      const completeIdx = events.indexOf("engine.stop.complete");

      expect(stopIdx).toBeGreaterThanOrEqual(0);
      expect(abortIdx).toBeGreaterThanOrEqual(0);
      expect(completeIdx).toBeGreaterThanOrEqual(0);

      // Verify ordering: stop -> abort -> complete
      expect(stopIdx).toBeLessThan(completeIdx);
      expect(abortIdx).toBeLessThan(completeIdx);
    });

    it("emits engine.stop.complete even when no workers are active", () => {
      orchestrator.stop();

      const events = getLoggedEvents();
      expect(events).toContain("engine.stop");
      expect(events).toContain("engine.stop.complete");
    });

    it("logs workersAborted count in engine.stop event", async () => {
      let resolveWorker: ((value: any) => void) | null = null;
      let markWorkerStarted: (() => void) | null = null;
      const workerStarted = new Promise<void>((resolve) => {
        markWorkerStarted = resolve;
      });

      workerSpawner.mockImplementationOnce(async () => {
        markWorkerStarted?.();
        return new Promise((resolve) => { resolveWorker = resolve; });
      });

      mockListIssues.mockResolvedValueOnce([
        { number: 88, title: "Count test", body: "", labels: [AUTONOMOUS_LABELS.READY], author: "alice", createdAt: "2026-04-01T00:00:00Z" },
      ]);

      const pollPromise = orchestrator.pollCycle();
      await workerStarted;

      const result = orchestrator.stop();
      resolveWorker?.({ status: "completed", prUrl: "", summary: "" });
      await pollPromise;

      const stopLog = mockLog.mock.calls.find((call: any[]) => call[1] === "engine.stop");
      expect(stopLog).toBeDefined();
      const stopEntry = stopLog![2];
      expect(stopEntry.details).toMatchObject({
        workersAborted: result.workersAborted,
        abortedIssueNumbers: result.abortedIssueNumbers,
      });
    });
  });

  // ========================================================
  // Acceptance: stop clears tracked issues
  // ========================================================

  describe("tracked issue cleanup", () => {
    it("clears all tracked issues on stop", async () => {
      let resolveWorker1: ((value: any) => void) | null = null;
      let markWorkerStarted: (() => void) | null = null;
      const workerStarted = new Promise<void>((resolve) => {
        markWorkerStarted = resolve;
      });

      workerSpawner.mockImplementationOnce(async () => {
        markWorkerStarted?.();
        return new Promise((resolve) => { resolveWorker1 = resolve; });
      });

      mockListIssues.mockResolvedValueOnce([
        { number: 301, title: "Tracked", body: "", labels: [AUTONOMOUS_LABELS.READY], author: "alice", createdAt: "2026-04-01T00:00:00Z" },
      ]);

      const pollPromise = orchestrator.pollCycle();
      await workerStarted;

      const statusBefore = orchestrator.getStatus();
      expect(statusBefore.trackedIssues.length).toBeGreaterThanOrEqual(1);

      const result = orchestrator.stop();
      resolveWorker1?.({ status: "completed", prUrl: "", summary: "" });
      await pollPromise;

      expect(result.trackedIssuesCleared).toBe(true);
      const statusAfter = orchestrator.getStatus();
      expect(statusAfter.trackedIssues).toHaveLength(0);
    });

    it("reports trackedIssuesCleared=false when nothing was tracked", () => {
      const result = orchestrator.stop();
      expect(result.trackedIssuesCleared).toBe(false);
    });
  });

  // ========================================================
  // Acceptance: start after stop resets cleanly
  // ========================================================

  describe("restart after stop", () => {
    it("can start a new engine after stop with fresh state", async () => {
      let resolveWorker: ((value: any) => void) | null = null;
      let markWorkerStarted: (() => void) | null = null;
      const workerStarted = new Promise<void>((resolve) => {
        markWorkerStarted = resolve;
      });

      workerSpawner.mockImplementationOnce(async () => {
        markWorkerStarted?.();
        return new Promise((resolve) => { resolveWorker = resolve; });
      });

      mockListIssues.mockResolvedValueOnce([
        { number: 400, title: "Before stop", body: "", labels: [AUTONOMOUS_LABELS.READY], author: "alice", createdAt: "2026-04-01T00:00:00Z" },
      ]);

      const poll1 = orchestrator.pollCycle();
      await workerStarted;
      orchestrator.stop();
      // Resolve after stop — result discarded
      resolveWorker?.({ status: "completed", prUrl: "", summary: "" });
      await poll1;

      // Verify clean state
      const stoppedStatus = orchestrator.getStatus();
      expect(stoppedStatus.isRunning).toBe(false);
      expect(stoppedStatus.trackedIssues).toHaveLength(0);
      expect(stoppedStatus.activeWorkerCount).toBe(0);

      // Restart with fresh worker
      workerSpawner.mockImplementationOnce(async () => ({
        status: "completed",
        prUrl: "https://github.com/owner/repo/pull/2",
        summary: "After restart",
      }));
      mockListIssues.mockResolvedValueOnce([
        { number: 401, title: "After restart", body: "", labels: [AUTONOMOUS_LABELS.READY], author: "bob", createdAt: "2026-04-01T00:00:00Z" },
      ]);

      await orchestrator.pollCycle();

      // New worker should have run successfully
      expect(workerSpawner).toHaveBeenCalledTimes(2);
      expect(mockSwap).toHaveBeenCalledWith(
        "owner/repo",
        401,
        expect.any(Array),
        expect.arrayContaining([AUTONOMOUS_LABELS.COMPLETED])
      );
    });
  });

  // ========================================================
  // Acceptance: poll cycle discarded after stop
  // ========================================================

  describe("poll cycle gating after stop", () => {
    it("discards poll cycle results after stop increments runToken", async () => {
      let blockListIssues: (() => void) | null = null;
      let resolveWorker: ((value: any) => void) | null = null;

      // First call blocks (finds an issue)
      mockListIssues.mockImplementationOnce(
        () => new Promise((resolve) => {
          resolve([
            { number: 500, title: "During stop", body: "", labels: [AUTONOMOUS_LABELS.READY], author: "alice", createdAt: "2026-04-01T00:00:00Z" },
          ]);
        })
      );

      workerSpawner.mockImplementationOnce(async () => {
        return new Promise((resolve) => { resolveWorker = resolve; });
      });

      const pollPromise = orchestrator.pollCycle();

      // Wait for the poll to start processing the issue
      await vi.advanceTimersByTimeAsync(10);

      // Stop while worker is in-flight
      orchestrator.stop();

      // Resolve the worker
      resolveWorker?.({ status: "completed", prUrl: "", summary: "" });
      await pollPromise;

      // Status should be "stopped"
      const status = orchestrator.getStatus();
      expect(status.currentActivity).toBe("stopped");
      expect(status.isRunning).toBe(false);
      // No swap should have happened (result discarded)
      expect(mockSwap).not.toHaveBeenCalled();
    });
  });

  // ========================================================
  // Acceptance: stop is idempotent
  // ========================================================

  describe("stop idempotency", () => {
    it("calling stop multiple times is safe", () => {
      const result1 = orchestrator.stop();
      const result2 = orchestrator.stop();
      const result3 = orchestrator.stop();

      expect(result1.pollingStopped).toBe(false);
      expect(result2.workersAborted).toBe(0);
      expect(result3.workersAborted).toBe(0);
    });
  });
});
