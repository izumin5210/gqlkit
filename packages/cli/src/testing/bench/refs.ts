/**
 * Benchmarks two git refs and prints the comparison:
 * `pnpm bench:refs --base <ref> --head <ref> [bench options]`.
 *
 * Each ref is checked out into its own worktree, but the benchmark harness
 * (this directory and the golden case loader) is copied from the current
 * checkout, so both refs are measured with identical methodology — including
 * refs that predate the harness.
 */

import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { parseArgs } from "node:util";
import { renderComparison } from "./comparison.js";
import { PACKAGE_ROOT, resolveUserPath } from "./paths.js";
import type { BenchResult } from "./result.js";

/** Files that make up the harness, relative to `packages/cli`. */
const HARNESS_PATHS = ["src/testing/bench", "src/testing/golden-cases.ts"];

/** Bench options forwarded verbatim to both runs. */
const FORWARDED_OPTIONS = ["mode", "iterations", "warmup", "filter"] as const;

const USAGE = `Usage: pnpm bench:refs --base <ref> --head <ref> [options]

Options:
  --mode, --iterations, --warmup, --filter   forwarded to \`pnpm bench\`
  --work-dir <dir>   where worktrees and results go (default: a new temp dir)
  --keep             keep the worktrees afterwards
  --top <n>          slowdowns/speedups to list (default: 10)`;

interface RunParams {
  readonly cwd: string;
  readonly command: string;
  readonly args: ReadonlyArray<string>;
}

function run(params: RunParams): string {
  const { cwd, command, args } = params;
  process.stderr.write(`$ ${command} ${args.join(" ")}  (in ${cwd})\n`);
  return execFileSync(command, args, {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "inherit"],
    // pnpm is a .cmd shim on Windows, which execFile cannot start directly.
    shell: process.platform === "win32",
  }).trim();
}

interface PrepareRefParams {
  readonly repoRoot: string;
  readonly ref: string;
  readonly tree: string;
}

async function prepareRef(params: PrepareRefParams): Promise<string> {
  const { repoRoot, ref, tree } = params;
  const sha = run({
    cwd: repoRoot,
    command: "git",
    args: ["rev-parse", "--verify", `${ref}^{commit}`],
  });
  run({
    cwd: repoRoot,
    command: "git",
    args: ["worktree", "add", "--detach", tree, sha],
  });

  const packageInRepo = relative(repoRoot, PACKAGE_ROOT);
  for (const harnessPath of HARNESS_PATHS) {
    await cp(
      join(PACKAGE_ROOT, harnessPath),
      join(tree, packageInRepo, harnessPath),
      { recursive: true, force: true },
    );
  }

  // Lifecycle scripts (git hooks, native example deps) are irrelevant here.
  run({
    cwd: tree,
    command: "pnpm",
    args: ["install", "--frozen-lockfile", "--ignore-scripts"],
  });
  // Each package is built with the TypeScript version it depends on, which
  // differs between packages/runtime and packages/cli during the TS 7 move.
  for (const pkg of ["packages/runtime", packageInRepo]) {
    const pkgDir = join(tree, pkg);
    // TypeScript 7 does not export `bin/tsc`, but both versions export
    // package.json.
    const typescriptPackageJson = createRequire(
      join(pkgDir, "package.json"),
    ).resolve("typescript/package.json");
    run({
      cwd: pkgDir,
      command: process.execPath,
      args: [join(dirname(typescriptPackageJson), "bin/tsc"), "--build"],
    });
  }
  return sha;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      base: { type: "string" },
      head: { type: "string" },
      mode: { type: "string" },
      iterations: { type: "string" },
      warmup: { type: "string" },
      filter: { type: "string" },
      "work-dir": { type: "string" },
      keep: { type: "boolean", default: false },
      top: { type: "string", default: "10" },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  if (values.base === undefined || values.head === undefined) {
    throw new Error(`--base and --head are required\n\n${USAGE}`);
  }

  const repoRoot = run({
    cwd: PACKAGE_ROOT,
    command: "git",
    args: ["rev-parse", "--show-toplevel"],
  });
  const workDir =
    values["work-dir"] === undefined
      ? await mkdtemp(join(tmpdir(), "gqlkit-bench-"))
      : resolveUserPath(values["work-dir"]);
  const forwarded = FORWARDED_OPTIONS.flatMap((name) =>
    values[name] === undefined ? [] : [`--${name}`, values[name]],
  );
  const packageInRepo = relative(repoRoot, PACKAGE_ROOT);

  const trees: string[] = [];
  const results: BenchResult[] = [];
  try {
    for (const [role, ref] of [
      ["base", values.base],
      ["head", values.head],
    ] as const) {
      const tree = join(workDir, role);
      trees.push(tree);
      const sha = await prepareRef({ repoRoot, ref, tree });
      const out = join(workDir, `${role}.json`);
      run({
        cwd: tree,
        command: process.execPath,
        args: [
          join(tree, packageInRepo, "dist/testing/bench/main.js"),
          "--out",
          out,
          "--label",
          `${ref} (${sha.slice(0, 7)})`,
          ...forwarded,
        ],
      });
      results.push(JSON.parse(await readFile(out, "utf-8")) as BenchResult);
    }
  } finally {
    if (!values.keep) {
      for (const tree of trees) {
        run({
          cwd: repoRoot,
          command: "git",
          args: ["worktree", "remove", "--force", tree],
        });
      }
    }
  }

  const report = renderComparison({
    base: results[0]!,
    head: results[1]!,
    top: Number(values.top),
  });
  const reportPath = join(workDir, "comparison.md");
  await writeFile(reportPath, report);
  process.stderr.write(`Wrote ${reportPath}\n`);
  process.stdout.write(report);
}

await main();
