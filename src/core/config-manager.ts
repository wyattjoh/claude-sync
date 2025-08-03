import { ensureDir, exists } from "@std/fs";
import { dirname } from "@std/path";
import { parse, stringify } from "@std/yaml";
import { Project, ProjectRegistry, SyncConfig } from "../types/index.ts";
import { ConfigError } from "../utils/errors.ts";
import { getConfigPath, getProjectsPath } from "../utils/paths.ts";

const DEFAULT_CONFIG: SyncConfig = {
  version: 1,
  syncRepoPath: "",
  defaultBranch: "main",
  autoCommit: true,
  commitStyle: "conventional",
  filePatterns: [
    "CLAUDE.local.md",
    ".claude/settings.local.json",
    ".claude/commands/*.md",
    ".claude/agents/*.md",
  ],
  excludePatterns: [
    "node_modules",
    ".git",
    "dist",
    "build",
    "*.log",
  ],
};

export class ConfigManager {
  private syncRepoPath: string;

  constructor(syncRepoPath: string) {
    this.syncRepoPath = syncRepoPath;
  }

  async loadConfig(): Promise<SyncConfig> {
    const configPath = getConfigPath(this.syncRepoPath);

    if (!await exists(configPath)) {
      return { ...DEFAULT_CONFIG, syncRepoPath: this.syncRepoPath };
    }

    try {
      const content = await Deno.readTextFile(configPath);
      const config = parse(content) as SyncConfig;

      // Validate config
      if (!config.version || typeof config.version !== "number") {
        throw new ConfigError("Invalid config version");
      }

      return { ...DEFAULT_CONFIG, ...config, syncRepoPath: this.syncRepoPath };
    } catch (error) {
      if (error instanceof ConfigError) {
        throw error;
      }
      throw new ConfigError(
        `Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async saveConfig(config: SyncConfig): Promise<void> {
    const configPath = getConfigPath(this.syncRepoPath);
    const configDir = dirname(configPath);

    try {
      await ensureDir(configDir);

      // Remove syncRepoPath from saved config as it's determined by location
      const { syncRepoPath, ...configToSave } = config;
      const yaml = stringify(configToSave, { indent: 2 });

      await Deno.writeTextFile(configPath, yaml);
    } catch (error) {
      throw new ConfigError(
        `Failed to save config: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async loadProjects(): Promise<ProjectRegistry> {
    const projectsPath = getProjectsPath(this.syncRepoPath);

    if (!await exists(projectsPath)) {
      return { projects: {} };
    }

    try {
      const content = await Deno.readTextFile(projectsPath);
      const data = parse(content) as any;

      // Convert date strings back to Date objects
      const projects: Record<string, Project> = {};

      for (const [name, project] of Object.entries(data.projects || {})) {
        const p = project as any;
        projects[name] = {
          ...p,
          metadata: {
            addedAt: new Date(p.metadata.addedAt),
            lastSync: new Date(p.metadata.lastSync),
            lastModified: new Date(p.metadata.lastModified),
          },
        };
      }

      return { projects };
    } catch (error) {
      throw new ConfigError(
        `Failed to load projects: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async saveProjects(registry: ProjectRegistry): Promise<void> {
    const projectsPath = getProjectsPath(this.syncRepoPath);
    const projectsDir = dirname(projectsPath);

    try {
      await ensureDir(projectsDir);

      // Convert dates to ISO strings for YAML serialization
      const projectsToSave: Record<string, any> = {};

      for (const [name, project] of Object.entries(registry.projects)) {
        projectsToSave[name] = {
          ...project,
          metadata: {
            addedAt: project.metadata.addedAt.toISOString(),
            lastSync: project.metadata.lastSync.toISOString(),
            lastModified: project.metadata.lastModified.toISOString(),
          },
        };
      }

      const yaml = stringify({ projects: projectsToSave }, { indent: 2 });
      await Deno.writeTextFile(projectsPath, yaml);
    } catch (error) {
      throw new ConfigError(
        `Failed to save projects: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getProject(name: string): Promise<Project | undefined> {
    const registry = await this.loadProjects();
    return registry.projects[name];
  }

  async addProject(name: string, project: Project): Promise<void> {
    const registry = await this.loadProjects();
    registry.projects[name] = project;
    await this.saveProjects(registry);
  }

  async updateProject(name: string, project: Partial<Project>): Promise<void> {
    const registry = await this.loadProjects();
    const existing = registry.projects[name];

    if (!existing) {
      throw new ConfigError(`Project not found: ${name}`);
    }

    registry.projects[name] = {
      ...existing,
      ...project,
      metadata: {
        ...existing.metadata,
        lastModified: new Date(),
      },
    };

    await this.saveProjects(registry);
  }

  async removeProject(name: string): Promise<void> {
    const registry = await this.loadProjects();
    delete registry.projects[name];
    await this.saveProjects(registry);
  }

  async projectExists(name: string): Promise<boolean> {
    const registry = await this.loadProjects();
    return name in registry.projects;
  }
}
