import { Command } from "@cliffy/command";
import { Table } from "@cliffy/table";
import { bold, dim, green, red, yellow } from "@std/fmt/colors";
import { exists } from "@std/fs";
import { join } from "@std/path";
import { ConfigManager } from "../core/config-manager.ts";
import { SyncRepository } from "../core/sync-repo.ts";
import { Logger } from "../utils/logger.ts";

export const listCommand = new Command()
  .name("list")
  .description("List all tracked projects")
  .option("--sync-repo <path:string>", "Override sync repository location")
  .option("-l, --long", "Show detailed information")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    const logger = new Logger();

    try {
      // Initialize sync repository
      const syncRepo = new SyncRepository(options.syncRepo, logger);
      if (!await syncRepo.exists()) {
        logger.error("Sync repository not initialized");
        logger.info("Run 'claude-sync init' to get started");
        Deno.exit(1);
      }

      // Load projects
      const configManager = new ConfigManager(syncRepo.repoPath);
      const registry = await configManager.loadProjects();
      const projects = Object.entries(registry.projects);

      if (projects.length === 0) {
        logger.info("No projects tracked");
        logger.info("Run 'claude-sync init' in a git repository to get started");
        return;
      }

      if (options.json) {
        // JSON output
        const output = projects.map(([name, project]) => ({
          name,
          path: project.path,
          trackedFiles: project.trackedFiles.length,
          lastSync: project.metadata.lastSync,
          gitRemote: project.gitRemote,
        }));
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      if (options.long) {
        // Detailed view
        for (const [name, project] of projects) {
          const projectExists = await exists(project.path);
          const status = projectExists ? green("✓") : red("✗");

          console.log(`${status} ${bold(name)}`);
          console.log(`  Path: ${dim(project.path)}`);
          console.log(`  Files: ${project.trackedFiles.length} tracked`);
          console.log(`  Last sync: ${project.metadata.lastSync.toLocaleString()}`);

          if (project.gitRemote) {
            console.log(`  Remote: ${dim(project.gitRemote)}`);
          }

          if (!projectExists) {
            console.log(`  ${yellow("Warning:")} Project directory not found`);
          }

          // Check for broken symlinks
          const projectDir = await syncRepo.getProjectPath(name);
          let brokenLinks = 0;

          for (const file of project.trackedFiles) {
            const linkPath = join(projectDir, file);
            const sourcePath = join(project.path, file);

            if (!await exists(linkPath) || !await exists(sourcePath)) {
              brokenLinks++;
            }
          }

          if (brokenLinks > 0) {
            console.log(`  ${yellow("Warning:")} ${brokenLinks} broken symlink(s)`);
          }

          console.log();
        }
      } else {
        // Table view
        const table = new Table()
          .header([bold("Project"), bold("Path"), bold("Files"), bold("Status")])
          .body(
            await Promise.all(projects.map(async ([name, project]) => {
              const projectExists = await exists(project.path);
              const status = projectExists ? green("active") : red("missing");

              return [
                name,
                dim(project.path),
                project.trackedFiles.length.toString(),
                status,
              ];
            })),
          )
          .indent(2);

        table.render();
      }

      // Summary
      const totalFiles = projects.reduce((sum, [_, p]) => sum + p.trackedFiles.length, 0);
      console.log();
      console.log(dim(`${projects.length} project(s), ${totalFiles} file(s) tracked`));
    } catch (error) {
      logger.error(
        `Failed to list projects: ${error instanceof Error ? error.message : String(error)}`,
      );
      Deno.exit(1);
    }
  });
