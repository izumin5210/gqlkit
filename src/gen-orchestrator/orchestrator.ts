import type { ExtractResolversResult } from "../resolver-extractor/index.js";
import { extractResolvers } from "../resolver-extractor/index.js";
import { generateSchema } from "../schema-generator/index.js";
import type {
  Diagnostic,
  ExtractTypesResult,
} from "../type-extractor/index.js";
import { extractTypes } from "../type-extractor/index.js";
import { writeFiles } from "./writer/file-writer.js";

export interface GenerationConfig {
  readonly cwd: string;
  readonly typesDir: string;
  readonly resolversDir: string;
  readonly outputDir: string;
}

export interface GenerationResult {
  readonly success: boolean;
  readonly filesWritten: ReadonlyArray<string>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

function collectAllDiagnostics(
  typesResult: ExtractTypesResult,
  resolversResult: ExtractResolversResult,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  diagnostics.push(...typesResult.diagnostics.errors);
  diagnostics.push(...typesResult.diagnostics.warnings);
  diagnostics.push(...resolversResult.diagnostics.errors);
  diagnostics.push(...resolversResult.diagnostics.warnings);

  return diagnostics;
}

function hasErrors(
  typesResult: ExtractTypesResult,
  resolversResult: ExtractResolversResult,
): boolean {
  return (
    typesResult.diagnostics.errors.length > 0 ||
    resolversResult.diagnostics.errors.length > 0
  );
}

export async function executeGeneration(
  config: GenerationConfig,
): Promise<GenerationResult> {
  const typesResult = await extractTypes({ directory: config.typesDir });
  const resolversResult = await extractResolvers({
    directory: config.resolversDir,
  });

  const allDiagnostics = collectAllDiagnostics(typesResult, resolversResult);

  if (hasErrors(typesResult, resolversResult)) {
    return {
      success: false,
      filesWritten: [],
      diagnostics: allDiagnostics,
    };
  }

  const schemaResult = generateSchema({
    typesResult,
    resolversResult,
    outputDir: config.outputDir,
  });

  allDiagnostics.push(...schemaResult.diagnostics);

  if (schemaResult.hasErrors) {
    return {
      success: false,
      filesWritten: [],
      diagnostics: allDiagnostics,
    };
  }

  const writeResult = await writeFiles({
    outputDir: config.outputDir,
    files: [
      { filename: "schema.ts", content: schemaResult.typeDefsCode },
      { filename: "resolvers.ts", content: schemaResult.resolversCode },
    ],
  });

  if (!writeResult.success) {
    return {
      success: false,
      filesWritten: writeResult.writtenPaths,
      diagnostics: allDiagnostics,
    };
  }

  return {
    success: true,
    filesWritten: writeResult.writtenPaths,
    diagnostics: allDiagnostics,
  };
}
