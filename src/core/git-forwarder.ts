import { join } from "@std/path";
import { CommandOutput } from "../types/index.ts";
import { runGitCommand } from "../utils/git.ts";
import { Logger } from "../utils/logger.ts";
import { ConfigManager } from "./config-manager.ts";
import { ProjectDetector } from "./project-detector.ts";
import { SyncRepository } from "./sync-repo.ts";

export class GitForwarder {
  private syncRepo: SyncRepository;
  private configManager: ConfigManager;
  private projectDetector: ProjectDetector;
  private logger: Logger;

  constructor(syncRepoPath?: string, logger?: Logger) {
    this.logger = logger || new Logger();
    this.syncRepo = new SyncRepository(syncRepoPath, this.logger);
    this.configManager = new ConfigManager(this.syncRepo.repoPath);
    this.projectDetector = new ProjectDetector();
  }

  async forward(args: string[]): Promise<void> {
    if (args.length === 0) {
      args = ["status"];
    }

    const command = args[0];
    const currentProject = await this.detectCurrentProject();

    // Build git command args
    const gitArgs = await this.buildGitArgs(command, args, currentProject);

    // Execute git command
    const result = await runGitCommand(gitArgs.args, {
      cwd: gitArgs.cwd,
      throwOnError: false,
    });

    // Output results
    if (result.stdout) {
      console.log(result.stdout);
    }
    if (result.stderr) {
      console.error(result.stderr);
    }

    // Exit with same code as git
    if (!result.success) {
      Deno.exit(result.code);
    }
  }

  private async detectCurrentProject(): Promise<string | undefined> {
    try {
      const { gitInfo, suggestedName } = await this.projectDetector.detectCurrentProject();
      const projects = await this.configManager.loadProjects();

      // Look for project by path
      for (const [name, project] of Object.entries(projects.projects)) {
        if (project.path === gitInfo.root) {
          return name;
        }
      }

      // Look for project by suggested name
      if (projects.projects[suggestedName]) {
        return suggestedName;
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  private async buildGitArgs(
    command: string,
    originalArgs: string[],
    currentProject?: string,
  ): Promise<{ args: string[]; cwd: string }> {
    const syncRepoPath = this.syncRepo.repoPath;

    // Commands that should be scoped to current project
    const projectScopedCommands = [
      "status",
      "diff",
      "log",
      "show",
      "blame",
      "ls-files",
    ];

    // Commands that need special handling
    switch (command) {
      case "add": {
        // For 'add', we need to ensure symlinks exist before adding
        if (currentProject) {
          this.logger.warn(
            "Use 'claude-sync add' to add files. Git add is forwarded to sync repository.",
          );
        }
        return {
          args: originalArgs,
          cwd: syncRepoPath,
        };
      }

      case "commit":
      case "push":
      case "pull":
      case "fetch":
      case "branch":
      case "checkout":
      case "merge":
      case "rebase":
      case "reset":
      case "stash":
      case "tag": {
        // These commands operate on the sync repo
        return {
          args: originalArgs,
          cwd: syncRepoPath,
        };
      }

      default: {
        // Check if it's a project-scoped command
        if (projectScopedCommands.includes(command) && currentProject) {
          // Add path filter for current project
          const projectPath = join("projects", currentProject);
          
          // Check if user already specified paths
          const hasDoubleDash = originalArgs.includes("--");
          const hasPathArgs = originalArgs.length > 1 && !originalArgs[1].startsWith("-");

          if (!hasDoubleDash && !hasPathArgs) {
            // Add path filter
            return {
              args: [...originalArgs, "--", projectPath],
              cwd: syncRepoPath,
            };
          }
        }

        // Default: forward as-is to sync repo
        return {
          args: originalArgs,
          cwd: syncRepoPath,
        };
      }
    }
  }

  async ensureSyncRepo(): Promise<void> {
    if (!await this.syncRepo.exists()) {
      await this.syncRepo.initialize();
    }
  }
}