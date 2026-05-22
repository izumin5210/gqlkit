/**
 * Mirror shared/* into every eval directory.
 *
 * - `shared/fixtures/{db-schema,loaders}.ts` -> `evals/<name>/src/db/`
 * - `shared/skill/.claude/` -> `evals/<name>/.claude/` (only for `*-gqlkit-skill` evals)
 *   References that ship as symlinks under `.claude/skills/gqlkit-guide/references`
 *   are materialized as a directory copy so the sandbox sees real files.
 *
 * Run with: `pnpm sync` (from eval/).
 */

import {
  copyFileSync,
  cpSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
} from "node:fs";
// cpSync stays around for the shallow fixture copy below.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const evalRoot = resolve(here, "..");
const sharedDir = join(evalRoot, "shared");
const evalsDir = join(evalRoot, "evals");

const fixtureFiles = ["db-schema.ts", "loaders.ts"] as const;

function listEvalDirs(): string[] {
  if (!statSync(evalsDir, { throwIfNoEntry: false })?.isDirectory()) {
    return [];
  }
  return readdirSync(evalsDir).filter((name) => {
    const p = join(evalsDir, name);
    return statSync(p).isDirectory();
  });
}

function copyFixtures(evalName: string): void {
  const dest = join(evalsDir, evalName, "src", "db");
  mkdirSync(dest, { recursive: true });
  for (const file of fixtureFiles) {
    cpSync(join(sharedDir, "fixtures", file), join(dest, file));
  }
}

/**
 * Recursive copy that follows EVERY symlink — `cpSync({ dereference: true })`
 * only resolves the top-level entry, so nested symlinks (like
 * `.claude/skills/gqlkit-guide/references` -> packages/cli/docs) would leak
 * an absolute host path into the sandbox upload.
 */
function copyTreeDeref(src: string, dest: string): void {
  const stat = lstatSync(src);
  if (stat.isSymbolicLink()) {
    copyTreeDeref(realpathSync(src), dest);
    return;
  }
  if (stat.isDirectory()) {
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) {
      copyTreeDeref(join(src, entry), join(dest, entry));
    }
    return;
  }
  if (stat.isFile()) {
    copyFileSync(src, dest);
  }
}

function copySkill(evalName: string): void {
  if (!evalName.endsWith("-gqlkit-skill")) return;
  const src = join(sharedDir, "skill");
  const dest = join(evalsDir, evalName);
  // Wipe any prior copy so stale files / lingering symlinks don't survive.
  const claudeDest = join(dest, ".claude");
  rmSync(claudeDest, { recursive: true, force: true });
  copyTreeDeref(src, dest);
}

function main(): void {
  const evals = listEvalDirs();
  if (evals.length === 0) {
    console.log(
      "No evals found yet — create eval directories under evals/ first.",
    );
    return;
  }
  for (const name of evals) {
    copyFixtures(name);
    copySkill(name);
    console.log(`synced: ${name}`);
  }
}

main();
