import {
  OrchestratorConfig,
  DEFAULT_CONFIG,
  OrchestratorStatus,
  WorkerResult,
  WorkerActivityCallback,
  WorkerAbortSignal,
  AUTONOMOUS_LABELS,
  StopResult,
} from "./types.js";
import {
  listIssuesByLabel,
  getIssueWithComments,
  swapLabels,
  postComment,
  lockIssue,
  markNeedsClarification,
  resumeFromClarification,
} from "./github.js";
import { logAutonomousDev } from "./logger.js";

/**
 * States in the issue processing lifecycle
 */
type IssueState =
  | "ready"
  | "processing"
  | "clarifying"
  | "complete"
  | "failed";

interface TrackedIssueState {
  issueNumber: number;
  title: string;
  state: IssueState;
  clarificationRound: number;
  clarificationQuestionTimestamp: string | null;
  lockedAt: Date;
}

async function stubWorkerSpawn(
  _issueNumber: number,
  _config: OrchestratorConfig,
  _onActivity?: WorkerActivityCallback,
  _signal?: WorkerAbortSignal
): Promise<WorkerResult> {
  return {
    status: "completed",
    prUrl: "https://github.com/example/repo/pull/123",
    summary: "Implemented feature via stub",
  };
}

function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { value: String(error) };
}

export class AutonomousDevOrchestrator {
  private config: OrchestratorConfig;
  private status: OrchestratorStatus;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private trackedIssues: Map<number, TrackedIssueState> = new Map();
  private runToken = 0;
  private activeWorkerControllers: Map<number, AbortController> = new Map();
  private workerSpawner: (
    issueNumber: number,
    config: OrchestratorConfig,
    onActivity?: WorkerActivityCallback,
    signal?: WorkerAbortSignal
  ) => Promise<WorkerResult> = stubWorkerSpawn;

  /**
   * Set of currently in-flight worker promises, keyed by issue number.
   * Used to await graceful termination after abort.
   */
  private activeWorkerPromises: Map<number, Promise<void>> = new Map();

