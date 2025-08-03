# Claude-Sync Implementation Plan

## Project Overview

Claude-sync is a git-aware CLI tool that tracks and version controls Claude-related project files (CLAUDE.local.md, .claude/settings.local.json, etc.) across multiple projects by creating symlinks in a centralized sync repository.

## Core Architecture

### Design Principles

- **Git-native**: Feel like a natural extension of git
- **Zero-config**: Work immediately in any git repository
- **Non-invasive**: Never modify original project files
- **Smart forwarding**: Intelligently route commands to appropriate git repos

### Command Routing Strategy

1. **Claude-sync specific commands**:
   - `init` - Initialize tracking for current repository
   - `add` - Add files to tracking (with smart discovery)
   - `remove` - Remove files from tracking
   - `list` - List all tracked projects
   - `improve` - Future AI-powered improvements
   - `config` - Claude-sync specific configuration

2. **Git forwarding commands**:
   - All other commands forward to git with context-aware path translation
   - Examples: status, diff, commit, push, pull, log, branch, etc.

## Technology Stack

- **Runtime**: Deno 2.x with TypeScript
- **CLI Framework**: Cliffy - for robust command parsing and help generation
- **File Operations**: @std/fs - ensureDir, ensureSymlink, walk
- **Path Handling**: @std/path - cross-platform path manipulation
- **Config Format**: @std/yaml - human-readable configuration
- **Process Control**: Deno.Command - git command execution

## Project Structure

```
claude-sync/
├── src/
│   ├── main.ts                    # ✅ Entry point with command router
│   ├── commands/                  # Claude-sync specific commands
│   │   ├── init.ts               # ✅ Initialize project tracking
│   │   ├── add.ts                # ✅ Add files to tracking
│   │   ├── remove.ts             # ✅ Remove from tracking
│   │   ├── list.ts               # ✅ List tracked projects
│   │   ├── config.ts             # TODO: Configuration management
│   │   └── improve.ts            # TODO: AI improvements (future)
│   ├── core/
│   │   ├── git-forwarder.ts      # ✅ Git command forwarding logic
│   │   ├── project-detector.ts   # ✅ Git repo detection and validation
│   │   ├── file-scanner.ts       # ✅ Claude file discovery
│   │   ├── symlink-manager.ts    # ✅ Symlink create/update/delete
│   │   ├── config-manager.ts     # ✅ Load/save configuration
│   │   └── sync-repo.ts          # ✅ Sync repository management
│   ├── utils/
│   │   ├── paths.ts              # ✅ Path resolution utilities
│   │   ├── git.ts                # ✅ Git command helpers
│   │   ├── logger.ts             # ✅ Logging and output formatting
│   │   └── errors.ts             # ✅ Custom error types
│   └── types/
│       └── index.ts              # ✅ TypeScript type definitions
├── tests/
│   ├── unit/                     # 🚧 Unit tests (basic tests added)
│   ├── integration/              # TODO: Integration tests
│   └── e2e/                      # TODO: End-to-end tests
├── docs/
│   ├── README.md                 # ✅ User documentation
│   ├── CONTRIBUTING.md           # TODO: Contributor guidelines
│   └── examples/                 # TODO: Usage examples
├── scripts/
│   ├── install.sh                # TODO: Installation script
│   └── build.ts                  # TODO: Build and compile script
├── deno.json                     # ✅ Deno configuration
├── LICENSE                       # TODO: Choose appropriate license
└── .gitignore                    # ✅ Git ignore patterns
```

## Configuration Schema

### Sync Repository Configuration

Location: `~/.claude-sync/config/claude-sync.yaml`

```yaml
# TODO: Define configuration schema
version: 1
sync_repo_path: ~/.claude-sync
default_branch: main
auto_commit: true
commit_style: conventional # conventional, simple
file_patterns:
  - CLAUDE.local.md
  - .claude/settings.local.json
  - .claude/commands/*.md
  - .claude/agents/*.md
exclude_patterns:
  - node_modules
  - .git
  - dist
  - build
  - "*.log"
git_config:
  user_name: # Optional override
  user_email: # Optional override
```

### Project Registry

Location: `~/.claude-sync/config/projects.yaml`

```yaml
# TODO: Define project registry schema
projects:
  project-name:
    path: /absolute/path/to/project
    git_remote: git@github.com:user/repo.git
    branch: main
    auto_track: true
    tracked_files:
      - CLAUDE.local.md
      - .claude/settings.local.json
      - .claude/commands/build.md
      - .claude/agents/reviewer.md
    metadata:
      added_at: 2025-01-15T10:30:00Z
      last_sync: 2025-01-15T10:30:00Z
      last_modified: 2025-01-15T10:30:00Z
```

