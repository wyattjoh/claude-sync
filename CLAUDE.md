# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude-sync is a git-aware CLI tool that tracks and version controls Claude configuration files across multiple projects by creating symlinks in a centralized sync repository. The tool uses intelligent command routing to either handle claude-sync specific commands or forward git commands to the sync repository with proper project context.

## Development Commands

### Build and Run

```bash
deno task dev      # Run with file watching and hot reload
deno task build    # Compile to standalone executable
deno task check    # Type check all TypeScript files
```

### Testing and Code Quality

```bash
deno task test     # Run all tests
deno task lint     # Lint code
deno task fmt      # Format code
```

### Manual Testing

```bash
# Test the built CLI
./claude-sync --help
./claude-sync init
./claude-sync list
```

## Core Architecture

### Command Routing Strategy

The entry point (`src/main.ts`) implements a dual-routing system:

1. **Claude-sync commands** (`init`, `add`, `remove`, `list`) are handled by Cliffy command framework
2. **Git commands** (everything else) are forwarded through `GitForwarder` to the sync repository

### Key Architectural Components

**GitForwarder** (`src/core/git-forwarder.ts`):

- Routes git commands to sync repository with project-specific path filtering
- Detects current project context and applies appropriate scoping
- Handles commands like `status`, `diff`, `commit` with intelligent path translation

**SyncRepository** (`src/core/sync-repo.ts`):

- Manages the centralized `~/.claude-sync` repository
- Handles git operations (init, commit, push, branch management)
- Provides project directory management within sync repo

**ProjectDetector** (`src/core/project-detector.ts`):

- Detects git repositories and extracts project metadata
- Maps current working directory to tracked projects
- Generates project names from git remotes or directory names

**FileScanner** (`src/core/file-scanner.ts`):

- Discovers Claude files using configurable glob patterns
- Respects .gitignore and exclusion patterns
- Supports exact files and wildcard patterns

**SymlinkManager** (`src/core/symlink-manager.ts`):

- Creates and maintains symlinks between original files and sync repository
- Handles conflict resolution and broken link cleanup
- Ensures proper directory structure mirroring

**ConfigManager** (`src/core/config-manager.ts`):

- Manages YAML configuration files and project registry
- Handles serialization of projects with metadata (dates, paths, tracking info)
- Provides CRUD operations for project management

### Data Flow

1. User runs `claude-sync <command>` in any git repository
2. Main router determines if it's a claude-sync command or git command
3. For git commands: GitForwarder detects current project, translates paths, executes in sync repo
4. For claude-sync commands: Appropriate command handler manages project state and sync repo

### File Patterns

Default tracked patterns (configurable):

- `CLAUDE.local.md` - Local project instructions
- `.claude/settings.local.json` - Local Claude settings
- `.claude/commands/*.md` - Custom command definitions
- `.claude/agents/*.md` - Custom agent configurations

### Sync Repository Structure

```
~/.claude-sync/
├── config/
│   ├── claude-sync.yaml    # Tool configuration
│   └── projects.yaml       # Project registry with metadata
├── projects/
│   └── <project-name>/     # Symlinked files organized by project
└── .git/                   # Git repository for version control
```

## Error Handling Patterns

- Custom error classes in `src/utils/errors.ts` for different failure modes
- User-friendly error messages with actionable suggestions
- Graceful handling of missing git repositories, broken symlinks, and permission issues
- TypeScript error handling with proper type guards for unknown errors

## Development Notes

### TypeScript Configuration

- Strict type checking enabled
- All error handling uses `error instanceof Error` type guards
- Custom types defined in `src/types/index.ts`

### Dependencies

- **Cliffy**: CLI framework for commands, prompts, and table display
- **Deno Standard Library**: File operations, path handling, YAML parsing
- Uses Deno's built-in `Command` API for git subprocess execution

### Testing Strategy

- Unit tests for utility functions in `tests/utils/`
- Core business logic should be tested in isolation
- Use Deno's built-in test runner with appropriate permissions
