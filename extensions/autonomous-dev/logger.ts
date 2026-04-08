import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from "fs";
import { dirname } from "path";
import { homedir } from "os";

const DEFAULT_LOG_PATH = `${homedir()}/.pi/autonomous-dev.log`;
const MAX_LOG_SIZE_BYTES = 1_000_000;

export type AutonomousDevLogLevel = "info" | "warn" | "error";

export interface AutonomousDevLogEntry {
  ts: string;
  level: AutonomousDevLogLevel;
  event: string;
  repo?: string;
  issueNumber?: number;
  issueTitle?: string;
  message?: string;
  details?: Record<string, unknown>;
}

export function getAutonomousDevLogPath(): string {
  return process.env.PI_AUTONOMOUS_DEV_LOG_PATH || DEFAULT_LOG_PATH;
}

function rotateIfNeeded(path: string): void {
  if (!existsSync(path)) return;
  if (statSync(path).size < MAX_LOG_SIZE_BYTES) return;
  try {
    renameSync(path, `${path}.1`);
  } catch {
    // Best-effort rotation only.
  }
}

function sanitize(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, sanitize(item)])
    );
  }

  return value;
}

export function logAutonomousDev(level: AutonomousDevLogLevel, event: string, entry: Omit<AutonomousDevLogEntry, "ts" | "level" | "event"> = {}): void {
  const path = getAutonomousDevLogPath();

  try {
    mkdirSync(dirname(path), { recursive: true });
    rotateIfNeeded(path);
    appendFileSync(
      path,
      `${JSON.stringify({
        ts: new Date().toISOString(),
        level,
        event,
        ...sanitize(entry),
      })}\n`,
      "utf-8"
    );
  } catch (error) {
    console.warn("[autonomous-dev] Failed to write log:", error);
  }
}
