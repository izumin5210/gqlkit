import {
  type BenchResult,
  type BenchSummary,
  formatMs,
  type IpcStats,
  summarizeGroups,
} from "./result.js";
import type { WorkloadGroup } from "./workloads.js";

function formatChange(base: number, head: number): string {
  if (!Number.isFinite(base) || base === 0) {
    return "";
  }
  const ratio = head / base;
  const percent = (ratio - 1) * 100;
  const sign = percent >= 0 ? "+" : "−";
  return `${sign}${Math.abs(percent).toFixed(1)}% (${ratio.toFixed(2)}x)`;
}

function row(label: string, base: number | null, head: number | null): string {
  const cell = (v: number | null) => (v === null ? "–" : formatMs(v));
  const change = base !== null && head !== null ? formatChange(base, head) : "";
  return `| ${label} | ${cell(base)} | ${cell(head)} | ${change} |`;
}

function ipcRows(base: IpcStats | null, head: IpcStats | null): string[] {
  if (base === null && head === null) {
    return [];
  }
  const count = (s: IpcStats | null) =>
    s === null ? "–" : String(s.requestCount);
  return [
    `| IPC requests (verification pass) | ${count(base)} | ${count(head)} | |`,
    row(
      "IPC round trip (verification pass)",
      base?.roundTripMs ?? null,
      head?.roundTripMs ?? null,
    ),
  ];
}

function stepNames(base: BenchSummary, head: BenchSummary): string[] {
  const names = [...base.stepsMs.keys()];
  for (const name of head.stepsMs.keys()) {
    if (!names.includes(name)) {
      names.push(name);
    }
  }
  return names;
}

interface CaseRatio {
  readonly name: string;
  readonly base: number;
  readonly head: number;
  readonly ratio: number;
}

function caseRatios(base: BenchSummary, head: BenchSummary): CaseRatio[] {
  const ratios: CaseRatio[] = [];
  for (const [name, baseMs] of base.caseMedianMs) {
    const headMs = head.caseMedianMs.get(name);
    if (headMs !== undefined) {
      ratios.push({ name, base: baseMs, head: headMs, ratio: headMs / baseMs });
    }
  }
  return ratios;
}

function groupSection(
  group: WorkloadGroup,
  base: BenchSummary,
  head: BenchSummary,
): string[] {
  const lines = [
    "",
    `### ${group}`,
    "",
    "| metric | base | head | change |",
    "|---|---|---|---|",
    row(
      "Generation total (sum of medians)",
      base.totalGenerationMs,
      head.totalGenerationMs,
    ),
    row(
      "Median iteration total",
      base.medianIterationMs,
      head.medianIterationMs,
    ),
  ];
  if (base.totalProcessMs !== null) {
    lines.push(
      row(
        "Process total (sum of medians)",
        base.totalProcessMs,
        head.totalProcessMs,
      ),
      row("Module load total", base.totalModuleLoadMs, head.totalModuleLoadMs),
    );
  }
  for (const step of stepNames(base, head)) {
    lines.push(
      row(
        `step: ${step}`,
        base.stepsMs.get(step) ?? null,
        head.stepsMs.get(step) ?? null,
      ),
    );
  }
  lines.push(...ipcRows(base.ipc, head.ipc));

  const ratios = caseRatios(base, head);
  if (ratios.length > 1) {
    const geomean = Math.exp(
      ratios.reduce((sum, r) => sum + Math.log(r.ratio), 0) / ratios.length,
    );
    const sorted = ratios.map((r) => r.ratio).sort((a, b) => a - b);
    lines.push(
      "",
      `Per-workload ratio (head / base) over ${ratios.length} workloads: geometric mean ${geomean.toFixed(2)}x, range ${sorted[0]!.toFixed(2)}x – ${sorted.at(-1)!.toFixed(2)}x.`,
    );
  }
  return lines;
}

function caseTable(title: string, entries: ReadonlyArray<CaseRatio>): string[] {
  if (entries.length === 0) {
    return [];
  }
  return [
    "",
    `### ${title}`,
    "",
    "| workload | base | head | ratio |",
    "|---|---|---|---|",
    ...entries.map(
      (r) =>
        `| ${r.name} | ${formatMs(r.base)} | ${formatMs(r.head)} | ${r.ratio.toFixed(2)}x |`,
    ),
  ];
}

interface RenderComparisonParams {
  readonly base: BenchResult;
  readonly head: BenchResult;
  /** How many slowdowns and speedups to list. */
  readonly top: number;
}

/** Renders a Markdown report comparing two benchmark results. */
export function renderComparison(params: RenderComparisonParams): string {
  const { base, head, top } = params;
  if (base.mode !== head.mode) {
    throw new Error(
      `cannot compare a ${base.mode} result with a ${head.mode} result`,
    );
  }
  if (base.schemaVersion !== head.schemaVersion) {
    throw new Error("results come from incompatible benchmark versions");
  }
  const baseGroups = summarizeGroups(base);
  const headGroups = summarizeGroups(head);

  const lines = [
    `## gqlkit benchmark (${base.mode})`,
    "",
    "| | base | head |",
    "|---|---|---|",
    `| label | ${base.label} | ${head.label} |`,
    `| revision | ${base.environment.gitRevision} | ${head.environment.gitRevision} |`,
    `| TypeScript | ${base.environment.typescript} | ${head.environment.typescript} |`,
    `| Node.js | ${base.environment.node} | ${head.environment.node} |`,
    `| platform | ${base.environment.platform}, ${base.environment.cpu} | ${head.environment.platform}, ${head.environment.cpu} |`,
    `| workloads × iterations | ${base.cases.length} × ${base.iterations} | ${head.cases.length} × ${head.iterations} |`,
  ];

  const allRatios: CaseRatio[] = [];
  for (const [group, baseSummary] of baseGroups) {
    const headSummary = headGroups.get(group);
    if (headSummary === undefined) {
      continue;
    }
    lines.push(...groupSection(group, baseSummary, headSummary));
    allRatios.push(...caseRatios(baseSummary, headSummary));
  }

  const headHashes = new Map(head.cases.map((c) => [c.name, c.outputHash]));
  const changedOutputs = base.cases
    .filter((c) => {
      const headHash = headHashes.get(c.name);
      return headHash !== undefined && headHash !== c.outputHash;
    })
    .map((c) => c.name);
  lines.push(
    "",
    changedOutputs.length === 0
      ? "Generated output is identical for every shared workload."
      : `Generated output differs for ${changedOutputs.length} workload(s): ${changedOutputs.join(", ")}`,
  );

  const sorted = [...allRatios].sort((a, b) => b.ratio - a.ratio);
  lines.push(
    ...caseTable(
      `Largest slowdowns (top ${top})`,
      sorted.filter((r) => r.ratio > 1).slice(0, top),
    ),
    ...caseTable(
      `Largest speedups (top ${top})`,
      [...sorted]
        .reverse()
        .filter((r) => r.ratio < 1)
        .slice(0, top),
    ),
  );

  return `${lines.join("\n")}\n`;
}
