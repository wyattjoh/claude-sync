export class ClaudeSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaudeSyncError";
  }
}

export class GitNotFoundError extends ClaudeSyncError {
  constructor(path: string) {
    super(`Not a git repository: ${path}`);
    this.name = "GitNotFoundError";
  }
}

export class ProjectNotFoundError extends ClaudeSyncError {
  constructor(project: string) {
    super(`Project not found: ${project}`);
    this.name = "ProjectNotFoundError";
  }
}

export class ProjectExistsError extends ClaudeSyncError {
  constructor(project: string) {
    super(`Project already exists: ${project}`);
    this.name = "ProjectExistsError";
  }
}

export class SymlinkError extends ClaudeSyncError {
  constructor(message: string, path: string) {
    super(`Symlink error at ${path}: ${message}`);
    this.name = "SymlinkError";
  }
}

export class ConfigError extends ClaudeSyncError {
  constructor(message: string) {
    super(`Configuration error: ${message}`);
    this.name = "ConfigError";
  }
}

export class SyncRepoError extends ClaudeSyncError {
  constructor(message: string) {
    super(`Sync repository error: ${message}`);
    this.name = "SyncRepoError";
  }
}