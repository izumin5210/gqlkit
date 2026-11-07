import {
  type BenchResult,
  type BenchSummary,
  formatMs,
  type IpcStats,
  summarize,
} from "./result.js";

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
  const baseSummary = summarize(base);
  const headSummary = summarize(head);

  const lines = [
    `## gqlkit golden benchmark (${base.mode})`,
    "",
    "| | base | head |",
    "|---|---|---|",
    `| label | ${base.label} | ${head.label} |`,
    `| revision | ${base.environment.gitRevision} | ${head.environment.gitRevision} |`,
    `| TypeScript | ${base.environment.typescript} | ${head.environment.typescript} |`,
    `| Node.js | ${base.environment.node} | ${head.environment.node} |`,
    `| platform | ${base.environment.platform}, ${base.environment.cpu} | ${head.environment.platform}, ${head.environment.cpu} |`,
    `| cases × iterations | ${base.cases.length} × ${base.iterations} | ${head.cases.length} × ${head.iterations} |`,
    "",
    "| metric | base | head | change |",
    "|---|---|---|---|",
    row(
      "Generation total (sum of per-case medians)",
      baseSummary.totalGenerationMs,
      headSummary.totalGenerationMs,
    ),
    row(
      "Median iteration total",
      baseSummary.medianIterationMs,
      headSummary.medianIterationMs,
    ),
  ];
  if (baseSummary.totalProcessMs !== null) {
    lines.push(
      row(
        "Process total (sum of per-case medians)",
        baseSummary.totalProcessMs,
        headSummary.totalProcessMs,
      ),
      row(
        "Module load total",
        baseSummary.totalModuleLoadMs,
        headSummary.totalModuleLoadMs,
      ),
    );
  }
  for (const step of stepNames(baseSummary, headSummary)) {
    lines.push(
      row(
        `step: ${step}`,
        baseSummary.stepsMs.get(step) ?? null,
        headSummary.stepsMs.get(step) ?? null,
      ),
    );
  }
  lines.push(...ipcRows(baseSummary.ipc, headSummary.ipc));

  const ratios: { name: string; base: number; head: number; ratio: number }[] =
    [];
  for (const [name, baseMs] of baseSummary.caseMedianMs) {
    const headMs = headSummary.caseMedianMs.get(name);
    if (headMs !== undefined) {
      ratios.push({ name, base: baseMs, head: headMs, ratio: headMs / baseMs });
    }
  }
  const onlyInOne =
    baseSummary.caseMedianMs.size +
    headSummary.caseMedianMs.size -
    2 * ratios.length;

  if (ratios.length > 0) {
    const geomean = Math.exp(
      ratios.reduce((sum, r) => sum + Math.log(r.ratio), 0) / ratios.length,
    );
    const sorted = [...ratios].sort((a, b) => b.ratio - a.ratio);
    lines.push(
      "",
      `Per-case ratio (head / base) over ${ratios.length} shared cases: geometric mean ${geomean.toFixed(2)}x, range ${sorted.at(-1)!.ratio.toFixed(2)}x – ${sorted[0]!.ratio.toFixed(2)}x.` +
        (onlyInOne > 0 ? ` ${onlyInOne} case(s) exist on one side only.` : ""),
    );

    const caseTable = (title: string, entries: typeof ratios) => {
      if (entries.length === 0) {
        return [];
      }
      return [
        "",
        `### ${title}`,
        "",
        "| case | base | head | ratio |",
        "|---|---|---|---|",
        ...entries.map(
          (r) =>
            `| ${r.name} | ${formatMs(r.base)} | ${formatMs(r.head)} | ${r.ratio.toFixed(2)}x |`,
        ),
      ];
    };
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
  }

  return `${lines.join("\n")}\n`;
}
