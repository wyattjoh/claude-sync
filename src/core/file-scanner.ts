import { walk } from "@std/fs";
import { globToRegExp, join, relative } from "@std/path";
import { ClaudeFile } from "../types/index.ts";

export class FileScanner {
  private filePatterns: string[];
  private excludePatterns: string[];

  constructor(
    filePatterns: string[] = [
      "CLAUDE.local.md",
      ".claude/settings.local.json",
      ".claude/commands/*.md",
      ".claude/agents/*.md",
    ],
    excludePatterns: string[] = [
      "node_modules",
      ".git",
      "dist",
      "build",
      "*.log",
    ],
  ) {
    this.filePatterns = filePatterns;
    this.excludePatterns = excludePatterns;
  }

  async scan(rootPath: string): Promise<ClaudeFile[]> {
    const files: ClaudeFile[] = [];
    const excludeRegexps = this.excludePatterns.map((pattern) => globToRegExp(pattern));
    const includeRegexps = this.filePatterns.map((pattern) => globToRegExp(pattern));

    // Also check for exact file matches
    const exactFiles = this.filePatterns.filter((p) => !p.includes("*"));
    
    for (const exactFile of exactFiles) {
      const fullPath = join(rootPath, exactFile);
      try {
        const stat = await Deno.stat(fullPath);
        if (stat.isFile) {
          files.push({
            path: fullPath,
            relativePath: exactFile,
            type: "file",
            size: stat.size,
            modified: stat.mtime!,
          });
        }
      } catch {
        // File doesn't exist, skip
      }
    }

    // Walk directory for pattern matches
    for await (const entry of walk(rootPath, {
      includeDirs: false,
      includeFiles: true,
    })) {
      const relativePath = relative(rootPath, entry.path);
      
      // Check if path should be excluded
      const shouldExclude = excludeRegexps.some((regex) => 
        regex.test(relativePath) || relativePath.split("/").some(part => regex.test(part))
      );
      
      if (shouldExclude) {
        continue;
      }

      // Check if path matches any include pattern
      const shouldInclude = includeRegexps.some((regex) => regex.test(relativePath));
      
      if (shouldInclude && !files.some(f => f.path === entry.path)) {
        const stat = await Deno.stat(entry.path);
        files.push({
          path: entry.path,
          relativePath,
          type: "file",
          size: stat.size,
          modified: stat.mtime!,
        });
      }
    }

    return files;
  }

  async scanSingle(rootPath: string, filePath: string): Promise<ClaudeFile | undefined> {
    const fullPath = join(rootPath, filePath);
    try {
      const stat = await Deno.stat(fullPath);
      if (stat.isFile) {
        return {
          path: fullPath,
          relativePath: filePath,
          type: "file",
          size: stat.size,
          modified: stat.mtime!,
        };
      }
    } catch {
      // File doesn't exist
    }
    return undefined;
  }

  isClaudeFile(relativePath: string): boolean {
    const includeRegexps = this.filePatterns.map((pattern) => globToRegExp(pattern));
    return includeRegexps.some((regex) => regex.test(relativePath)) ||
           this.filePatterns.includes(relativePath);
  }
}