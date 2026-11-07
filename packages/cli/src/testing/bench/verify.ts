import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { GenerationResult } from "../../gen-orchestrator/orchestrator.js";
import {
  findGeneratedFile,
  type GoldenCase,
  serializeDiagnostics,
} from "../golden-cases.js";

async function readFileOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Compares a generation result with the case's golden files and describes
 * each mismatch. Timing an implementation that produces wrong output says
 * nothing useful, so the benchmark refuses to report such runs.
 */
export async function findGoldenMismatches(
  goldenCase: GoldenCase,
  result: GenerationResult,
): Promise<string[]> {
  const mismatches: string[] = [];

  const expectedDiagnostics = await readFileOrNull(goldenCase.diagnosticsPath);
  if (serializeDiagnostics(result.diagnostics) !== expectedDiagnostics) {
    mismatches.push("diagnostics.json differs");
  }

  const { output } = goldenCase.generationConfig;
  const outputs = [
    { filename: "typeDefs.ts", path: output.typeDefsPath },
    { filename: "schema.graphql", path: output.schemaPath },
    { filename: "resolvers.ts", path: output.resolversPath },
  ];
  for (const { filename, path } of outputs) {
    if (path === null) {
      continue;
    }
    const expected = await readFileOrNull(resolve(goldenCase.dir, path));
    const actual = result.success
      ? (findGeneratedFile(result.files, filename) ?? null)
      : null;
    if (actual !== expected) {
      mismatches.push(`${filename} differs`);
    }
  }

  return mismatches;
}
