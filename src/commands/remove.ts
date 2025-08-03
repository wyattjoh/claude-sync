import { Command } from "@cliffy/command";
import { Confirm } from "@cliffy/prompt";
import { bold, red } from "@std/fmt/colors";
import { join } from "@std/path";
import { ConfigManager } from "../core/config-manager.ts";
import { ProjectDetector } from "../core/project-detector.ts";
import { SymlinkManager } from "../core/symlink-manager.ts";
import { SyncRepository } from "../core/sync-repo.ts";
import { GitNotFoundError, ProjectNotFoundError } from "../utils/errors.ts";
import { Logger } from "../utils/logger.ts";

export const removeCommand = new Command()
  .name("remove")
  .description("Remove files or entire project from tracking")
  .arguments("[...files:string]")
  .option("-d, --directory <dir:string>", "Override current working directory")
  .option("--sync-repo <path:string>", "Override sync repository location")
  .option("--project", "Remove entire project")
  .option("-y, --yes", "Skip confirmation prompts")
  .action(async (options, ...files: string[]) => {
    const logger = new Logger();

    try {
      // Initialize sync repository
      const syncRepo = new SyncRepository(options.syncRepo, logger);
      if (!await syncRepo.exists()) {
        logger.error("Sync repository not initialized");
        Deno.exit(1);
      }

      // Detect current project
      const detector = new ProjectDetector();
      const { gitInfo } = await detector.detectCurrentProject();

      // Find project in registry
      const configManager = new ConfigManager(syncRepo.repoPath);
      const projects = await configManager.loadProjects();

      let projectName: string | undefined;
      let project = null;

      // Look for project by path
      for (const [name, p] of Object.entries(projects.projects)) {
        if (p.path === gitInfo.root) {
          projectName = name;
          project = p;
          break;
        }
      }

      if (!project || !projectName) {
        throw new ProjectNotFoundError(gitInfo.root);
      }

      const projectDir = await syncRepo.getProjectPath(projectName);

      if (options.project) {
        // Remove entire project
        if (!options.yes) {
          const confirmed = await Confirm.prompt({
            message: `Remove project ${bold(projectName)} and all tracked files?`,
            default: false,
          });

          if (!confirmed) {
            logger.info("Removal cancelled");
            return;
          }
        }

        // Remove all symlinks
        logger.info("Removing project symlinks...");
        const symlinkManager = new SymlinkManager(logger);
        await symlinkManager.removeSymlinks(projectDir);

        // Remove project directory
        await syncRepo.removeProjectDir(projectName);

        // Remove from registry
        await configManager.removeProject(projectName);

        // Stage removal
        await syncRepo.addFiles(["."]);

        logger.success(`Removed project: ${bold(projectName)}`);

        if (await syncRepo.hasChanges()) {
          logger.info("");
          logger.info("Run 'claude-sync commit' to save changes");
        }
      } else {
        // Remove specific files
        if (files.length === 0) {
          logger.error("No files specified");
          logger.info("Use --project to remove entire project");
          Deno.exit(1);
        }

        const filesToRemove: string[] = [];
        const notFound: string[] = [];

        for (const file of files) {
          if (project.trackedFiles.includes(file)) {
            filesToRemove.push(file);
          } else {
            notFound.push(file);
          }
        }

        if (notFound.length > 0) {
          logger.warn("Not tracked:");
          for (const file of notFound) {
            logger.info(`  • ${file}`);
          }
        }

        if (filesToRemove.length === 0) {
          logger.info("No files to remove");
          return;
        }

        // Confirm removal
        if (!options.yes && filesToRemove.length > 1) {
          logger.info("Files to remove:");
          for (const file of filesToRemove) {
            logger.info(`  ${red("-")} ${file}`);
          }

          const confirmed = await Confirm.prompt({
            message: `Remove ${filesToRemove.length} file(s)?`,
            default: true,
          });

          if (!confirmed) {
            logger.info("Removal cancelled");
            return;
          }
        }

        // Remove symlinks
        for (const file of filesToRemove) {
          const linkPath = join(projectDir, file);
          try {
            await Deno.remove(linkPath);
            logger.debug(`Removed symlink: ${file}`);
          } catch (error) {
            logger.warn(
              `Failed to remove ${file}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }

        // Update project
        project.trackedFiles = project.trackedFiles.filter((f) => !filesToRemove.includes(f));
        project.metadata.lastModified = new Date();
        await configManager.updateProject(projectName, project);

        // Clean empty directories
        const symlinkManager = new SymlinkManager(logger);
        await symlinkManager.removeSymlinks(projectDir); // This cleans empty dirs

        // Stage changes
        await syncRepo.addFiles(["."]);

        logger.success(`Removed ${filesToRemove.length} file(s)`);

        if (await syncRepo.hasChanges()) {
          logger.info("");
          logger.info("Run 'claude-sync commit' to save changes");
        }
      }
    } catch (error) {
      if (error instanceof GitNotFoundError) {
        logger.error("Not in a git repository");
      } else if (error instanceof ProjectNotFoundError) {
        logger.error("Project not found");
      } else {
        logger.error(`Failed to remove: ${error instanceof Error ? error.message : String(error)}`);
      }
      Deno.exit(1);
    }
  });