  /**
   * Guard flag: when true, all status mutations are suppressed.
   * Set during stop to prevent stale worker callbacks from corrupting state.
   */
  private statusFrozen = false;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.status = {
      isRunning: false,
      repo: this.config.repo,
      pollIntervalMs: this.config.pollIntervalMs,
      trackedIssues: [],
      stats: {
        totalProcessed: 0,
        totalCompleted: 0,
        totalFailed: 0,
        totalTimedOut: 0,
        totalClarificationAsked: 0,
      },
      lastPollStartedAt: null,
      lastPollCompletedAt: null,
      lastPollSucceededAt: null,
      lastError: null,
      lastErrorAt: null,
      currentActivity: "idle - waiting for work",
      currentIssueNumber: null,
      currentIssueTitle: null,
      activeWorkerCount: 0,
      recentActivities: [],
    };
    this.updateActivity("idle - waiting for work");
  }

  private logEvent(event: string, entry: {
    level?: "info" | "warn" | "error";
    issueNumber?: number;
    issueTitle?: string;
    message?: string;
    details?: Record<string, unknown>;
  } = {}): void {
    logAutonomousDev(entry.level ?? "info", event, {
      repo: this.config.repo || undefined,
      issueNumber: entry.issueNumber,
      issueTitle: entry.issueTitle,
      message: entry.message,
      details: entry.details,
    });
  }

  private updateActivity(activity: string, issueNumber: number | null = null, issueTitle: string | null = null): void {
    if (this.statusFrozen) return;
    this.status.currentActivity = activity;
    this.status.currentIssueNumber = issueNumber;
    this.status.currentIssueTitle = issueTitle;

    const issueLabel = issueNumber !== null
      ? issueTitle
        ? ` (#${issueNumber}: ${issueTitle})`
        : ` (#${issueNumber})`
      : "";
    const entry = `${activity}${issueLabel}`;
    const timestamp = new Date().toISOString();
    const recent = this.status.recentActivities.filter((item) => item.text !== entry);
    recent.unshift({ text: entry, timestamp });
    this.status.recentActivities = recent.slice(0, 3);
  }

  start(): void {
    if (this.status.isRunning) return;
    this.statusFrozen = false;
    this.status.isRunning = true;
    this.runToken++;
    this.logEvent("engine.start", {
      message: "Starting autonomous-dev polling loop",
      details: { pollIntervalMs: this.config.pollIntervalMs },
    });
    this.updateActivity("starting engine");
    void this.runPollCycle();
    this.intervalId = setInterval(
      () => {
        void this.runPollCycle();
      },
      this.config.pollIntervalMs
    );
  }

  /**
   * Stop the engine: abort all workers, clear polling, freeze status.
   * Returns a StopResult describing what was cleaned up.
   */
  stop(): StopResult {
    const hadPolling = this.intervalId !== null;
    const trackedCount = this.trackedIssues.size;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Freeze status mutations immediately to prevent stale callbacks
    // from corrupting state after stop.
    this.statusFrozen = true;
    this.runToken++;
    this.status.isRunning = false;

    // Abort all active workers
    const abortedIssueNumbers: number[] = [];
    for (const [issueNumber, controller] of this.activeWorkerControllers.entries()) {
      if (!controller.signal.aborted) {
        controller.abort();
        abortedIssueNumbers.push(issueNumber);
        this.logEvent("worker.abort_sent", {
          issueNumber,
          message: "Sent abort signal to worker during stop",
        });
      }
    }

    // Clear worker tracking but leave promises to settle naturally
    // (they check runToken/statusFrozen and discard results)
    this.activeWorkerControllers.clear();
    this.status.activeWorkerCount = 0;

    const hadTrackedIssues = trackedCount > 0;
    this.trackedIssues.clear();

    // Set final stopped state
    this.statusFrozen = false;
    this.updateActivity("stopped");

    const result: StopResult = {
      workersAborted: abortedIssueNumbers.length,
      abortedIssueNumbers,
      pollingStopped: hadPolling,
      trackedIssuesCleared: hadTrackedIssues,
    };

    this.logEvent("engine.stop", {
      message: "Stopped autonomous-dev engine",
      details: {
        workersAborted: result.workersAborted,
        abortedIssueNumbers: result.abortedIssueNumbers,
        pollingStopped: result.pollingStopped,
        trackedIssuesCleared: result.trackedIssuesCleared,
      },
    });

    this.logEvent("engine.stop.complete", {
      message: "Cleanup verification complete — no autonomous work should be running",
    });

    return result;
  }

  /**
   * Stop the engine and wait for all in-flight worker promises to settle.
   * Use this for session shutdown to guarantee no background work continues.
   */
  async stopAndWait(timeoutMs: number = 5_000): Promise<StopResult> {
    const result = this.stop();

    if (this.activeWorkerPromises.size > 0) {
      const remaining = Array.from(this.activeWorkerPromises.entries());
      this.logEvent("engine.stop.waiting", {
        message: `Waiting for ${remaining.length} in-flight worker(s) to settle`,
        details: { issueNumbers: remaining.map(([n]) => n) },
      });

      const allSettled = Promise.allSettled(remaining.map(([, p]) => p));
      const race = Promise.race([
        allSettled,
        new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
      ]);
      await race;

      this.logEvent("engine.stop.workers_settled", {
        message: "All in-flight workers have settled (or timed out waiting)",
        details: {
          remainingPromises: this.activeWorkerPromises.size,
        },
      });
      this.activeWorkerPromises.clear();
    }

    return result;
  }

  getStatus(): OrchestratorStatus {
    this.status.trackedIssues = Array.from(this.trackedIssues.values()).map(
      (t) => ({
        issueNumber: t.issueNumber,
        title: t.title,
        status:
          t.state === "clarifying"
            ? ("waiting_clarification" as const)
            : ("processing" as const),
        clarificationRound: t.clarificationRound,
        lockedAt: t.lockedAt,
      })
    );
    return {
      ...this.status,
      recentActivities: this.status.recentActivities.map((item) => ({ ...item })),
    };
  }

  setWorkerSpawner(
    spawner: (
      issueNumber: number,
      config: OrchestratorConfig,
      onActivity?: WorkerActivityCallback,
      signal?: WorkerAbortSignal
    ) => Promise<WorkerResult>
  ): void {
    this.workerSpawner = spawner;
  }

  async pollCycle(): Promise<void> {
    await this.runPollCycle();
  }

  private async runPollCycle(): Promise<void> {
    const runToken = this.runToken;
    const pollStartedAt = Date.now();
    this.status.lastPollStartedAt = new Date().toISOString();
    this.logEvent("poll.started", {
      message: "Polling GitHub issues",
      details: { trackedIssueCount: this.trackedIssues.size },
    });
    this.updateActivity("polling GitHub issues");

    try {
      if (!this.config.repo) {
        console.warn("[autonomous-dev] No repo configured, skipping poll");
        this.logEvent("poll.skipped", {
          level: "warn",
          message: "Skipping poll because no repo is configured",
        });
        this.status.lastPollCompletedAt = new Date().toISOString();
        this.status.lastPollSucceededAt = this.status.lastPollCompletedAt;
        this.status.lastError = null;
        this.status.lastErrorAt = null;
        if (runToken !== this.runToken) return;
        this.updateActivity("idle - waiting for work");
        return;
      }

      await this.pickupReadyIssues(runToken);
      await this.checkClarificationResponses();

      this.status.lastPollCompletedAt = new Date().toISOString();
      this.status.lastPollSucceededAt = this.status.lastPollCompletedAt;
      this.status.lastError = null;
      this.status.lastErrorAt = null;
      this.logEvent("poll.completed", {
        message: "Poll cycle completed",
        details: {
          durationMs: Date.now() - pollStartedAt,
          trackedIssueCount: this.trackedIssues.size,
          totalProcessed: this.status.stats.totalProcessed,
        },
      });
      if (runToken !== this.runToken) return;
      this.updateActivity(this.trackedIssues.size > 0 ? "tracking active issues" : "idle - waiting for work");
    } catch (error) {
      this.status.lastPollCompletedAt = new Date().toISOString();
      this.status.lastError = error instanceof Error ? error.message : String(error);
      this.status.lastErrorAt = this.status.lastPollCompletedAt;
      this.logEvent("poll.failed", {
        level: "error",
        message: "Poll cycle failed",
        details: {
          durationMs: Date.now() - pollStartedAt,
          error: describeError(error),
        },
      });
      if (runToken !== this.runToken) return;
      this.updateActivity("error while polling GitHub");
      throw error;
    }
  }

  private async pickupReadyIssues(pollRunToken: number): Promise<void> {
    const issues = await listIssuesByLabel(
      this.config.repo,
      AUTONOMOUS_LABELS.READY,
      [
        AUTONOMOUS_LABELS.IN_PROGRESS,
        AUTONOMOUS_LABELS.NEEDS_CLARIFICATION,
        AUTONOMOUS_LABELS.COMPLETED,
        AUTONOMOUS_LABELS.FAILED,
      ]
    );

    this.logEvent("issues.ready.found", {
      message: `Found ${issues.length} ready issue(s)`,
      details: { issueNumbers: issues.map((issue) => issue.number) },
    });

    for (const issue of issues) {
      // Check if engine was stopped between iterations
      if (pollRunToken !== this.runToken) {
        this.logEvent("issues.pickup.stopped", {
          message: "Abandoning issue pickup because engine was stopped",
          details: { remainingIssueNumbers: issues.slice(issues.indexOf(issue)).map((i) => i.number) },
        });
        break;
      }

      if (this.trackedIssues.has(issue.number)) {
        this.logEvent("issue.skip_tracked", {
          issueNumber: issue.number,
          issueTitle: issue.title,
          message: "Skipping issue already tracked in memory",
        });
        continue;
      }

      this.logEvent("issue.locking", {
        issueNumber: issue.number,
        issueTitle: issue.title,
        message: "Locking ready issue",
      });
      this.updateActivity("locking GitHub issue", issue.number, issue.title);
      await lockIssue(this.config.repo, issue.number);

      this.trackedIssues.set(issue.number, {
        issueNumber: issue.number,
        title: issue.title,
        state: "processing",
        clarificationRound: 0,
        clarificationQuestionTimestamp: null,
        lockedAt: new Date(),
      });

      await this.spawnWorkerForIssue(issue.number);
    }
  }

  private async spawnWorkerForIssue(issueNumber: number): Promise<void> {
    const tracked = this.trackedIssues.get(issueNumber);
    if (!tracked) return;

    const runToken = this.runToken;
    const controller = new AbortController();
    this.activeWorkerControllers.set(issueNumber, controller);
    this.status.activeWorkerCount = this.activeWorkerControllers.size;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let timedOut = false;
    const workerTimeoutMs = this.config.workerTimeoutMs;

    if (workerTimeoutMs > 0) {
      timeoutId = setTimeout(() => {
        if (controller.signal.aborted) return;
        timedOut = true;
        this.logEvent("worker.timeout", {
          level: "warn",
          issueNumber,
          issueTitle: tracked.title,
          message: `Worker exceeded ${workerTimeoutMs}ms timeout, aborting`,
          details: { workerTimeoutMs },
        });
        controller.abort();
      }, workerTimeoutMs);
    }

    const workerPromise = (async () => {
      try {
        const trackedTitle = tracked.title;
        this.logEvent("worker.started", {
          issueNumber,
          issueTitle: trackedTitle,
          message: "Launching autonomous worker",
          details: workerTimeoutMs > 0 ? { workerTimeoutMs } : undefined,
        });
        this.updateActivity("processing issue", issueNumber, trackedTitle);
        const result = await this.workerSpawner(
          issueNumber,
          this.config,
          (activity) => {
            if (this.statusFrozen) return;
            if (controller.signal.aborted || runToken !== this.runToken) return;
            this.logEvent("worker.activity", {
              issueNumber,
              issueTitle: trackedTitle,
              message: activity,
            });
            this.updateActivity(activity, issueNumber, trackedTitle);
          },
          controller.signal
        );

        if (timeoutId !== null) clearTimeout(timeoutId);

        if (timedOut && runToken === this.runToken) {
          this.logEvent("worker.timeout.recovering", {
            level: "warn",
            issueNumber,
            issueTitle: trackedTitle,
            message: "Recovering from worker timeout",
          });
          tracked.state = "failed";
          this.status.stats.totalFailed++;
          this.status.stats.totalTimedOut++;
          this.status.stats.totalProcessed++;
          await postComment(
            this.config.repo,
            issueNumber,
            `⏱️ **Worker timed out** after ${workerTimeoutMs / 1000}s. Marking issue as failed.`
          );
          await this.handleFailure(issueNumber);
          return;
        }

        if (this.statusFrozen || controller.signal.aborted || runToken !== this.runToken) {
          this.logEvent("worker.aborted", {
            issueNumber,
            issueTitle: trackedTitle,
            message: "Discarding worker result after stop or superseding run",
          });
          return;
        }

        this.logEvent("worker.result", {
          issueNumber,
          issueTitle: trackedTitle,
          message: `Worker returned ${result.status}`,
          details: result.status === "completed"
            ? { prUrl: result.prUrl, summary: result.summary }
            : result.status === "needs-clarification"
              ? { question: result.question }
              : { error: result.error },
        });
        await this.handleWorkerResult(issueNumber, result);
      } catch (err) {
        if (timeoutId !== null) clearTimeout(timeoutId);

        if (timedOut && runToken === this.runToken) {
          this.logEvent("worker.timeout.recovering", {
            level: "warn",
            issueNumber,
            issueTitle: tracked.title,
            message: "Recovering from worker timeout (worker threw)",
            details: { error: describeError(err) },
          });
          tracked.state = "failed";
          this.status.stats.totalFailed++;
          this.status.stats.totalTimedOut++;
          this.status.stats.totalProcessed++;
          await postComment(
            this.config.repo,
            issueNumber,
            `⏱️ **Worker timed out** after ${workerTimeoutMs / 1000}s. Marking issue as failed.`
          );
          await this.handleFailure(issueNumber);
          return;
        }

        if (this.statusFrozen || controller.signal.aborted || runToken !== this.runToken) {
          this.logEvent("worker.aborted", {
            issueNumber,
            issueTitle: tracked.title,
            message: "Worker aborted after stop or superseding run",
            details: { error: describeError(err) },
          });
          return;
        }

        console.error(
          `[autonomous-dev] Worker failed for #${issueNumber}:`,
          err
        );
        this.logEvent("worker.failed", {
          level: "error",
          issueNumber,
          issueTitle: tracked.title,
          message: "Worker threw before returning a result",
          details: { error: describeError(err) },
        });
        tracked.state = "failed";
        this.status.stats.totalFailed++;
        this.status.stats.totalProcessed++;
        await this.handleFailure(issueNumber);
      } finally {
        if (timeoutId !== null) clearTimeout(timeoutId);
        const active = this.activeWorkerControllers.get(issueNumber);
        if (active === controller) {
          this.activeWorkerControllers.delete(issueNumber);
        }
        this.status.activeWorkerCount = this.activeWorkerControllers.size;
        this.activeWorkerPromises.delete(issueNumber);
      }
    })();

    this.activeWorkerPromises.set(issueNumber, workerPromise);
    await workerPromise;
  }

  private async handleWorkerResult(
    issueNumber: number,
    result: WorkerResult
  ): Promise<void> {
    const tracked = this.trackedIssues.get(issueNumber);
    if (!tracked) return;

    if (result.status === "completed") {
      tracked.state = "complete";
      this.status.stats.totalCompleted++;
      this.status.stats.totalProcessed++;
      await this.handleCompletion(issueNumber, result.prUrl, result.summary);
    } else if (result.status === "needs-clarification") {
      if (tracked.clarificationRound >= this.config.maxClarificationRounds) {
        tracked.state = "failed";
        this.status.stats.totalFailed++;
        this.status.stats.totalProcessed++;
        await postComment(
          this.config.repo,
          issueNumber,
          `❌ Max clarification rounds (${this.config.maxClarificationRounds}) reached. Please reopen if still needed.`
        );
        await this.handleFailure(issueNumber);
      } else {
        this.logEvent("issue.needs_clarification", {
          issueNumber,
          issueTitle: tracked.title,
          message: "Worker requested clarification",
          details: { question: result.question, clarificationRound: tracked.clarificationRound + 1 },
        });
        tracked.state = "clarifying";
        tracked.clarificationRound++;
        tracked.clarificationQuestionTimestamp = new Date().toISOString();
        this.status.stats.totalClarificationAsked++;
        this.updateActivity("waiting for clarification", issueNumber, tracked.title);
        await markNeedsClarification(this.config.repo, issueNumber);
        await postComment(
          this.config.repo,
          issueNumber,
          `🤔 **Clarification needed:** ${result.question}`
        );
      }
    } else if (result.status === "failed") {
      this.logEvent("issue.failed_result", {
        level: "error",
        issueNumber,
        issueTitle: tracked.title,
        message: "Worker reported failure",
        details: { error: result.error },
      });
      tracked.state = "failed";
      this.status.stats.totalFailed++;
      this.status.stats.totalProcessed++;
      await postComment(
        this.config.repo,
        issueNumber,
        `❌ **Error:** ${result.error}`
      );
      await this.handleFailure(issueNumber);
    }
  }

  private async checkClarificationResponses(): Promise<void> {
    const clarifyingIssues = Array.from(this.trackedIssues.values()).filter(
      (t) => t.state === "clarifying"
    );

    for (const tracked of clarifyingIssues) {
      if (!tracked.clarificationQuestionTimestamp) continue;

      const ctx = await getIssueWithComments(
        this.config.repo,
        tracked.issueNumber
      );

      const hasNewComment = ctx.comments.some(
        (c) =>
          !c.isFromBot &&
          c.author.toLowerCase() !== "github-actions[bot]" &&
          new Date(c.createdAt) >
            new Date(tracked.clarificationQuestionTimestamp!)
      );

      if (hasNewComment) {
        this.logEvent("issue.resume", {
          issueNumber: tracked.issueNumber,
          issueTitle: tracked.title,
          message: "Resuming issue after clarification response",
        });
        this.updateActivity("resuming issue", tracked.issueNumber, tracked.title);
        tracked.state = "processing";
        tracked.clarificationQuestionTimestamp = null;
        await resumeFromClarification(this.config.repo, tracked.issueNumber);
        await this.spawnWorkerForIssue(tracked.issueNumber);
      }
    }
  }

  private async handleCompletion(
    issueNumber: number,
    prUrl: string,
    summary: string
  ): Promise<void> {
    const tracked = this.trackedIssues.get(issueNumber);
    this.logEvent("issue.completed", {
      issueNumber,
      issueTitle: tracked?.title,
      message: "Marking issue as completed",
      details: { prUrl, summary },
    });
    this.updateActivity("completing issue", issueNumber, tracked?.title ?? null);
    await swapLabels(
      this.config.repo,
      issueNumber,
      [
        AUTONOMOUS_LABELS.IN_PROGRESS,
        AUTONOMOUS_LABELS.NEEDS_CLARIFICATION,
      ],
      [AUTONOMOUS_LABELS.COMPLETED]
    );
    await postComment(
      this.config.repo,
      issueNumber,
      `✅ **Autonomous implementation complete!**\n\n${summary}\n\nPR: ${prUrl}`
    );
    this.trackedIssues.delete(issueNumber);
    this.updateActivity(this.trackedIssues.size > 0 ? "tracking active issues" : "idle - waiting for work");
  }

  private async handleFailure(issueNumber: number): Promise<void> {
    const tracked = this.trackedIssues.get(issueNumber);
    this.logEvent("issue.failed", {
      level: "warn",
      issueNumber,
      issueTitle: tracked?.title,
      message: "Marking issue as failed",
    });
    this.updateActivity("failing issue", issueNumber, tracked?.title ?? null);
    await swapLabels(
      this.config.repo,
      issueNumber,
      [
        AUTONOMOUS_LABELS.IN_PROGRESS,
        AUTONOMOUS_LABELS.NEEDS_CLARIFICATION,
      ],
      [AUTONOMOUS_LABELS.FAILED]
    );
    this.trackedIssues.delete(issueNumber);
    this.updateActivity(this.trackedIssues.size > 0 ? "tracking active issues" : "idle - waiting for work");
  }
}
