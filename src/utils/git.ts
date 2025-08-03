import { CommandOutput } from "../types/index.ts";

export async function runGitCommand(
  args: string[],
  options: { cwd?: string; throwOnError?: boolean } = {},
): Promise<CommandOutput> {
  const { cwd, throwOnError = true } = options;

  const command = new Deno.Command("git", {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
  });

  const process = await command.spawn();
  const output = await process.output();

  const result: CommandOutput = {
    success: output.success,
    stdout: new TextDecoder().decode(output.stdout),
    stderr: new TextDecoder().decode(output.stderr),
    code: output.code,
  };

  if (!result.success && throwOnError) {
    throw new Error(`Git command failed: ${result.stderr}`);
  }

  return result;
}

export async function isGitRepository(path: string): Promise<boolean> {
  try {
    const result = await runGitCommand(["rev-parse", "--git-dir"], {
      cwd: path,
      throwOnError: false,
    });
    return result.success;
  } catch {
    return false;
  }
}

export async function getGitRoot(path: string): Promise<string | undefined> {
  try {
    const result = await runGitCommand(["rev-parse", "--show-toplevel"], {
      cwd: path,
      throwOnError: false,
    });
    return result.success ? result.stdout.trim() : undefined;
  } catch {
    return undefined;
  }
}

export async function getGitRemote(path: string): Promise<string | undefined> {
  try {
    const result = await runGitCommand(["remote", "get-url", "origin"], {
      cwd: path,
      throwOnError: false,
    });
    return result.success ? result.stdout.trim() : undefined;
  } catch {
    return undefined;
  }
}

export async function getCurrentBranch(path: string): Promise<string> {
  try {
    const result = await runGitCommand(["branch", "--show-current"], {
      cwd: path,
      throwOnError: false,
    });
    return result.success ? result.stdout.trim() : "main";
  } catch {
    return "main";
  }
}

export async function initGitRepo(path: string): Promise<void> {
  await runGitCommand(["init", "--initial-branch=main"], { cwd: path });
}

export async function gitAdd(path: string, files: string[], force = false): Promise<void> {
  const args = force ? ["add", "-f", ...files] : ["add", ...files];
  await runGitCommand(args, { cwd: path });
}

export async function gitCommit(path: string, message: string): Promise<void> {
  await runGitCommand(["commit", "-m", message], { cwd: path });
}

export function extractRepoName(gitRemote: string | undefined, projectPath: string): string {
  if (gitRemote) {
    // Extract from git URL
    const match = gitRemote.match(/\/([^\/]+?)(\.git)?$/);
    if (match) {
      return match[1];
    }
  }

  // Fall back to directory name
  const parts = projectPath.split("/");
  return parts[parts.length - 1] || "unnamed";
}
