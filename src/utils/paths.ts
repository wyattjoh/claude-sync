import { dirname, join, normalize, resolve } from "@std/path";
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

export function findUpward(startPath: string, target: string): string | undefined {
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

export async function getVersion(): Promise<string> {
  try {
    // Get the directory where the current module is located
    const moduleUrl = import.meta.url;
    const modulePath = new URL(moduleUrl).pathname;
    const projectRoot = findUpward(dirname(modulePath), "deno.json");

    if (!projectRoot) {
      throw new Error("Could not find deno.json file");
    }

    const denoJsonPath = join(projectRoot, "deno.json");
    const content = await Deno.readTextFile(denoJsonPath);
    const denoConfig = JSON.parse(content);

    if (!denoConfig.version) {
      throw new Error("Version not found in deno.json");
    }

    return denoConfig.version;
  } catch (error) {
    // Fallback to a default version if reading fails
    console.warn(
      `Failed to read version from deno.json: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return "unknown";
  }
}
