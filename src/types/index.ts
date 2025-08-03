export interface Project {
  name: string;
  path: string;
  gitRemote?: string;
  branch: string;
  autoTrack: boolean;
  trackedFiles: string[];
  metadata: {
    addedAt: Date;
    lastSync: Date;
    lastModified: Date;
  };
}

export interface ClaudeFile {
  path: string;
  relativePath: string;
  type: "file" | "directory";
  size: number;
  modified: Date;
}

export interface SyncConfig {
  version: number;
  syncRepoPath: string;
  defaultBranch: string;
  autoCommit: boolean;
  commitStyle: "conventional" | "simple";
  filePatterns: string[];
  excludePatterns: string[];
  remoteUrl?: string;
  gitConfig?: {
    userName?: string;
    userEmail?: string;
  };
}

export interface ProjectRegistry {
  projects: Record<string, Project>;
}

export interface GitInfo {
  root: string;
  remote?: string;
  branch: string;
  isRepo: boolean;
}

export interface CommandOutput {
  success: boolean;
  stdout: string;
  stderr: string;
  code: number;
}
