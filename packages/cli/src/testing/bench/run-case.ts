/**
 * Child process entry for the per-process benchmark mode: runs one workload
 * the way a fresh `gqlkit gen` process would, and prints its timings as a
 * single JSON line on stdout.
 */

import { parseArgs } from "node:util";
import { readStepMeasures } from "./result.js";
import { hashGenerationResult } from "./verify.js";
import { loadWorkload } from "./workloads.js";

export interface RunCaseOutput {
  readonly moduleLoadMs: number;
  readonly generationMs: number;
  readonly stepsMs: Record<string, number>;
  readonly problems: ReadonlyArray<string>;
  /** Set only when run with `--verify`. */
  readonly outputHash: string | null;
}

const { values } = parseArgs({
  options: {
    workload: { type: "string" },
    verify: { type: "boolean", default: false },
  },
});
if (values.workload === undefined) {
  throw new Error("--workload is required");
}

const workload = await loadWorkload(values.workload);

// Imported lazily so the TypeScript package load is measured on its own.
const loadStart = performance.now();
const { executeGeneration } = await import(
  "../../gen-orchestrator/orchestrator.js"
);
const moduleLoadMs = performance.now() - loadStart;

const start = performance.now();
const result = await executeGeneration(workload.generationConfig);
const generationMs = performance.now() - start;

const output: RunCaseOutput = {
  moduleLoadMs,
  generationMs,
  stepsMs: readStepMeasures(),
  problems: values.verify ? await workload.check(result) : [],
  outputHash: values.verify
    ? hashGenerationResult(workload.generationConfig, result)
    : null,
};
process.stdout.write(`${JSON.stringify(output)}\n`);
