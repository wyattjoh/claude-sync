import { ensureDir, exists } from "@std/fs";
import { join } from "@std/path";
import { Confirm, Input } from "@cliffy/prompt";
import { SyncRepoError } from "../utils/errors.ts";
import { gitAdd, gitCommit, initGitRepo, isGitRepository, runGitCommand } from "../utils/git.ts";
import { Logger } from "../utils/logger.ts";
import { getDefaultSyncRepoPath } from "../utils/paths.ts";
import { ConfigManager } from "./config-manager.ts";

export class SyncRepository {
  private path: string;
  private logger: Logger;
  private configManager: ConfigManager;
  private skipPrompts: boolean;

  constructor(path?: string, logger?: Logger, skipPrompts = false) {
    this.path = path || getDefaultSyncRepoPath();
    this.logger = logger || new Logger();
    this.configManager = new ConfigManager(this.path);
    this.skipPrompts = skipPrompts;
  }

  get repoPath(): string {
    return this.path;
  }

  async initialize(): Promise<void> {
    try {
      // Ensure sync repo directory exists
      await ensureDir(this.path);

      let isNewRepository = false;

      // Initialize git if needed
      if (!await isGitRepository(this.path)) {
        this.logger.info(`Initializing sync repository at ${this.path}`);
        await initGitRepo(this.path);
        isNewRepository = true;

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
        await gitAdd(this.path, ["."], true);
        await gitCommit(this.path, "chore: initialize claude-sync repository");
      }

      // Load or create default config
      let config = await this.configManager.loadConfig();
      const configPath = join(this.path, "config", "claude-sync.yaml");
      const configExists = await exists(configPath);

      // Set up remote repository if this is a new repository and no config exists
      if (isNewRepository && !configExists && !this.skipPrompts) {
        this.logger.info("");
        const remoteUrl = await this.setupRemoteRepository();
        if (remoteUrl) {
          config = { ...config, remoteUrl };
        }
      }

      // Save config
      if (!configExists || config.remoteUrl) {
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

  async addFiles(files: string[], force = true): Promise<void> {
    if (files.length === 0) return;

    await gitAdd(this.path, files, force);
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

  private async testRemoteConnectivity(url: string): Promise<boolean> {
    try {
      const result = await runGitCommand(
        ["ls-remote", "--heads", url],
        { cwd: this.path, throwOnError: false },
      );
      return result.success;
    } catch {
      return false;
    }
  }

  private async setupRemoteRepository(): Promise<string | undefined> {
    const connectToRemote = await Confirm.prompt({
      message: "Connect to remote repository? (recommended for backup/sharing)",
      default: false,
    });

    if (!connectToRemote) {
      return undefined;
    }

    while (true) {
      const remoteUrl = await Input.prompt({
        message: "Remote repository URL:",
        hint:
          "e.g., git@github.com:user/claude-sync.git or https://github.com/user/claude-sync.git",
      });

      if (!remoteUrl.trim()) {
        this.logger.warn("Empty URL provided");
        continue;
      }

      this.logger.info("Testing remote connectivity...");
      const isReachable = await this.testRemoteConnectivity(remoteUrl);

      if (!isReachable) {
        this.logger.warn("Could not connect to remote repository");
        const retry = await Confirm.prompt({
          message: "Try a different URL?",
          default: true,
        });

        if (!retry) {
          this.logger.info("Continuing without remote repository");
          return undefined;
        }
        continue;
      }

      try {
        await this.setRemote(remoteUrl);
        this.logger.success(`Remote repository configured: ${remoteUrl}`);

        // Attempt initial push
        this.logger.info("Pushing initial commit to remote...");
        try {
          await this.push();
          this.logger.success("Initial push completed");
        } catch (error) {
          this.logger.warn(
            `Initial push failed: ${error instanceof Error ? error.message : String(error)}`,
          );
          this.logger.info("You can push manually later with 'claude-sync push'");
        }

        return remoteUrl;
      } catch (error) {
        this.logger.error(
          `Failed to configure remote: ${error instanceof Error ? error.message : String(error)}`,
        );
        const retry = await Confirm.prompt({
          message: "Try again?",
          default: false,
        });

        if (!retry) {
          return undefined;
        }
      }
    }
  }
}
