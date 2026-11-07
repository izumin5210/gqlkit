/**
 * Benchmarks `executeGeneration` over the golden test cases.
 *
 * Every run starts with an untimed pass that checks each case's output
 * against its golden files (and collects TypeScript 7 IPC stats), then times
 * `--warmup` + `--iterations` passes over all cases.
 *
 * Modes:
 * - in-process: all cases in one process, like the golden test suite.
 *   Caches that outlive one generation (e.g. parsed lib files) stay warm.
 * - per-process: a fresh Node.js process per case, like `gqlkit gen`. Also
 *   measures process startup and the TypeScript package load.
 */

import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { cpus, tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { executeGeneration } from "../../gen-orchestrator/orchestrator.js";
import {
  type GoldenCase,
  listGoldenCaseNames,
  loadGoldenCase,
} from "../golden-cases.js";
import {
  PACKAGE_ROOT,
  RUNTIME_TYPES_PATH,
  resolveUserPath,
  siblingModulePath,
  TESTDATA_DIR,
} from "./paths.js";
import {
  type BenchEnvironment,
  type BenchMode,
  type BenchResult,
  type CaseResult,
  type CaseSample,
  formatIpcLines,
  formatMs,
  type IpcStats,
  readIpcStats,
  readStepMeasures,
  summarize,
} from "./result.js";
import type { RunCaseOutput } from "./run-case.js";
import { findGoldenMismatches } from "./verify.js";

const DEFAULT_ITERATIONS: Record<BenchMode, number> = {
  "in-process": 5,
  "per-process": 3,
};

const USAGE = `Usage: pnpm bench [options]

Options:
  --mode <in-process|per-process>  (default: in-process)
  --iterations <n>   timed passes over all cases (default: 5 in-process, 3 per-process)
  --warmup <n>       untimed passes after verification (default: 0)
  --filter <regex>   only run cases whose name matches
  --label <text>     label stored in the result (default: <branch>@<revision>)
  --out <path>       write the raw result as JSON
  --top <n>          slowest cases to list (default: 10)`;

function parsePositiveInt(name: string, value: string, min: number): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) {
    throw new Error(`--${name} must be an integer >= ${min}, got "${value}"`);
  }
  return n;
}

