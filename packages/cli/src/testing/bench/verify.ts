import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import type {
  GenerationConfig,
  GenerationResult,
} from "../../gen-orchestrator/orchestrator.js";
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

/** Describes every error diagnostic and a failed generation. */
export function findErrorDiagnostics(result: GenerationResult): string[] {
  const problems = result.diagnostics
    .filter((d) => d.severity === "error")
    .map((d) => `${d.code}: ${d.message}`);
  if (!result.success && problems.length === 0) {
    problems.push("generation failed without an error diagnostic");
  }
  return problems;
}

/**
 * Fingerprints a result (diagnostics and generated files, with paths made
 * relative to the project) so comparisons can flag workloads whose output
 * changed between two refs.
 */
export function hashGenerationResult(
  config: GenerationConfig,
  result: GenerationResult,
): string {
  const hash = createHash("sha256");
  hash.update(serializeDiagnostics(result.diagnostics));
  const files = result.files
    .map((f) => ({
      path: relative(config.cwd, f.filePath).replaceAll("\\", "/"),
      content: f.content,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  for (const file of files) {
    hash.update(`\0${file.path}\0${file.content}`);
  }
  return hash.digest("hex").slice(0, 16);
}
