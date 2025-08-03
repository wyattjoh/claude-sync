import { assertEquals } from "https://deno.land/std@0.211.0/assert/mod.ts";
import { getDefaultSyncRepoPath, sanitizeProjectName } from "../../src/utils/paths.ts";

Deno.test("getDefaultSyncRepoPath returns home/.claude-sync", () => {
  const path = getDefaultSyncRepoPath();
  assertEquals(path.includes(".claude-sync"), true);
});

Deno.test("sanitizeProjectName converts to lowercase", () => {
  assertEquals(sanitizeProjectName("MyProject"), "myproject");
});

Deno.test("sanitizeProjectName replaces invalid characters", () => {
  assertEquals(sanitizeProjectName("my project!@#"), "my-project");
});

Deno.test("sanitizeProjectName removes leading/trailing dashes", () => {
  assertEquals(sanitizeProjectName("-my-project-"), "my-project");
});

Deno.test("sanitizeProjectName collapses multiple dashes", () => {
  assertEquals(sanitizeProjectName("my---project"), "my-project");
});