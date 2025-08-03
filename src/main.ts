#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-run
import { Command } from "@cliffy/command";
import { GitForwarder } from "./core/git-forwarder.ts";
import { addCommand, initCommand, listCommand, removeCommand } from "./commands/mod.ts";
import { Logger } from "./utils/logger.ts";
import deno from "../deno.json" with { type: "json" };

async function main() {
  // Parse arguments to check if it's a claude-sync specific command
  const args = Deno.args;

  // Claude-sync specific commands
  const claudeSyncCommands = [
    "init",
    "add",
    "remove",
    "list",
    "config",
    "help",
    "--help",
    "-h",
    "--version",
    "-V",
  ];

  // Check if first arg is a claude-sync command
  const isClaudeSyncCommand = args.length === 0 || claudeSyncCommands.includes(args[0]);

  if (isClaudeSyncCommand) {
    // Route to specific command handler using Cliffy
    try {
      await new Command()
        .name("claude-sync")
        .version(deno.version)
        .description("Git-aware Claude file tracking and synchronization")
        .globalOption("-v, --verbose", "Enable verbose output")
        .globalOption(
          "--sync-repo <path:string>",
          "Override sync repository location",
        )
        .command("init", initCommand)
        .command("add", addCommand)
        .command("remove", removeCommand)
        .command("list", listCommand)
        .help({
          hints: true,
          types: true,
        })
        .parse(args);
    } catch (error) {
      const logger = new Logger();
      logger.error(error instanceof Error ? error.message : String(error));
      Deno.exit(1);
    }
  } else {
    // Forward to git
    try {
      const logger = new Logger();
      const forwarder = new GitForwarder(undefined, logger);

      // Ensure sync repo exists first
      await forwarder.ensureSyncRepo();

      // Forward command to git
      await forwarder.forward(args);
    } catch (error) {
      const logger = new Logger();
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes("not initialized")) {
        logger.error("Sync repository not initialized");
        logger.info("Run 'claude-sync init' first");
      } else if (errorMessage.includes("Not a git repository")) {
        logger.error("Not in a git repository");
        logger.info("Git commands can only be used within git repositories");
      } else {
        logger.error(`Git command failed: ${errorMessage}`);
      }

      Deno.exit(1);
    }
  }
}

// Handle uncaught errors
globalThis.addEventListener("error", (event) => {
  const logger = new Logger();
  logger.error(`Unexpected error: ${event.error.message}`);
  Deno.exit(1);
});

globalThis.addEventListener("unhandledrejection", (event) => {
  const logger = new Logger();
  logger.error(`Unhandled promise rejection: ${event.reason}`);
  Deno.exit(1);
});

if (import.meta.main) {
  await main();
}
