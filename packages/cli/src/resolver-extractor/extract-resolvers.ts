import { createProgramFromFiles } from "../type-extractor/extractor/type-extractor.js";
import type { Diagnostic, Diagnostics } from "../type-extractor/types/index.js";
import { analyzeSignatures } from "./analyzer/signature-analyzer.js";
import {
  convertToFields,
  type MutationFieldDefinitions,
  type QueryFieldDefinitions,
  type TypeExtension,
} from "./converter/field-converter.js";
import { extractResolversFromProgram } from "./extractor/resolver-extractor.js";
import { scanResolverDirectory } from "./scanner/file-scanner.js";

export interface ExtractResolversOptions {
  readonly directory: string;
}

export interface ExtractResolversResult {
  readonly queryFields: QueryFieldDefinitions;
  readonly mutationFields: MutationFieldDefinitions;
  readonly typeExtensions: ReadonlyArray<TypeExtension>;
  readonly diagnostics: Diagnostics;
}

function createEmptyResult(diagnostics: Diagnostics): ExtractResolversResult {
  return {
    queryFields: { fields: [] },
    mutationFields: { fields: [] },
    typeExtensions: [],
    diagnostics,
  };
}

function getDiagnosticKey(d: Diagnostic): string {
  const locationKey = d.location
    ? `${d.location.file}:${d.location.line}:${d.location.column}`
    : "";
  return `${d.code}:${d.message}:${d.severity}:${locationKey}`;
}

function deduplicateDiagnostics(
  diagnostics: ReadonlyArray<Diagnostic>,
): Diagnostic[] {
  const seen = new Set<string>();
  const result: Diagnostic[] = [];

  for (const d of diagnostics) {
    const key = getDiagnosticKey(d);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(d);
    }
  }

  return result;
}

function collectDiagnostics(
  allDiagnostics: ReadonlyArray<Diagnostic>,
): Diagnostics {
  const uniqueDiagnostics = deduplicateDiagnostics(allDiagnostics);
  const errors = uniqueDiagnostics.filter((d) => d.severity === "error");
  const warnings = uniqueDiagnostics.filter((d) => d.severity === "warning");

  return { errors, warnings };
}

export async function extractResolvers(
  options: ExtractResolversOptions,
): Promise<ExtractResolversResult> {
  const allDiagnostics: Diagnostic[] = [];

  const scanResult = await scanResolverDirectory(options.directory);
  allDiagnostics.push(...scanResult.errors);

  if (scanResult.errors.length > 0 || scanResult.files.length === 0) {
    return createEmptyResult(collectDiagnostics(allDiagnostics));
  }

  const program = createProgramFromFiles(scanResult.files);
  const checker = program.getTypeChecker();

  const extractionResult = extractResolversFromProgram(
    program,
    scanResult.files,
  );
  allDiagnostics.push(...extractionResult.diagnostics);

  const analysisResult = analyzeSignatures(extractionResult, checker);
  allDiagnostics.push(...analysisResult.diagnostics);

  const conversionResult = convertToFields(analysisResult);
  allDiagnostics.push(...conversionResult.diagnostics);

  return {
    queryFields: conversionResult.queryFields,
    mutationFields: conversionResult.mutationFields,
    typeExtensions: conversionResult.typeExtensions,
    diagnostics: collectDiagnostics(allDiagnostics),
  };
}
