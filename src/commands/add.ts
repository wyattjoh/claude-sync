import { Command } from "@cliffy/command";
import { bold } from "@std/fmt/colors";
import { relative } from "@std/path";
import { ConfigManager } from "../core/config-manager.ts";
import { FileScanner } from "../core/file-scanner.ts";
import { ProjectDetector } from "../core/project-detector.ts";
import { SymlinkManager } from "../core/symlink-manager.ts";
import { SyncRepository } from "../core/sync-repo.ts";
import { GitNotFoundError, ProjectNotFoundError } from "../utils/errors.ts";
import { Logger } from "../utils/logger.ts";

export const addCommand = new Command()
  .name("add")
  .description("Add files to tracking")
  .arguments("[...files:string]")
  .option("-d, --directory <dir:string>", "Override current working directory")
  .option("--sync-repo <path:string>", "Override sync repository location")
  .option("-a, --all", "Add all Claude files found in project")
  .action(async (options, ...files: string[]) => {
    const logger = new Logger();

    try {
      // Initialize sync repository
      const syncRepo = new SyncRepository(options.syncRepo, logger);
      if (!await syncRepo.exists()) {
        logger.error("Sync repository not initialized");
        logger.info("Run 'claude-sync init' first");
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

      // Determine files to add
      const scanner = new FileScanner();
      const filesToAdd = [];

      if (options.all || files.length === 0) {
        // Scan for all Claude files
        logger.info("Scanning for Claude files...");
        const scannedFiles = await scanner.scan(gitInfo.root);

        // Filter out already tracked files
        const trackedSet = new Set(project.trackedFiles);
        const newFiles = scannedFiles.filter((f) => !trackedSet.has(f.relativePath));

        if (newFiles.length === 0) {
          logger.info("No new Claude files found");
          return;
        }

        filesToAdd.push(...newFiles);
      } else {
        // Add specific files
        for (const file of files) {
          const scannedFile = await scanner.scanSingle(gitInfo.root, file);
          if (!scannedFile) {
            logger.warn(`File not found: ${file}`);
            continue;
          }

          // Check if it's a Claude file
          if (!scanner.isClaudeFile(scannedFile.relativePath)) {
            logger.warn(`Not a Claude file: ${file}`);
            continue;
          }

          // Check if already tracked
          if (project.trackedFiles.includes(scannedFile.relativePath)) {
            logger.info(`Already tracked: ${file}`);
            continue;
          }

          filesToAdd.push(scannedFile);
        }
      }

      if (filesToAdd.length === 0) {
        logger.info("No files to add");
        return;
      }

      // Create symlinks
      logger.info(`Adding ${filesToAdd.length} file(s)...`);
      const symlinkManager = new SymlinkManager(logger);
      const projectDir = await syncRepo.getProjectPath(projectName);
      const created = await symlinkManager.createSymlinks(filesToAdd, projectDir, gitInfo.root);

      // Update project
      project.trackedFiles.push(...created);
      project.metadata.lastModified = new Date();
      await configManager.updateProject(projectName, project);

      // Stage changes in sync repo
      const relativePaths = created.map((f) => relative(syncRepo.repoPath, projectDir + "/" + f));
      await syncRepo.addFiles(relativePaths);

      // Show added files
      logger.success(`Added ${created.length} file(s):`);
      for (const file of created) {
        logger.info(`  ${bold("+")} ${file}`);
      }

      // Check if there are changes to commit
      if (await syncRepo.hasChanges()) {
        logger.info("");
        logger.info("Files staged. Run 'claude-sync commit' to save changes");
      }
    } catch (error) {
      if (error instanceof GitNotFoundError) {
        logger.error("Not in a git repository");
      } else if (error instanceof ProjectNotFoundError) {
        logger.error("Project not found. Run 'claude-sync init' first");
      } else {
        logger.error(
          `Failed to add files: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      Deno.exit(1);
    }
  });
