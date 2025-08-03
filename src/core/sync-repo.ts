import { ensureDir, exists } from "@std/fs";
import { join } from "@std/path";
import { SyncRepoError } from "../utils/errors.ts";
import { gitAdd, gitCommit, initGitRepo, isGitRepository, runGitCommand } from "../utils/git.ts";
import { Logger } from "../utils/logger.ts";
import { getDefaultSyncRepoPath } from "../utils/paths.ts";
import { ConfigManager } from "./config-manager.ts";

export class SyncRepository {
  private path: string;
  private logger: Logger;
  private configManager: ConfigManager;

  constructor(path?: string, logger?: Logger) {
    this.path = path || getDefaultSyncRepoPath();
    this.logger = logger || new Logger();
    this.configManager = new ConfigManager(this.path);
  }

  get repoPath(): string {
    return this.path;
  }

  async initialize(): Promise<void> {
    try {
      // Ensure sync repo directory exists
      await ensureDir(this.path);

      // Initialize git if needed
      if (!await isGitRepository(this.path)) {
        this.logger.info(`Initializing sync repository at ${this.path}`);
        await initGitRepo(this.path);

        // Create initial .gitignore
        const gitignorePath = join(this.path, ".gitignore");
        const gitignoreContent = [
          "# Claude-sync generated",
          ".DS_Store",
          "*.log",
          "*.tmp",
          "",
        ].join("\n");
        await Deno.writeTextFile(gitignorePath, gitignoreContent);

        // Create projects directory
        await ensureDir(join(this.path, "projects"));

        // Initial commit
        await gitAdd(this.path, ["."]);
        await gitCommit(this.path, "chore: initialize claude-sync repository");
      }

      // Save default config if it doesn't exist
      const configPath = join(this.path, "config", "claude-sync.yaml");
      if (!await exists(configPath)) {
        const config = await this.configManager.loadConfig();
        await this.configManager.saveConfig(config);
      }

      this.logger.success("Sync repository ready");
    } catch (error) {
      throw new SyncRepoError(
        `Failed to initialize sync repository: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async exists(): Promise<boolean> {
    return await exists(this.path) && await isGitRepository(this.path);
  }

  async status(): Promise<string> {
    const result = await runGitCommand(["status", "--porcelain"], { cwd: this.path });
    return result.stdout;
  }

  async hasChanges(): Promise<boolean> {
    const status = await this.status();
    return status.trim().length > 0;
  }

  async addFiles(files: string[]): Promise<void> {
    if (files.length === 0) return;

    await gitAdd(this.path, files);
    this.logger.debug(`Added ${files.length} files to git`);
  }

  async commit(message: string): Promise<void> {
    const hasChanges = await this.hasChanges();
    if (!hasChanges) {
      this.logger.info("No changes to commit");
      return;
    }

    await gitCommit(this.path, message);
    this.logger.success(`Committed: ${message}`);
  }

  getProjectPath(projectName: string): string {
    return join(this.path, "projects", projectName);
  }

  async ensureProjectDir(projectName: string): Promise<string> {
    const projectPath = this.getProjectPath(projectName);
    await ensureDir(projectPath);
    return projectPath;
  }

  async removeProjectDir(projectName: string): Promise<void> {
    const projectPath = this.getProjectPath(projectName);
    if (await exists(projectPath)) {
      await Deno.remove(projectPath, { recursive: true });
      this.logger.debug(`Removed project directory: ${projectName}`);
    }
  }

  async getCurrentBranch(): Promise<string> {
    const result = await runGitCommand(["branch", "--show-current"], { cwd: this.path });
    return result.stdout.trim();
  }

  async createBranch(branchName: string): Promise<void> {
    await runGitCommand(["checkout", "-b", branchName], { cwd: this.path });
    this.logger.info(`Created branch: ${branchName}`);
  }

  async switchBranch(branchName: string): Promise<void> {
    await runGitCommand(["checkout", branchName], { cwd: this.path });
    this.logger.info(`Switched to branch: ${branchName}`);
  }

  async push(remote = "origin", branch?: string): Promise<void> {
    const currentBranch = branch || await this.getCurrentBranch();
    const result = await runGitCommand(
      ["push", remote, currentBranch],
      { cwd: this.path, throwOnError: false },
    );

    if (!result.success) {
      if (result.stderr.includes("has no upstream branch")) {
        // Set upstream and push
        await runGitCommand(
          ["push", "--set-upstream", remote, currentBranch],
          { cwd: this.path },
        );
        this.logger.success(`Pushed and set upstream to ${remote}/${currentBranch}`);
      } else {
        throw new SyncRepoError(`Failed to push: ${result.stderr}`);
      }
    } else {
      this.logger.success(`Pushed to ${remote}/${currentBranch}`);
    }
  }

  async pull(remote = "origin", branch?: string): Promise<void> {
    const currentBranch = branch || await this.getCurrentBranch();
    await runGitCommand(["pull", remote, currentBranch], { cwd: this.path });
    this.logger.success(`Pulled from ${remote}/${currentBranch}`);
  }

  async getRemoteUrl(): Promise<string | undefined> {
    const result = await runGitCommand(
      ["remote", "get-url", "origin"],
      { cwd: this.path, throwOnError: false },
    );
    return result.success ? result.stdout.trim() : undefined;
  }

  async setRemote(url: string, name = "origin"): Promise<void> {
    const existingUrl = await this.getRemoteUrl();

    if (existingUrl) {
      await runGitCommand(["remote", "set-url", name, url], { cwd: this.path });
      this.logger.info(`Updated remote ${name} to ${url}`);
    } else {
      await runGitCommand(["remote", "add", name, url], { cwd: this.path });
      this.logger.info(`Added remote ${name}: ${url}`);
    }
  }
}
