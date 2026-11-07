import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { WorkloadGroup } from "./workloads.js";

export type BenchMode = "in-process" | "per-process";

/** Prefix of the `performance.measure` entries the orchestrator records. */
const STEP_MEASURE_PREFIX = "gqlkit:";

/**
 * Totals from the TypeScript 7 API timing dump (`TS_API_TIMING_DIR`). The
 * TypeScript 5 compiler API runs in-process and has no equivalent.
 */
export interface IpcStats {
  readonly requestCount: number;
  readonly roundTripMs: number;
  readonly serverTimeMs: number;
  readonly transportOverheadMs: number;
  readonly bytesSent: number;
  readonly bytesReceived: number;
  readonly sourceFilesFetched: number;
  readonly nodesMaterialized: number;
}

export interface CaseSample {
  /** Wall time of one `executeGeneration` call. */
  readonly generationMs: number;
  /** Per-step durations recorded by the orchestrator, keyed by step name. */
  readonly stepsMs: Readonly<Record<string, number>>;
  /** Spawn-to-exit wall time of the child process (per-process mode only). */
  readonly processMs: number | null;
  /**
   * Time the child spent importing the orchestrator module graph, including
   * the TypeScript package (per-process mode only).
   */
  readonly moduleLoadMs: number | null;
}

export interface CaseResult {
  readonly name: string;
  readonly group: WorkloadGroup;
  /** One sample per measured iteration, in iteration order. */
  readonly samples: ReadonlyArray<CaseSample>;
  /** Collected during the untimed verification pass; null without TS 7. */
  readonly ipc: IpcStats | null;
  /** Fingerprint of the generated output, from the verification pass. */
  readonly outputHash: string;
}

export interface BenchEnvironment {
  readonly node: string;
  readonly platform: string;
  readonly cpu: string;
  readonly typescript: string;
  readonly gitRevision: string;
}

export interface BenchResult {
  readonly schemaVersion: 2;
  readonly label: string;
  readonly mode: BenchMode;
  readonly iterations: number;
  readonly warmup: number;
  readonly environment: BenchEnvironment;
  readonly cases: ReadonlyArray<CaseResult>;
}