### Sync Repository Structure

Location: `~/.claude-sync/` (default)

```
~/.claude-sync/
├── .git/                         # Git repository
├── config/
│   ├── claude-sync.yaml          # Tool configuration
│   └── projects.yaml             # Project registry
├── projects/
│   ├── project-name-1/
│   │   ├── CLAUDE.local.md       # Symlink to original
│   │   └── .claude/
│   │       ├── settings.local.json
│   │       ├── commands/
│   │       │   └── *.md
│   │       └── agents/
│   │           └── *.md
│   └── project-name-2/
│       └── ...
└── .gitignore                    # Auto-generated
```

## Implementation Details

### 1. Main Entry Point (`src/main.ts`) ✅

```typescript
// ✅ COMPLETED: Implement main command router
import { Command } from "cliffy/command";
import { GitForwarder } from "./core/git-forwarder.ts";
import { addCommand, initCommand, listCommand, removeCommand } from "./commands/mod.ts";

const VERSION = "0.1.0";

async function main() {
  // Check if command is claude-sync specific
  const claudeSyncCommands = ["init", "add", "remove", "list", "config", "improve"];

  if (claudeSyncCommands.includes(Deno.args[0])) {
    // Route to specific command handler
    await new Command()
      .name("claude-sync")
      .version(VERSION)
      .description("Git-aware Claude file tracking and synchronization")
      .command("init", initCommand)
      .command("add", addCommand)
      .command("remove", removeCommand)
      .command("list", listCommand)
      .parse(Deno.args);
  } else {
    // Forward to git
    const forwarder = new GitForwarder();
    await forwarder.forward(Deno.args);
  }
}
```

### 2. Git Forwarding Logic (`src/core/git-forwarder.ts`) ✅

```typescript
// ✅ COMPLETED: Implement intelligent git command forwarding
export class GitForwarder {
  private syncRepoPath: string;
  private currentProject?: Project;

  async forward(args: string[]): Promise<void> {
    // 1. Detect current project context
    // 2. Translate paths for project-scoped commands
    // 3. Execute git command in sync repository
    // 4. Format output appropriately
  }

  private async detectCurrentProject(): Promise<Project | undefined> {
    // TODO: Find git root and match to tracked project
  }

  private translatePaths(args: string[]): string[] {
    // TODO: Add project-specific path filters
  }

  private async executeGit(args: string[]): Promise<CommandOutput> {
    // TODO: Run git command and capture output
  }
}
```

### 3. Project Detection (`src/core/project-detector.ts`) ✅

```typescript
// ✅ COMPLETED: Implement git repository detection
export class ProjectDetector {
  async detectGitRoot(startPath: string): Promise<string | undefined> {
    // Walk up directory tree looking for .git
  }

  async getRepoName(gitRoot: string): Promise<string> {
    // Extract from remote origin or directory name
  }

  async getGitInfo(gitRoot: string): Promise<GitInfo> {
    // Get remote, branch, and other metadata
  }
}
```

### 4. File Discovery (`src/core/file-scanner.ts`) ✅

```typescript
// ✅ COMPLETED: Implement Claude file discovery
export class FileScanner {
  async scan(rootPath: string, patterns: string[]): Promise<ClaudeFile[]> {
    // Recursive scan with pattern matching
    // Respect .gitignore
    // Return file metadata
  }

  async watchFiles(files: ClaudeFile[]): Promise<void> {
    // TODO: Future - watch for changes
  }
}
```

### 5. Symlink Management (`src/core/symlink-manager.ts`) ✅

```typescript
// ✅ COMPLETED: Implement symlink operations
export class SymlinkManager {
  async createSymlinks(files: ClaudeFile[], targetDir: string): Promise<void> {
    // Ensure directory structure
    // Create symlinks safely
    // Handle conflicts
  }

  async updateSymlinks(project: Project): Promise<void> {
    // Detect changes
    // Update symlinks
    // Clean orphaned links
  }

  async removeSymlinks(project: Project): Promise<void> {
    // Remove all symlinks for project
    // Clean empty directories
  }
}
```

## Command Implementations

### `init` Command

```typescript
// TODO: Implement init command
// 1. Detect git repository
// 2. Extract project name
// 3. Initialize sync repo if needed
// 4. Add project to registry
// 5. Create initial symlinks
```

### `add` Command

```typescript
// TODO: Implement add command
// 1. Parse file arguments or scan for all
// 2. Validate files exist
// 3. Create/update symlinks
// 4. Update project registry
// 5. Optional: auto-commit
```

### `remove` Command

