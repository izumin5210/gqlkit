/**
 * Shared scratch-directory helper for tests that exercise real filesystem
 * behavior (config loading, source scanning, hook execution, CLI command
 * integration). Each of those suites previously hand-rolled the same
 * `mkdtemp`/`rm` pair under a different prefix (refactor-plan.md §1.5).
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Creates a fresh temp directory under the OS temp root, named `<prefix><random>`. */
export async function createTempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

/**
 * Recursively removes a directory created by `createTempDir`. `force: true`
 * so an already-missing directory (e.g. a test that removed it itself) does
 * not fail cleanup.
 */
export async function removeTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}
