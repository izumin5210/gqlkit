import type {
  ResolvedOutputConfig,
  ResolvedScalarMapping,
} from "../config-loader/index.js";
import type { ExtractResolversResult } from "../resolver-extractor/index.js";
import { extractResolvers } from "../resolver-extractor/index.js";
import { scanResolverDirectory } from "../resolver-extractor/scanner/file-scanner.js";
import { generateSchema } from "../schema-generator/index.js";
import { createSharedProgram } from "../shared/program-factory.js";
import type {
  Diagnostic,
  ExtractTypesResult,
} from "../type-extractor/index.js";
import { extractTypes } from "../type-extractor/index.js";
import { scanDirectory } from "../type-extractor/scanner/file-scanner.js";
import { writeFiles } from "./writer/file-writer.js";

export interface GenerationConfig {
  readonly cwd: string;
  readonly typesDir: string;
  readonly resolversDir: string;
  readonly outputDir: string;
  readonly configDir: string | null;
  readonly customScalars: ReadonlyArray<ResolvedScalarMapping> | null;
  readonly output: ResolvedOutputConfig | null;
  readonly tsconfigPath: string | null;
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
  const customScalarNames =
    config.customScalars?.map((s) => s.graphqlName) ?? [];

  const typeScanResult = await scanDirectory(config.typesDir);
  const resolverScanResult = await scanResolverDirectory(config.resolversDir);

  const scanDiagnostics: Diagnostic[] = [
    ...typeScanResult.errors,
    ...resolverScanResult.errors,
  ];

  if (scanDiagnostics.length > 0) {
    return {
      success: false,
      filesWritten: [],
      diagnostics: scanDiagnostics,
    };
  }

  const programResult = createSharedProgram({
    cwd: config.cwd,
    tsconfigPath: config.tsconfigPath ?? null,
    typeFiles: typeScanResult.files,
    resolverFiles: resolverScanResult.files,
  });

  if (programResult.diagnostics.length > 0 || !programResult.program) {
    return {
      success: false,
      filesWritten: [],
      diagnostics: [...programResult.diagnostics],
    };
  }

  const typesResult = await extractTypes({
    directory: config.typesDir,
    customScalarNames,
    program: programResult.program,
  });
  const resolversResult = await extractResolvers({
    directory: config.resolversDir,
    program: programResult.program,
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
    customScalarNames,
    enablePruning: null,
    sourceRoot: config.cwd,
  });

  allDiagnostics.push(...schemaResult.diagnostics);

  if (schemaResult.hasErrors) {
    return {
      success: false,
      filesWritten: [],
      diagnostics: allDiagnostics,
    };
  }

  const files: Array<{ filename: string; content: string }> = [];

  const outputAst = config.output?.ast;
  const outputSdl = config.output?.sdl;

  if (outputAst !== null) {
    const astFilename =
      outputAst && typeof outputAst === "string"
        ? (outputAst.split("/").pop() ?? "schema.ts")
        : "schema.ts";
    files.push({ filename: astFilename, content: schemaResult.typeDefsCode });
  }

  if (outputSdl !== null) {
    const sdlFilename =
      outputSdl && typeof outputSdl === "string"
        ? (outputSdl.split("/").pop() ?? "schema.graphql")
        : "schema.graphql";
    files.push({ filename: sdlFilename, content: schemaResult.sdlContent });
  }

  files.push({ filename: "resolvers.ts", content: schemaResult.resolversCode });

  const writeResult = await writeFiles({
    outputDir: config.outputDir,
    files,
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
