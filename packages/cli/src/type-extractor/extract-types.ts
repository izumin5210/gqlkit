import {
  collectResults,
  type ExtractTypesResult,
} from "./collector/result-collector.js";
import { convertToGraphQL } from "./converter/graphql-converter.js";
import {
  createProgramFromFiles,
  extractTypesFromProgram,
} from "./extractor/type-extractor.js";
import { scanDirectory } from "./scanner/file-scanner.js";
import type { Diagnostic } from "./types/index.js";
import { validateTypes } from "./validator/type-validator.js";

export interface ExtractTypesOptions {
  readonly directory: string;
  readonly customScalarNames?: ReadonlyArray<string>;
}

export type { ExtractTypesResult };

export async function extractTypes(
  options: ExtractTypesOptions,
): Promise<ExtractTypesResult> {
  const allDiagnostics: Diagnostic[] = [];

  const scanResult = await scanDirectory(options.directory);
  allDiagnostics.push(...scanResult.errors);

  if (scanResult.errors.length > 0 || scanResult.files.length === 0) {
    return collectResults([], allDiagnostics);
  }

  const program = createProgramFromFiles(scanResult.files);

  const extractionResult = extractTypesFromProgram(program, scanResult.files);
  allDiagnostics.push(...extractionResult.diagnostics);

  const conversionResult = convertToGraphQL(extractionResult.types);
  allDiagnostics.push(...conversionResult.diagnostics);

  const validationResult = validateTypes({
    types: conversionResult.types,
    customScalarNames: options.customScalarNames,
  });
  allDiagnostics.push(...validationResult.diagnostics);

  return collectResults(conversionResult.types, allDiagnostics);
}