function git(args: ReadonlyArray<string>): string | null {
  try {
    return execFileSync("git", args, {
      cwd: PACKAGE_ROOT,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function collectEnvironment(): BenchEnvironment {
  const require = createRequire(import.meta.url);
  const typescript = require("typescript/package.json") as { version: string };
  const cpuList = cpus();
  const revision = git(["rev-parse", "--short", "HEAD"]) ?? "unknown";
  const dirty = (git(["status", "--porcelain"]) ?? "") !== "";
  return {
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    cpu: `${cpuList[0]?.model ?? "unknown"} x${cpuList.length}`,
    typescript: typescript.version,
    gitRevision: dirty ? `${revision}-dirty` : revision,
  };
}

interface Measurement {
  readonly sample: CaseSample;
  readonly mismatches: ReadonlyArray<string>;
}

interface RunCaseParams {
  readonly goldenCase: GoldenCase;
  readonly verify: boolean;
  /** Where TypeScript 7 writes IPC timing dumps; null disables them. */
  readonly ipcDir: string | null;
}

async function runInProcess(params: RunCaseParams): Promise<Measurement> {
  const { goldenCase, verify, ipcDir } = params;
  // The TypeScript 7 API reads this when each instance is created.
  if (ipcDir === null) {
    delete process.env["TS_API_TIMING_DIR"];
  } else {
    process.env["TS_API_TIMING_DIR"] = ipcDir;
  }

  performance.clearMeasures();
  const start = performance.now();
  const result = await executeGeneration(goldenCase.generationConfig);
  const generationMs = performance.now() - start;
  const stepsMs = readStepMeasures();

  return {
    sample: { generationMs, stepsMs, processMs: null, moduleLoadMs: null },
    mismatches: verify ? await findGoldenMismatches(goldenCase, result) : [],
  };
}

async function runPerProcess(params: RunCaseParams): Promise<Measurement> {
  const { goldenCase, verify, ipcDir } = params;
  const env = { ...process.env };
  delete env["TS_API_TIMING_DIR"];
  if (ipcDir !== null) {
    env["TS_API_TIMING_DIR"] = ipcDir;
  }
  const args = [
    // Keeps loaders such as tsx when the benchmark itself runs from source.
    ...process.execArgv,
    siblingModulePath("run-case"),
    "--case",
    goldenCase.name,
    ...(verify ? ["--verify"] : []),
  ];

  const start = performance.now();
  const stdout = await new Promise<string>((resolvePromise, reject) => {
    const child = spawn(process.execPath, args, {
      env,
      stdio: ["ignore", "pipe", "inherit"],
    });
    let out = "";
    child.stdout.setEncoding("utf-8");
    child.stdout.on("data", (chunk: string) => {
      out += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise(out);
      } else {
        reject(new Error(`case ${goldenCase.name} exited with code ${code}`));
      }
    });
  });
  const processMs = performance.now() - start;

  const lastLine = stdout.trim().split("\n").at(-1) ?? "";
  const output = JSON.parse(lastLine) as RunCaseOutput;
  return {
    sample: {
      generationMs: output.generationMs,
      stepsMs: output.stepsMs,
      processMs,
      moduleLoadMs: output.moduleLoadMs,
    },
    mismatches: output.mismatches,
  };
}

function printSummary(result: BenchResult, top: number): void {
  const summary = summarize(result);
  const { environment: env } = result;
  const lines = [
    `gqlkit golden benchmark: ${result.label}`,
    `mode: ${result.mode}, cases: ${result.cases.length}, iterations: ${result.iterations} (+${result.warmup} warmup)`,
    `TypeScript ${env.typescript}, Node.js ${env.node}, ${env.platform}, ${env.cpu}`,
    "",
    `Generation total (sum of per-case medians): ${formatMs(summary.totalGenerationMs)}`,
    `Median iteration total:                     ${formatMs(summary.medianIterationMs)}`,
  ];
  if (summary.totalProcessMs !== null) {
    lines.push(
      `Process total (sum of per-case medians):    ${formatMs(summary.totalProcessMs)}`,
    );
  }
  if (summary.totalModuleLoadMs !== null) {
    lines.push(
      `Module load total:                          ${formatMs(summary.totalModuleLoadMs)}`,
    );
  }

  if (summary.stepsMs.size > 0) {
    lines.push("", "Steps (sum of per-case medians):");
    const width = Math.max(...[...summary.stepsMs.keys()].map((k) => k.length));
    for (const [step, ms] of summary.stepsMs) {
      const share = (ms / summary.totalGenerationMs) * 100;
      lines.push(
        `  ${step.padEnd(width)}  ${formatMs(ms).padStart(10)}  ${share.toFixed(1).padStart(5)}%`,
      );
    }
  }

  if (summary.ipc !== null) {
    lines.push("", "TypeScript API IPC (verification pass, all cases):");
    lines.push(...formatIpcLines(summary.ipc).map((l) => `  ${l}`));
  }

  const slowest = [...summary.caseMedianMs]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top);
  if (slowest.length > 0) {
    lines.push("", `Slowest cases (median generation time):`);
    const width = Math.max(...slowest.map(([name]) => name.length));
    for (const [name, ms] of slowest) {
      lines.push(`  ${name.padEnd(width)}  ${formatMs(ms).padStart(10)}`);
    }
  }

  process.stdout.write(`${lines.join("\n")}\n`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      mode: { type: "string", default: "in-process" },
      iterations: { type: "string" },
      warmup: { type: "string", default: "0" },
      filter: { type: "string" },
      label: { type: "string" },
      out: { type: "string" },
      top: { type: "string", default: "10" },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }

  if (values.mode !== "in-process" && values.mode !== "per-process") {
    throw new Error(`unknown --mode "${values.mode}"\n\n${USAGE}`);
  }
  const mode: BenchMode = values.mode;
  const iterations =
    values.iterations === undefined
      ? DEFAULT_ITERATIONS[mode]
      : parsePositiveInt("iterations", values.iterations, 1);
  const warmup = parsePositiveInt("warmup", values.warmup, 0);
  const top = parsePositiveInt("top", values.top, 0);
  const filter = values.filter === undefined ? null : new RegExp(values.filter);

  if (!existsSync(RUNTIME_TYPES_PATH)) {
    throw new Error(
      `${RUNTIME_TYPES_PATH} is missing; golden cases need @gqlkit-ts/runtime built (run \`pnpm build\`).`,
    );
  }

  const names = (await listGoldenCaseNames(TESTDATA_DIR)).filter(
    (name) => filter === null || filter.test(name),
  );
  if (names.length === 0) {
    throw new Error("no golden case matches --filter");
  }
  const cases = await Promise.all(
    names.map((name) => loadGoldenCase({ testdataDir: TESTDATA_DIR, name })),
  );
  const runCase = mode === "in-process" ? runInProcess : runPerProcess;
  const log = (message: string) => process.stderr.write(`${message}\n`);

  log(`Verifying ${cases.length} cases against golden files...`);
  const ipcRoot = await mkdtemp(join(tmpdir(), "gqlkit-bench-ipc-"));
  const ipcByCase = new Map<string, IpcStats | null>();
  const failures: string[] = [];
  try {
    for (const [index, goldenCase] of cases.entries()) {
      const ipcDir = join(ipcRoot, String(index));
      const { mismatches } = await runCase({
        goldenCase,
        verify: true,
        ipcDir,
      });
      if (mismatches.length > 0) {
        failures.push(`${goldenCase.name}: ${mismatches.join(", ")}`);
      }
      ipcByCase.set(
        goldenCase.name,
        existsSync(ipcDir) ? await readIpcStats(ipcDir) : null,
      );
    }
  } finally {
    await rm(ipcRoot, { recursive: true, force: true });
  }
  if (failures.length > 0) {
    throw new Error(
      `output differs from golden files, refusing to report timings:\n  ${failures.join("\n  ")}`,
    );
  }

  const samples = new Map<string, CaseSample[]>(cases.map((c) => [c.name, []]));
  for (let pass = 0; pass < warmup + iterations; pass++) {
    const timed = pass >= warmup;
    log(
      timed
        ? `Iteration ${pass - warmup + 1}/${iterations}`
        : `Warmup ${pass + 1}/${warmup}`,
    );
    // Cases run round-robin across passes so slow drift in machine load
    // spreads over all cases instead of skewing a few.
    for (const goldenCase of cases) {
      const { sample } = await runCase({
        goldenCase,
        verify: false,
        ipcDir: null,
      });
      if (timed) {
        samples.get(goldenCase.name)!.push(sample);
      }
    }
  }

  const environment = collectEnvironment();
  const caseResults: CaseResult[] = cases.map((c) => ({
    name: c.name,
    samples: samples.get(c.name)!,
    ipc: ipcByCase.get(c.name) ?? null,
  }));
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]) ?? "unknown";
  const result: BenchResult = {
    schemaVersion: 1,
    label: values.label ?? `${branch}@${environment.gitRevision}`,
    mode,
    iterations,
    warmup,
    environment,
    cases: caseResults,
  };

  if (values.out !== undefined) {
    const outPath = resolveUserPath(values.out);
    await writeFile(outPath, `${JSON.stringify(result, null, 2)}\n`);
    log(`Wrote ${outPath}`);
  }
  printSummary(result, top);
}

await main();