```typescript
// TODO: Implement remove command
// 1. Parse file/project arguments
// 2. Remove symlinks
// 3. Update registry
// 4. Clean empty directories
```

### `list` Command

```typescript
// TODO: Implement list command
// 1. Load project registry
// 2. Check project health
// 3. Display formatted output
// 4. Show statistics
```

## Error Handling

### Custom Error Types

```typescript
// TODO: Define error types
export class ClaudeSyncError extends Error {}
export class GitNotFoundError extends ClaudeSyncError {}
export class ProjectNotFoundError extends ClaudeSyncError {}
export class SymlinkError extends ClaudeSyncError {}
export class ConfigError extends ClaudeSyncError {}
```

### Error Messages

- TODO: Create user-friendly error messages
- TODO: Provide helpful suggestions for resolution
- TODO: Include relevant context and paths

## Testing Strategy

### Unit Tests

- TODO: Test each core module in isolation
- TODO: Mock file system and git operations
- TODO: Test error conditions

### Integration Tests

- TODO: Test command workflows
- TODO: Test git forwarding
- TODO: Test symlink operations

### E2E Tests

- TODO: Test full user workflows
- TODO: Test in different environments
- TODO: Test edge cases

## Build and Distribution

### Development Setup

```bash
# TODO: Create development scripts
deno task dev      # Run with --watch
deno task test     # Run all tests
deno task lint     # Lint code
deno task fmt      # Format code
```

### Build Process

```bash
# TODO: Create build script
deno task build    # Compile to single executable
deno task package  # Create distribution packages
```

### Installation Methods

- TODO: Direct binary download
- TODO: Install script (curl | sh)
- TODO: Package managers (homebrew, etc.)

## Future Enhancements

### Phase 1: Core Functionality (Current)

- [ ] Basic command structure
- [ ] Git forwarding
- [ ] File discovery and symlinking
- [ ] Project management

### Phase 2: Enhanced Git Integration

- [ ] Branch-aware operations
- [ ] Conflict resolution
- [ ] Stash support
- [ ] Cherry-pick improvements

### Phase 3: AI-Powered Features

- [ ] Command/agent improvement suggestions
- [ ] Cross-project pattern analysis
- [ ] Automated optimization
- [ ] Interactive improvement mode

### Phase 4: Collaboration Features

- [ ] Multi-user sync repositories
- [ ] Shared configurations
- [ ] Team templates
- [ ] Web dashboard

## Performance Considerations

- TODO: Optimize file scanning for large projects
- TODO: Cache git command outputs
- TODO: Lazy load configuration
- TODO: Minimize startup time

## Security Considerations

- TODO: Validate symlink targets
- TODO: Sanitize user inputs
- TODO: Secure configuration storage
- TODO: Handle sensitive file contents

## Documentation TODOs

- [ ] Write comprehensive README
- [ ] Create quick start guide
- [ ] Document all commands
- [ ] Add troubleshooting guide
- [ ] Create example workflows
- [ ] Write contributor guidelines

## Release Checklist

- [x] All tests passing
- [x] Documentation complete
- [x] Binary builds tested (macOS ARM64)
- [ ] Installation scripts tested
- [ ] GitHub release created
- [ ] Announcement prepared

## Implementation Status

### ✅ Completed (Phase 1)

- **Project Structure**: Complete project setup with proper TypeScript configuration
- **Core Business Logic**: All core modules implemented and working
  - Project detection and git integration ✅
  - File discovery with pattern matching ✅
  - Symlink management with conflict resolution ✅
  - Configuration management with YAML ✅
  - Sync repository with git operations ✅
  - Git command forwarding with context awareness ✅
- **CLI Commands**: All basic commands implemented
  - `init` - Initialize project tracking ✅
  - `add` - Add files to tracking ✅
  - `remove` - Remove files/projects ✅
  - `list` - List all tracked projects ✅
- **Error Handling**: Comprehensive error handling with user-friendly messages ✅
- **Type Safety**: Full TypeScript implementation with zero type errors ✅
- **Testing**: Basic unit tests for core utilities ✅
- **Documentation**: Complete README with examples and usage ✅
- **Build System**: Working Deno compilation to standalone executable ✅

### 🚧 Ready for Enhancement (Phase 2+)

- **Configuration Command**: `claude-sync config` for managing settings
- **AI Improvements**: `claude-sync improve` for Claude file optimization
- **Advanced Git Integration**: Branch-aware operations, conflict resolution
- **Installation Scripts**: Automated installation via curl | sh
- **Cross-platform Builds**: Windows, Linux binaries
- **Integration Tests**: End-to-end workflow testing
- **Performance Optimization**: Large project handling improvements
