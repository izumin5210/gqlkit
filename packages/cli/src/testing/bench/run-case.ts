/**
 * Child process entry for the per-process benchmark mode: runs one golden
 * case the way a fresh `gqlkit gen` process would, and prints its timings as
 * a single JSON line on stdout.
 */

import { parseArgs } from "node:util";
import { loadGoldenCase } from "../golden-cases.js";
import { TESTDATA_DIR } from "./paths.js";
import { readStepMeasures } from "./result.js";
import { findGoldenMismatches } from "./verify.js";

export interface RunCaseOutput {
  readonly moduleLoadMs: number;
  readonly generationMs: number;
  readonly stepsMs: Record<string, number>;
  readonly mismatches: ReadonlyArray<string>;
}

const { values } = parseArgs({
  options: {
    case: { type: "string" },
    verify: { type: "boolean", default: false },
  },
});
if (values.case === undefined) {
  throw new Error("--case is required");
}

const goldenCase = await loadGoldenCase({
  testdataDir: TESTDATA_DIR,
  name: values.case,
});

// Imported lazily so the TypeScript package load is measured on its own.
const loadStart = performance.now();
const { executeGeneration } = await import(
  "../../gen-orchestrator/orchestrator.js"
);
const moduleLoadMs = performance.now() - loadStart;

const start = performance.now();
const result = await executeGeneration(goldenCase.generationConfig);
const generationMs = performance.now() - start;

const output: RunCaseOutput = {
  moduleLoadMs,
  generationMs,
  stepsMs: readStepMeasures(),
  mismatches: values.verify
    ? await findGoldenMismatches(goldenCase, result)
    : [],
};
process.stdout.write(`${JSON.stringify(output)}\n`);
