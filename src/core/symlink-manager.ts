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
        // Create symlink in sync repo pointing to actual file in project
        const linkPath = join(syncProjectDir, file.relativePath);
        const linkDir = dirname(linkPath);

        // Ensure directory exists in sync repo
        await ensureDir(linkDir);

        // Remove existing symlink if it exists
        try {
          const stat = await Deno.lstat(linkPath);
          if (stat.isSymlink) {
            await Deno.remove(linkPath);
          }
        } catch {
          // File doesn't exist, which is fine
        }

        // Create symlink in sync repo pointing to actual file
        await ensureSymlink(file.path, linkPath);
        createdLinks.push(file.relativePath);

        this.logger.debug(`Created symlink in sync repo: ${file.relativePath} -> ${file.path}`);
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

    // Get current symlinks in sync repo
    const currentLinks = await this.getProjectSymlinks(syncProjectDir);
    const trackedSet = new Set(project.trackedFiles);

    // Remove orphaned symlinks from sync repo
    for (const link of currentLinks) {
      if (!trackedSet.has(link.relativePath)) {
        await Deno.remove(link.path);
        result.removed.push(link.relativePath);
        this.logger.debug(`Removed orphaned symlink from sync repo: ${link.relativePath}`);
      }
    }

    // Check for broken or outdated symlinks in sync repo
    for (const trackedFile of project.trackedFiles) {
      const linkPath = join(syncProjectDir, trackedFile);
      const sourcePath = join(project.path, trackedFile);

      try {
        const linkStat = await Deno.lstat(linkPath);
        if (linkStat.isSymlink) {
          const target = await Deno.readLink(linkPath);
          if (target !== sourcePath) {
            // Symlink points to wrong location, update it
            await Deno.remove(linkPath);
            await ensureSymlink(sourcePath, linkPath);
            result.updated.push(trackedFile);
            this.logger.debug(`Updated symlink in sync repo: ${trackedFile} -> ${sourcePath}`);
          }
        }
      } catch {
        // Symlink doesn't exist in sync repo, create it
        if (await exists(sourcePath)) {
          const linkDir = dirname(linkPath);
          await ensureDir(linkDir);
          await ensureSymlink(sourcePath, linkPath);
          result.added.push(trackedFile);
          this.logger.debug(`Added symlink to sync repo: ${trackedFile} -> ${sourcePath}`);
        }
      }
    }

    return result;
  }

  async removeSymlinks(syncProjectDir: string): Promise<string[]> {
    const removed: string[] = [];
    const links = await this.getProjectSymlinks(syncProjectDir);

    for (const link of links) {
      try {
        await Deno.remove(link.path);
        removed.push(link.relativePath);
        this.logger.debug(`Removed symlink from sync repo: ${link.relativePath}`);
      } catch (error) {
        this.logger.warn(
          `Failed to remove symlink from sync repo ${link.relativePath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    // Clean up empty directories in sync repo
    await this.cleanEmptyDirs(syncProjectDir);

    return removed;
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

  private async cleanEmptyDirs(dir: string): Promise<void> {
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
