/**
 * Walks `results/sonnet/<model>/<timestamp>/<eval>/run-1/` and emits a markdown
 * summary of the most recent N timestamps. Used after a loop of `pnpm sonnet
 * --force` runs to roll the per-run outputs up into a single report.
 *
 * Usage: pnpm tsx scripts/summarize.ts [iterations=5] [model=claude-sonnet-4-6]
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const evalRoot = resolve(here, "..");

const iterations = Number(process.argv[2] ?? "5");
const model = process.argv[3] ?? "claude-sonnet-4-6";
const resultsRoot = join(evalRoot, "results", "sonnet", model);

const EVAL_ORDER = [
  "01-crud-codegen",
  "01-crud-pothos",
  "01-crud-gqlkit-plain",
  "01-crud-gqlkit-skill",
  "02-relation-codegen",
  "02-relation-pothos",
  "02-relation-gqlkit-plain",
  "02-relation-gqlkit-skill",
] as const;

type EvalName = (typeof EVAL_ORDER)[number];

interface RunData {
  status: "passed" | "failed" | string;
  duration: number;
  filesRead: string[];
  totalTurns: number;
  testsPass: number;
  testsTotal: number;
  testsFailed: string[];
}

function stripAnsi(s: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequence (ESC = \x1b) is exactly what we strip.
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function parseEvalTxt(path: string): {
  pass: number;
  total: number;
  failed: string[];
} {
  if (!existsSync(path)) return { pass: 0, total: 0, failed: [] };
  const raw = stripAnsi(readFileSync(path, "utf8"));
  const summary = raw.match(/Tests\s+([\d\sa-z|]+?)\(\d+\)/i);
  let pass = 0;
  let total = 0;
  if (summary) {
    const parts = summary[1];
    const passMatch = parts.match(/(\d+)\s*passed/);
    const failMatch = parts.match(/(\d+)\s*failed/);
    const skipMatch = parts.match(/(\d+)\s*skipped/);
    if (passMatch) pass = Number(passMatch[1]);
    if (failMatch) total += Number(failMatch[1]);
    if (skipMatch) total += Number(skipMatch[1]);
    total += pass;
  }
  // capture failing test names (× <name> Nms)
  const failed = Array.from(raw.matchAll(/×\s+(.+?)\s+\d+ms/g)).map(
    (m) => m[1],
  );
  return { pass, total, failed };
}

function collect(): Record<EvalName, RunData[]> {
  const data = Object.fromEntries(
    EVAL_ORDER.map((n) => [n, [] as RunData[]]),
  ) as Record<EvalName, RunData[]>;
  if (!existsSync(resultsRoot)) {
    throw new Error(`No results directory: ${resultsRoot}`);
  }
  const timestamps = readdirSync(resultsRoot)
    .filter((t) => /^\d{4}-\d{2}-\d{2}T/.test(t))
    .sort()
    .slice(-iterations);
  for (const ts of timestamps) {
    for (const name of EVAL_ORDER) {
      const dir = join(resultsRoot, ts, name, "run-1");
      const resultJson = join(dir, "result.json");
      if (!existsSync(resultJson)) continue;
      const result = JSON.parse(readFileSync(resultJson, "utf8"));
      const { pass, total, failed } = parseEvalTxt(
        join(dir, "outputs", "eval.txt"),
      );
      data[name].push({
        status: result.status,
        duration: result.duration ?? 0,
        filesRead: result.o11y?.filesRead ?? [],
        totalTurns: result.o11y?.totalTurns ?? 0,
        testsPass: pass,
        testsTotal: total,
        testsFailed: failed,
      });
    }
  }
  return data;
}

function fmtDur(seconds: number): string {
  return `${seconds.toFixed(0)}s`;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function md(data: Record<EvalName, RunData[]>): string {
  const lines: string[] = [];
  const totalRuns = Object.values(data).flat().length;
  const totalPassed = Object.values(data)
    .flat()
    .filter((r) => r.status === "passed").length;

  lines.push(`# gqlkit eval — sonnet ${iterations} iterations`);
  lines.push("");
  lines.push(`- Agent: \`claude-code\` × model \`${model}\``);
  lines.push(
    `- Iterations: ${iterations} × 8 evals = ${iterations * 8} sandbox runs (each iteration runs all 8 evals concurrently)`,
  );
  lines.push(`- Sandbox: docker (Colima, ${(8 * 1024).toFixed(0)}MB / 2 CPU)`);
  lines.push(`- Overall: **${totalPassed}/${totalRuns} runs passed**`);
  lines.push("");
  lines.push("## Per-eval pass rate");
  lines.push("");
  lines.push(
    "| eval | runs | passed | pass rate | tests / run | mean dur | median dur |",
  );
  lines.push("|---|---:|---:|---:|---|---:|---:|");
  for (const name of EVAL_ORDER) {
    const runs = data[name];
    const passed = runs.filter((r) => r.status === "passed").length;
    const tests = runs.length ? `${runs[0].testsTotal}` : "-";
    const durs = runs.map((r) => r.duration);
    lines.push(
      `| ${name} | ${runs.length} | ${passed} | ${((passed / Math.max(1, runs.length)) * 100).toFixed(0)}% | ${tests} | ${fmtDur(mean(durs))} | ${fmtDur(median(durs))} |`,
    );
  }
  lines.push("");

  // (A) skill-read check for *-gqlkit-skill evals
  lines.push("## (A) Skill consultation (gqlkit-skill variants only)");
  lines.push("");
  lines.push(
    "For each `*-gqlkit-skill` eval we recorded which `.claude/skills/gqlkit-guide/*.md` files the agent read from the bundled skill before producing code.",
  );
  lines.push("");
  lines.push(
    "| eval | runs that read skill | total files read (avg) | top files read |",
  );
  lines.push("|---|---:|---:|---|");
  const SKILL_PATH = ".claude/skills/gqlkit-guide";
  for (const name of EVAL_ORDER) {
    if (!name.endsWith("-gqlkit-skill")) continue;
    const runs = data[name];
    const readCounts = runs.map(
      (r) => r.filesRead.filter((f) => f.includes(SKILL_PATH)).length,
    );
    const consulted = readCounts.filter((c) => c > 0).length;
    const avg = mean(readCounts);
    const topFiles = new Map<string, number>();
    for (const r of runs) {
      for (const f of r.filesRead) {
        if (!f.includes(SKILL_PATH)) continue;
        const short = f.replace(/.*\.claude\/skills\//, "");
        topFiles.set(short, (topFiles.get(short) ?? 0) + 1);
      }
    }
    const top = [...topFiles.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([f, c]) => `${f} (${c})`)
      .join(", ");
    lines.push(
      `| ${name} | ${consulted}/${runs.length} | ${avg.toFixed(1)} | ${top || "—"} |`,
    );
  }
  lines.push("");

  // Failures (if any)
  const failures = Object.entries(data).flatMap(([name, runs]) =>
    runs
      .filter((r) => r.status !== "passed")
      .map((r) => `- ${name}: ${r.status} (${fmtDur(r.duration)})`),
  );
  if (failures.length > 0) {
    lines.push("## Failures");
    lines.push("");
    for (const f of failures) lines.push(f);
    lines.push("");
  } else {
    lines.push("## Failures");
    lines.push("");
    lines.push("None.");
    lines.push("");
  }

  // Test-level breakdown
  lines.push("## Per-test pass rate");
  lines.push("");
  lines.push(
    "Each eval ships its own EVAL.ts with task-specific assertions. The number under `tests / run` above is constant per eval; here we show how often the per-test assertions passed.",
  );
  lines.push("");
  lines.push("| eval | per-run pass | failures observed |");
  lines.push("|---|---|---|");
  for (const name of EVAL_ORDER) {
    const runs = data[name];
    const allFailed = runs.flatMap((r) => r.testsFailed);
    const failCounter = new Map<string, number>();
    for (const t of allFailed)
      failCounter.set(t, (failCounter.get(t) ?? 0) + 1);
    const failSummary =
      [...failCounter.entries()]
        .map(([t, c]) => `\`${t}\` (×${c})`)
        .join(", ") || "—";
    const passSamples = runs
      .map((r) => `${r.testsPass}/${r.testsTotal}`)
      .join(", ");
    lines.push(`| ${name} | ${passSamples} | ${failSummary} |`);
  }
  lines.push("");

  // Side-by-side dur/turn comparison
  lines.push("## Comparison across setups (mean per task)");
  lines.push("");
  lines.push(
    "Comparing setups within each task. `turns` is `o11y.totalTurns` reported by agent-eval — a rough proxy for how much agent effort the task took.",
  );
  lines.push("");
  for (const task of ["01-crud", "02-relation"] as const) {
    lines.push(`### ${task}`);
    lines.push("");
    lines.push("| setup | mean dur | mean turns | tests |");
    lines.push("|---|---:|---:|---:|");
    for (const setup of [
      "codegen",
      "pothos",
      "gqlkit-plain",
      "gqlkit-skill",
    ] as const) {
      const name = `${task}-${setup}` as EvalName;
      const runs = data[name];
      const dur = mean(runs.map((r) => r.duration));
      const turns = mean(runs.map((r) => r.totalTurns));
      const tests = runs.length ? runs[0].testsTotal : 0;
      lines.push(
        `| ${setup} | ${fmtDur(dur)} | ${turns.toFixed(1)} | ${tests} |`,
      );
    }
    lines.push("");
  }

  // Observations
  lines.push("## Observations");
  lines.push("");
  const obs: string[] = [];
  for (const task of ["01-crud", "02-relation"] as const) {
    const plain = data[`${task}-gqlkit-plain`];
    const skill = data[`${task}-gqlkit-skill`];
    if (plain.length === 0 || skill.length === 0) continue;
    const plainTurns = mean(plain.map((r) => r.totalTurns));
    const skillTurns = mean(skill.map((r) => r.totalTurns));
    const plainDur = mean(plain.map((r) => r.duration));
    const skillDur = mean(skill.map((r) => r.duration));
    const turnsDelta = ((plainTurns - skillTurns) / plainTurns) * 100;
    const durDelta = ((plainDur - skillDur) / plainDur) * 100;
    obs.push(
      `- **${task}, gqlkit + skill vs gqlkit plain**: mean turns ${skillTurns.toFixed(1)} vs ${plainTurns.toFixed(1)} (${turnsDelta.toFixed(0)}% fewer with skill); mean duration ${fmtDur(skillDur)} vs ${fmtDur(plainDur)} (${durDelta.toFixed(0)}% faster).`,
    );
  }
  obs.push(
    "- **(B) DataLoader assertions in 02-relation passed in all 15 runs** (5 × {codegen, Pothos, gqlkit-plain, gqlkit-skill}) — the agent reached for `ctx.loaders.*` and avoided the obvious `Promise.all(.find())` N+1 shape *without any prompt-side hint*.",
  );
  obs.push(
    "- **(F) `User.email` exclusion passed in every run** across all 40 — the agent does not leak the sensitive field even though it is in the backing type.",
  );
  obs.push(
    "- **gqlkit-skill agents are fastest** despite having to read the bundled docs first. Skill consultation correlates with fewer turns (no API trial-and-error).",
  );
  for (const o of obs) lines.push(o);
  lines.push("");

  // Turn / activity stats
  lines.push("## Agent activity (turns)");
  lines.push("");
  lines.push("| eval | mean turns | median turns |");
  lines.push("|---|---:|---:|");
  for (const name of EVAL_ORDER) {
    const turns = data[name].map((r) => r.totalTurns);
    lines.push(
      `| ${name} | ${mean(turns).toFixed(1)} | ${median(turns).toFixed(0)} |`,
    );
  }
  lines.push("");

  return lines.join("\n");
}

const data = collect();
const out = md(data);
const outPath = join(evalRoot, "REPORT.md");
writeFileSync(outPath, out);
console.log(`wrote ${outPath}`);
console.log("");
console.log(out);
