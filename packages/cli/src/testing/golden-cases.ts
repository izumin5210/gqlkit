/**
 * Loads golden test cases (`gen-orchestrator/testdata/<case>`) into the
 * `GenerationConfig` they are run with. Shared by the golden test and the
 * benchmark so both exercise every case with the exact same configuration.
 */

import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { GqlkitConfig } from "../config/index.js";
import type { ResolvedScalarMapping } from "../config-loader/index.js";
import {
  DEFAULT_RESOLVERS_PATH,
  DEFAULT_SCHEMA_PATH,
  DEFAULT_TYPEDEFS_PATH,
} from "../config-loader/types.js";
import type { GenerationConfig } from "../gen-orchestrator/orchestrator.js";

export interface GoldenCase {
  readonly name: string;
  readonly dir: string;
  readonly generationConfig: GenerationConfig;
  /**
   * diagnostics.json is a test-harness artifact, not a real gqlkit output —
   * it has no config.json-configurable path, unlike the generated files whose
   * location follows `output.*Path`.
   */
  readonly diagnosticsPath: string;
}

/** Case directories prefixed with `_` hold shared fixtures, not cases. */
export async function listGoldenCaseNames(
  testdataDir: string,
): Promise<string[]> {
  const entries = await readdir(testdataDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
    .map((e) => e.name)
    .sort();
}

async function readJsonIfExists<T>(path: string): Promise<T | null> {
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Mirrors `validateOutputPath` (config-loader/validator.ts): `undefined`
 * (key absent from config.json) resolves to the default path; an explicit
 * `null` is preserved as "suppressed" rather than falling back to the
 * default (a plain `??` would collapse both to the same case).
 */
function resolveOutputPath(
  configuredPath: string | null | undefined,
  defaultPath: string,
): string | null {
  return configuredPath === undefined ? defaultPath : configuredPath;
}

interface LoadGoldenCaseParams {
  readonly testdataDir: string;
  readonly name: string;
}

export async function loadGoldenCase(
  params: LoadGoldenCaseParams,
): Promise<GoldenCase> {
  const { testdataDir, name } = params;
  const caseDir = join(testdataDir, name);

  const config = await readJsonIfExists<Partial<GqlkitConfig>>(
    join(caseDir, "config.json"),
  );

  const customScalars: ResolvedScalarMapping[] | null =
    config?.scalars?.map((s) => ({
      graphqlName: s.name,
      typeName: s.tsType.name,
      importPath: s.tsType.from ?? null,
      only: s.only ?? null,
      description: s.description ?? null,
    })) ?? null;

  const discriminatorFields = new Map<string, ReadonlyArray<string>>();
  if (config?.discriminatorFields) {
    for (const [key, value] of Object.entries(config.discriminatorFields)) {
      discriminatorFields.set(key, typeof value === "string" ? [value] : value);
    }
  }

  const output = {
    resolversPath: resolveOutputPath(
      config?.output?.resolversPath,
      DEFAULT_RESOLVERS_PATH,
    ),
    typeDefsPath: resolveOutputPath(
      config?.output?.typeDefsPath,
      DEFAULT_TYPEDEFS_PATH,
    ),
    schemaPath: resolveOutputPath(
      config?.output?.schemaPath,
      DEFAULT_SCHEMA_PATH,
    ),
    importExtension: config?.output?.importExtension ?? "js",
    pruning: config?.output?.pruning ?? true,
  };

  return {
    name,
    dir: caseDir,
    generationConfig: {
      cwd: caseDir,
      sourceDir: config?.sourceDir ?? "src/gqlkit/schema",
      sourceIgnoreGlobs: config?.sourceIgnoreGlobs ?? [],
      output,
      configDir: null,
      customScalars,
      tsconfigPath: join(caseDir, "tsconfig.json"),
      discriminatorFields,
    },
    diagnosticsPath: join(caseDir, "src/gqlkit/__generated__/diagnostics.json"),
  };
}

export function serializeDiagnostics(
  diagnostics: ReadonlyArray<{
    code: string;
    message: string;
    severity: string;
    location: { file: string; line: number; column: number } | null;
  }>,
): string {
  const normalized = diagnostics.map((d) => ({
    ...d,
    location: d.location
      ? { ...d.location, file: d.location.file.replaceAll("\\", "/") }
      : null,
  }));
  return `${JSON.stringify(normalized, null, 2)}\n`;
}

export function findGeneratedFile(
  files: ReadonlyArray<{ filePath: string; content: string }>,
  filename: string,
): string | undefined {
  return files.find((f) => basename(f.filePath) === filename)?.content;
}
