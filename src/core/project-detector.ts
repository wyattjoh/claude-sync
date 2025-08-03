import { GitInfo } from "../types/index.ts";
import { GitNotFoundError } from "../utils/errors.ts";
import { findUpward, normalizePath, sanitizeProjectName } from "../utils/paths.ts";
import {
  extractRepoName,
  getCurrentBranch,
  getGitRemote,
  getGitRoot,
  isGitRepository,
} from "../utils/git.ts";

export class ProjectDetector {
  async detectGitRoot(startPath: string): Promise<string | undefined> {
    const gitRoot = await getGitRoot(startPath);
    if (gitRoot) {
      return normalizePath(gitRoot);
    }

    // Fallback to manual search
    return findUpward(startPath, ".git");
  }

  async getRepoName(gitRoot: string): Promise<string> {
    const remote = await getGitRemote(gitRoot);
    const name = extractRepoName(remote, gitRoot);
    return sanitizeProjectName(name);
  }

  async getGitInfo(path: string): Promise<GitInfo> {
    const normalizedPath = normalizePath(path);
    const isRepo = await isGitRepository(normalizedPath);

    if (!isRepo) {
      throw new GitNotFoundError(normalizedPath);
    }

    const gitRoot = await this.detectGitRoot(normalizedPath);
    if (!gitRoot) {
      throw new GitNotFoundError(normalizedPath);
    }

    const [remote, branch] = await Promise.all([
      getGitRemote(gitRoot),
      getCurrentBranch(gitRoot),
    ]);

    return {
      root: gitRoot,
      remote,
      branch,
      isRepo: true,
    };
  }

  async detectCurrentProject(): Promise<{ gitInfo: GitInfo; suggestedName: string }> {
    const cwd = Deno.cwd();
    const gitInfo = await this.getGitInfo(cwd);
    const suggestedName = await this.getRepoName(gitInfo.root);

    return { gitInfo, suggestedName };
  }
}
