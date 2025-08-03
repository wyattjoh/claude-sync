import { join, normalize, resolve } from "@std/path";
import { existsSync } from "@std/fs";

export function getDefaultSyncRepoPath(): string {
  const home = Deno.env.get("HOME") || Deno.env.get("USERPROFILE");
  if (!home) {
    throw new Error("Could not determine home directory");
  }
  return join(home, ".claude-sync");
}

export function getConfigPath(syncRepoPath: string): string {
  return join(syncRepoPath, "config", "claude-sync.yaml");
}

export function getProjectsPath(syncRepoPath: string): string {
  return join(syncRepoPath, "config", "projects.yaml");
}

export function normalizePath(path: string): string {
  return normalize(resolve(path));
}

export function findUpward(
  startPath: string,
  target: string,
): string | undefined {
  let currentPath = normalizePath(startPath);

  while (currentPath !== "/") {
    const targetPath = join(currentPath, target);
    if (existsSync(targetPath)) {
      return currentPath;
    }
    const parent = join(currentPath, "..");
    if (parent === currentPath) break;
    currentPath = parent;
  }

  return undefined;
}

export function sanitizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