function median(values: ReadonlyArray<number>): number {
  if (values.length === 0) {
    return Number.NaN;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

export function readStepMeasures(): Record<string, number> {
  const steps: Record<string, number> = {};
  for (const entry of performance.getEntriesByType("measure")) {
    if (entry.name.startsWith(STEP_MEASURE_PREFIX)) {
      const step = entry.name.slice(STEP_MEASURE_PREFIX.length);
      steps[step] = (steps[step] ?? 0) + entry.duration;
    }
  }
  return steps;
}

const EMPTY_IPC_STATS: IpcStats = {
  requestCount: 0,
  roundTripMs: 0,
  serverTimeMs: 0,
  transportOverheadMs: 0,
  bytesSent: 0,
  bytesReceived: 0,
  sourceFilesFetched: 0,
  nodesMaterialized: 0,
};

function addIpcStats(a: IpcStats, b: IpcStats): IpcStats {
  return {
    requestCount: a.requestCount + b.requestCount,
    roundTripMs: a.roundTripMs + b.roundTripMs,
    serverTimeMs: a.serverTimeMs + b.serverTimeMs,
    transportOverheadMs: a.transportOverheadMs + b.transportOverheadMs,
    bytesSent: a.bytesSent + b.bytesSent,
    bytesReceived: a.bytesReceived + b.bytesReceived,
    sourceFilesFetched: a.sourceFilesFetched + b.sourceFilesFetched,
    nodesMaterialized: a.nodesMaterialized + b.nodesMaterialized,
  };
}

/** Sums every timing dump written to `dir`; null when none was written. */
export async function readIpcStats(dir: string): Promise<IpcStats | null> {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    return null;
  }
  let stats = EMPTY_IPC_STATS;
  for (const file of files) {
    const dump = JSON.parse(await readFile(join(dir, file), "utf-8")) as {
      timing: { totals: IpcStats };
    };
    stats = addIpcStats(stats, dump.timing.totals);
  }
  return stats;
}

export interface BenchSummary {
  /** Sum over cases of each case's median generation time. */
  readonly totalGenerationMs: number;
  /** Median over iterations of the summed generation time of all cases. */
  readonly medianIterationMs: number;
  readonly totalProcessMs: number | null;
  readonly totalModuleLoadMs: number | null;
  /**
   * Sum over cases of each step's median, plus `(unattributed)`: generation
   * time outside every measured step.
   */
  readonly stepsMs: ReadonlyMap<string, number>;
  readonly ipc: IpcStats | null;
  readonly caseMedianMs: ReadonlyMap<string, number>;
}

const UNATTRIBUTED_STEP = "(unattributed)";

function sumMedians(
  cases: ReadonlyArray<CaseResult>,
  pick: (sample: CaseSample) => number | null,
): number | null {
  let total = 0;
  for (const c of cases) {
    const values = c.samples.map(pick).filter((v): v is number => v !== null);
    if (values.length === 0) {
      return null;
    }
    total += median(values);
  }
  return total;
}

function summarizeCases(
  cases: ReadonlyArray<CaseResult>,
  iterations: number,
): BenchSummary {
  const totalGenerationMs = sumMedians(cases, (s) => s.generationMs)!;

  const iterationTotals: number[] = [];
  for (let i = 0; i < iterations; i++) {
    let total = 0;
    for (const c of cases) {
      total += c.samples[i]?.generationMs ?? 0;
    }
    iterationTotals.push(total);
  }

  const stepNames: string[] = [];
  for (const c of cases) {
    for (const sample of c.samples) {
      for (const step of Object.keys(sample.stepsMs)) {
        if (!stepNames.includes(step)) {
          stepNames.push(step);
        }
      }
    }
  }
  const stepsMs = new Map<string, number>();
  for (const step of stepNames) {
    stepsMs.set(step, sumMedians(cases, (s) => s.stepsMs[step] ?? 0)!);
  }
  if (stepNames.length > 0) {
    const attributed = [...stepsMs.values()].reduce((a, b) => a + b, 0);
    stepsMs.set(UNATTRIBUTED_STEP, totalGenerationMs - attributed);
  }

  let ipc: IpcStats | null = null;
  for (const c of cases) {
    if (c.ipc !== null) {
      ipc = addIpcStats(ipc ?? EMPTY_IPC_STATS, c.ipc);
    }
  }

  return {
    totalGenerationMs,
    medianIterationMs: median(iterationTotals),
    totalProcessMs: sumMedians(cases, (s) => s.processMs),
    totalModuleLoadMs: sumMedians(cases, (s) => s.moduleLoadMs),
    stepsMs,
    ipc,
    caseMedianMs: new Map(
      cases.map((c) => [c.name, median(c.samples.map((s) => s.generationMs))]),
    ),
  };
}

/**
 * Summarizes each workload group on its own: their scales differ by orders
 * of magnitude, so a single total would only reflect the largest group.
 */
export function summarizeGroups(
  result: BenchResult,
): ReadonlyMap<WorkloadGroup, BenchSummary> {
  const byGroup = new Map<WorkloadGroup, CaseResult[]>();
  for (const c of result.cases) {
    const cases = byGroup.get(c.group) ?? [];
    cases.push(c);
    byGroup.set(c.group, cases);
  }
  return new Map(
    [...byGroup].map(([group, cases]) => [
      group,
      summarizeCases(cases, result.iterations),
    ]),
  );
}

export function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(1)} ms`;
}

export function formatIpcLines(ipc: IpcStats): string[] {
  const mib = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
  return [
    `requests: ${ipc.requestCount}`,
    `round trip: ${formatMs(ipc.roundTripMs)} (server ${formatMs(ipc.serverTimeMs)}, transport ${formatMs(ipc.transportOverheadMs)})`,
    `payload: ${mib(ipc.bytesSent)} sent, ${mib(ipc.bytesReceived)} received`,
    `source files fetched: ${ipc.sourceFilesFetched}, nodes materialized: ${ipc.nodesMaterialized}`,
  ];
}
