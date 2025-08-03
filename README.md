# Claude-Sync

A git-aware CLI tool that tracks and version controls Claude-related project files across multiple projects by creating symlinks in a centralized sync repository.

## Overview

Claude-sync helps you manage Claude configuration files (like `CLAUDE.local.md`, `.claude/settings.local.json`, etc.) across multiple projects by:

1. **Automatically discovering** Claude files in your git repositories
2. **Creating symlinks** in a centralized sync repository
3. **Version controlling** these files using git
4. **Forwarding git commands** seamlessly to the sync repository

The tool feels like a natural extension of git, using familiar commands like `status`, `diff`, `commit`, and `push`.

## Installation

### Direct Download (Recommended)

```bash
# Build from source
git clone https://github.com/wyattjoh/claude-sync.git
cd claude-sync
deno task build

# Move to PATH
sudo mv claude-sync /usr/local/bin/
```

### Run Directly with Deno

```bash
# Run without installing
deno run --allow-read --allow-write --allow-env --allow-run \
  https://raw.githubusercontent.com/wyattjoh/claude-sync/main/src/main.ts --help
```

## Quick Start

1. **Initialize tracking** in any git repository:
   ```bash
   cd /path/to/your/project
   claude-sync init
   ```

2. **Check status** of tracked files:
   ```bash
   claude-sync status
   ```

3. **Add more files** to tracking:
   ```bash
   claude-sync add
   ```

4. **Commit changes**:
   ```bash
   claude-sync commit -m "feat: update Claude configuration"
   ```

5. **Push to remote** (optional):
   ```bash
   claude-sync push
   ```

## Commands

### Claude-Sync Specific Commands

- `claude-sync init [project-name]` - Initialize tracking for current git repository
- `claude-sync add [...files]` - Add files to tracking (auto-discovers Claude files)
- `claude-sync remove [...files]` - Remove files from tracking
- `claude-sync list` - List all tracked projects
- `claude-sync help` - Show help

### Git Commands (Forwarded)

All standard git commands work and are automatically scoped to your tracked files:

- `claude-sync status` - Show status of tracked files
- `claude-sync diff` - Show changes to tracked files  
- `claude-sync commit -m "message"` - Commit tracked file changes
- `claude-sync push` - Push to sync repository
- `claude-sync pull` - Pull latest changes
- `claude-sync log` - View commit history
- `claude-sync branch` - Manage branches
- And any other git command!

## File Types Tracked

By default, claude-sync tracks these Claude-related files:

- `CLAUDE.local.md` - Local project instructions
- `.claude/settings.local.json` - Local Claude settings
- `.claude/commands/*.md` - Custom command definitions
- `.claude/agents/*.md` - Custom agent configurations

## How It Works

1. **Git Repository Detection**: Automatically detects the current git repository
2. **File Discovery**: Scans for Claude-related files using configurable patterns
3. **Symlink Creation**: Creates symlinks in `~/.claude-sync/projects/your-project/`
4. **Git Operations**: All git commands operate on the sync repository with intelligent path filtering

## Repository Structure

```
~/.claude-sync/                    # Default sync repository
├── config/
│   ├── claude-sync.yaml           # Tool configuration
│   └── projects.yaml              # Project registry
├── projects/
│   ├── my-project/                # Your project's Claude files
│   │   ├── CLAUDE.local.md        # Symlink to original
│   │   └── .claude/
│   │       ├── settings.local.json
│   │       ├── commands/
│   │       └── agents/
│   └── another-project/
└── .git/                          # Git repository
```

## Examples

### Initialize a New Project

```bash
cd /path/to/my-awesome-project
claude-sync init

# Output:
# Scanning for Claude files...
# ✓ Found 3 Claude file(s):
#   • CLAUDE.local.md
#   • .claude/settings.local.json
#   • .claude/commands/build.md
# Creating symlinks...
# ✓ Initialized project: my-awesome-project
```

### Check Status Across All Projects

```bash
claude-sync status

# Output shows changes in current project only
# M  CLAUDE.local.md
# A  .claude/commands/test.md
```

### Add Files Manually

```bash
# Add specific files
claude-sync add .claude/agents/reviewer.md

# Add all discovered Claude files
claude-sync add --all
```

### View All Projects

```bash
claude-sync list

# Table view:
# Project              Path                     Files  Status
# my-awesome-project   /path/to/my-project     3      active
# another-project      /path/to/other          1      active
```

### Detailed Project Information

```bash
claude-sync list --long

# Detailed view:
# ✓ my-awesome-project
#   Path: /path/to/my-awesome-project
#   Files: 3 tracked
#   Last sync: 12/15/2024, 2:30:00 PM
#   Remote: git@github.com:user/my-awesome-project.git
```

## Configuration

The configuration file is located at `~/.claude-sync/config/claude-sync.yaml`:

```yaml
version: 1
defaultBranch: main
autoCommit: true
commitStyle: conventional
filePatterns:
  - CLAUDE.local.md
  - .claude/settings.local.json
  - .claude/commands/*.md
  - .claude/agents/*.md
excludePatterns:
  - node_modules
  - .git
  - dist
  - build
  - "*.log"
```

## Global Options

- `--sync-repo <path>` - Override sync repository location
- `--directory <dir>` - Override current working directory
- `-v, --verbose` - Enable verbose output

## Troubleshooting

### Not in a git repository
```bash
# Error: Not in a git repository
# Solution: Navigate to a git repository or initialize one
git init
claude-sync init
```

### Sync repository not initialized
```bash
# Error: Sync repository not initialized
# Solution: Run init in any git repository
claude-sync init
```

### Project not found
```bash
# Error: Project not found
# Solution: Initialize the current project
claude-sync init
```

### Broken symlinks
```bash
# Check for issues
claude-sync list --long

# Remove and re-add files
claude-sync remove --all
claude-sync add --all
```

## Development

### Requirements

- Deno 2.x or later
- Git

### Setup

```bash
git clone https://github.com/wyattjoh/claude-sync.git
cd claude-sync
deno task dev  # Run with --watch
```

### Available Tasks

```bash
deno task dev      # Run with file watching
deno task test     # Run tests
deno task lint     # Lint code
deno task fmt      # Format code
deno task build    # Build executable
deno task check    # Type check
```

### Project Structure

```
src/
├── commands/           # CLI command implementations
├── core/              # Core business logic
├── utils/             # Utility functions
├── types/             # TypeScript type definitions
└── main.ts           # Application entry point
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Roadmap

- [x] Core functionality (init, add, remove, list)
- [x] Git command forwarding
- [x] Project management
- [ ] Branch-aware operations
- [ ] Conflict resolution
- [ ] AI-powered configuration improvements
- [ ] Web dashboard
- [ ] Team collaboration features

## Support

- 📖 [Documentation](https://github.com/wyattjoh/claude-sync)
- 🐛 [Issue Tracker](https://github.com/wyattjoh/claude-sync/issues)
- 💬 [Discussions](https://github.com/wyattjoh/claude-sync/discussions)