import { homedir } from "os";
import { join } from "path";

export function resolvePiAgentDir(
  envDir = process.env.PI_CODING_AGENT_DIR,
  homeDir = homedir(),
): string {
  if (!envDir) return join(homeDir, ".pi", "agent");
  if (envDir === "~") return homeDir;
  if (envDir.startsWith("~/")) return join(homeDir, envDir.slice(2));
  return envDir;
}
