import { Command } from "@cliffy/command";
import { Confirm, Input } from "@cliffy/prompt";
import { bold } from "@std/fmt/colors";
import { Project } from "../types/index.ts";
import { ConfigManager } from "../core/config-manager.ts";
import { FileScanner } from "../core/file-scanner.ts";
import { ProjectDetector } from "../core/project-detector.ts";
import { SymlinkManager } from "../core/symlink-manager.ts";
import { SyncRepository } from "../core/sync-repo.ts";
import { GitNotFoundError, ProjectExistsError } from "../utils/errors.ts";
import { Logger } from "../utils/logger.ts";

export const initCommand = new Command()
  .name("init")
  .description("Initialize tracking for the current git repository")
  .arguments("[project-name:string]")
  .option("-y, --yes", "Skip confirmation prompts")
  .option("-d, --directory <dir:string>", "Override current working directory")
  .option("--sync-repo <path:string>", "Override sync repository location")
  .action(async (options, projectNameArg?: string) => {
    const logger = new Logger();
    const workDir = options.directory || Deno.cwd();

    try {
      // Initialize sync repository
      const syncRepo = new SyncRepository(options.syncRepo, logger);
      await syncRepo.initialize();

      // Detect git repository
      const detector = new ProjectDetector();
      const { gitInfo, suggestedName } = await detector.detectCurrentProject();

      // Determine project name
      let projectName = projectNameArg || suggestedName;
      
      if (!options.yes && !projectNameArg) {
        projectName = await Input.prompt({
          message: "Project name:",
          default: suggestedName,
        });
      }

      // Check if project already exists
      const configManager = new ConfigManager(syncRepo.repoPath);
      if (await configManager.projectExists(projectName)) {
        throw new ProjectExistsError(projectName);
      }

      // Scan for Claude files
      logger.info("Scanning for Claude files...");
      const scanner = new FileScanner();
      const files = await scanner.scan(gitInfo.root);

      if (files.length === 0) {
        logger.warn("No Claude files found in project");
        
        if (!options.yes) {
          const proceed = await Confirm.prompt({
            message: "No Claude files found. Continue anyway?",
            default: true,
          });
          
          if (!proceed) {
            logger.info("Initialization cancelled");
            return;
          }
        }
      } else {
        logger.success(`Found ${files.length} Claude file(s):`);
        for (const file of files) {
          logger.info(`  • ${file.relativePath}`);
        }
      }

      // Create project
      const project: Project = {
        name: projectName,
        path: gitInfo.root,
        gitRemote: gitInfo.remote,
        branch: gitInfo.branch,
        autoTrack: true,
        trackedFiles: files.map(f => f.relativePath),
        metadata: {
          addedAt: new Date(),
          lastSync: new Date(),
          lastModified: new Date(),
        },
      };

      // Save project
      await configManager.addProject(projectName, project);

      // Create symlinks
      if (files.length > 0) {
        logger.info("Creating symlinks...");
        const symlinkManager = new SymlinkManager(logger);
        const projectDir = await syncRepo.ensureProjectDir(projectName);
        await symlinkManager.createSymlinks(files, projectDir, gitInfo.root);
      }

      // Commit if there are changes
      if (await syncRepo.hasChanges()) {
        await syncRepo.addFiles(["."]);
        await syncRepo.commit(`feat: add project ${projectName}`);
      }

      logger.success(bold(`✓ Initialized project: ${projectName}`));
      logger.info("");
      logger.info("Next steps:");
      logger.info(`  ${logger.formatCommand("claude-sync status")}     # Check status`);
      logger.info(`  ${logger.formatCommand("claude-sync add")}        # Add more files`);
      logger.info(`  ${logger.formatCommand("claude-sync push")}       # Push to remote`);
    } catch (error) {
      if (error instanceof GitNotFoundError) {
        logger.error("Not in a git repository");
        logger.info("Run this command from within a git repository");
      } else if (error instanceof ProjectExistsError) {
        logger.error(error.message);
        logger.info("Use a different name or remove the existing project first");
      } else {
        logger.error(`Failed to initialize: ${error instanceof Error ? error.message : String(error)}`);
      }
      Deno.exit(1);
    }
  });