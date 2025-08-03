import { ensureDir, ensureSymlink, exists } from "@std/fs";
import { dirname, join, relative } from "@std/path";
import { ClaudeFile, Project } from "../types/index.ts";
import { SymlinkError } from "../utils/errors.ts";
import { Logger } from "../utils/logger.ts";

export class SymlinkManager {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async createSymlinks(
    files: ClaudeFile[],
    syncProjectDir: string,
  ): Promise<string[]> {
    const createdLinks: string[] = [];

    for (const file of files) {
      try {
        // Path for the file copy in sync repo
        const syncFilePath = join(syncProjectDir, file.relativePath);
        const syncFileDir = dirname(syncFilePath);

        // Ensure directory exists in sync repo
        await ensureDir(syncFileDir);

        // Remove existing file if it exists in sync repo
        try {
          await Deno.remove(syncFilePath);
        } catch {
          // File doesn't exist, which is fine
        }

        // Copy the original file to sync repo
        await Deno.copyFile(file.path, syncFilePath);

        // Remove the original file
        await Deno.remove(file.path);

        // Create symlink in original location pointing to sync repo copy
        await ensureSymlink(syncFilePath, file.path);
        createdLinks.push(file.relativePath);

        this.logger.debug(
          `Moved file to sync repo and created symlink: ${file.path} -> ${syncFilePath}`,
        );
      } catch (error) {
        throw new SymlinkError(
          error instanceof Error ? error.message : String(error),
          file.relativePath,
        );
      }
    }

    return createdLinks;
  }

  async updateSymlinks(project: Project, syncProjectDir: string): Promise<{
    added: string[];
    removed: string[];
    updated: string[];
  }> {
    const result = {
      added: [] as string[],
      removed: [] as string[],
      updated: [] as string[],
    };

    // Get current files in sync repo
    const currentFiles = await this.getProjectFiles(syncProjectDir);
    const trackedSet = new Set(project.trackedFiles);

    // Remove orphaned files from sync repo
    for (const file of currentFiles) {
      if (!trackedSet.has(file.relativePath)) {
        await Deno.remove(file.path);
        result.removed.push(file.relativePath);
        this.logger.debug(`Removed orphaned file from sync repo: ${file.relativePath}`);
      }
    }

    // Check for missing or broken symlinks in project
    for (const trackedFile of project.trackedFiles) {
      const syncFilePath = join(syncProjectDir, trackedFile);
      const originalPath = join(project.path, trackedFile);

      try {
        const originalStat = await Deno.lstat(originalPath);
        if (originalStat.isSymlink) {
          const target = await Deno.readLink(originalPath);
          if (target !== syncFilePath) {
            // Symlink points to wrong location, update it
            await Deno.remove(originalPath);
            await ensureSymlink(syncFilePath, originalPath);
            result.updated.push(trackedFile);
            this.logger.debug(`Updated symlink in project: ${originalPath} -> ${syncFilePath}`);
          }
        }
      } catch {
        // Symlink doesn't exist in project, create it if sync file exists
        if (await exists(syncFilePath)) {
          const originalDir = dirname(originalPath);
          await ensureDir(originalDir);
          await ensureSymlink(syncFilePath, originalPath);
          result.added.push(trackedFile);
          this.logger.debug(`Added symlink to project: ${originalPath} -> ${syncFilePath}`);
        }
      }
    }

    return result;
  }

  async removeSymlinks(syncProjectDir: string, project: Project): Promise<string[]> {
    const removed: string[] = [];

    // Remove symlinks from project and files from sync repo
    for (const trackedFile of project.trackedFiles) {
      const syncFilePath = join(syncProjectDir, trackedFile);
      const originalPath = join(project.path, trackedFile);

      try {
        // Remove symlink from project (restore original file if needed)
        try {
          const originalStat = await Deno.lstat(originalPath);
          if (originalStat.isSymlink) {
            await Deno.remove(originalPath);
            // Copy file back from sync repo to original location
            if (await exists(syncFilePath)) {
              await Deno.copyFile(syncFilePath, originalPath);
            }
          }
        } catch {
          // Symlink doesn't exist in project
        }

        // Remove file from sync repo
        try {
          await Deno.remove(syncFilePath);
        } catch {
          // File doesn't exist in sync repo
        }

        removed.push(trackedFile);
        this.logger.debug(`Removed tracking for: ${trackedFile}`);
      } catch (error) {
        this.logger.warn(
          `Failed to remove tracking for ${trackedFile}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    // Clean up empty directories in sync repo
    await this.cleanEmptyDirs(syncProjectDir);

    return removed;
  }

  private async getProjectFiles(projectDir: string): Promise<{
    path: string;
    relativePath: string;
  }[]> {
    const files: { path: string; relativePath: string }[] = [];

    async function scanDir(dir: string) {
      try {
        for await (const entry of Deno.readDir(dir)) {
          const fullPath = join(dir, entry.name);

          if (entry.isFile) {
            files.push({
              path: fullPath,
              relativePath: relative(projectDir, fullPath),
            });
          } else if (entry.isDirectory) {
            await scanDir(fullPath);
          }
        }
      } catch {
        // Directory doesn't exist or can't be read
      }
    }

    await scanDir(projectDir);
    return files;
  }

  private async getProjectSymlinks(projectDir: string): Promise<{
    path: string;
    relativePath: string;
  }[]> {
    const symlinks: { path: string; relativePath: string }[] = [];

    async function scanDir(dir: string) {
      try {
        for await (const entry of Deno.readDir(dir)) {
          const fullPath = join(dir, entry.name);

          if (entry.isSymlink) {
            symlinks.push({
              path: fullPath,
              relativePath: relative(projectDir, fullPath),
            });
          } else if (entry.isDirectory) {
            await scanDir(fullPath);
          }
        }
      } catch {
        // Directory doesn't exist or can't be read
      }
    }

    await scanDir(projectDir);
    return symlinks;
  }

  async cleanEmptyDirs(dir: string): Promise<void> {
    try {
      const entries = [];
      for await (const entry of Deno.readDir(dir)) {
        entries.push(entry);
      }

      if (entries.length === 0) {
        await Deno.remove(dir);
        const parent = dirname(dir);
        if (parent !== dir) {
          await this.cleanEmptyDirs(parent);
        }
      }
    } catch {
      // Directory doesn't exist or can't be removed
    }
  }

  async verifySymlink(linkPath: string, targetPath: string): Promise<boolean> {
    try {
      const stat = await Deno.lstat(linkPath);
      if (!stat.isSymlink) {
        return false;
      }

      const actualTarget = await Deno.readLink(linkPath);
      return actualTarget === targetPath;
    } catch {
      return false;
    }
  }
}
