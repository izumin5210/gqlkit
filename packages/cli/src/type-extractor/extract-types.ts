import type ts from "typescript";
import type { Diagnostic, Diagnostics } from "../core/index.js";
import {
  type CollectedTypesResult,
  collectResults,
} from "./collector/result-collector.js";
import {
  type CollectedScalarType,
  type ConfigScalarMapping,
  collectScalars,
  type ScalarMetadataInfo,
} from "./collector/scalar-collector.js";
import { convertToGraphQL } from "./converter/graphql-converter.js";
import { extractTypesFromProgram } from "./extractor/type-extractor.js";
import {
  buildScalarMappingTable,
  type ScalarBaseTypeMappingTable,
} from "./mapper/scalar-base-type-mapper.js";
import type { ExtractedTypeInfo, GlobalTypeMapping } from "./types/index.js";
import { validateTypes } from "./validator/type-validator.js";

export interface ExtractTypesParams {
  readonly program: ts.Program;
  readonly sourceFiles: ReadonlyArray<string>;
  readonly customScalarNames: ReadonlyArray<string>;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  readonly configScalars: ReadonlyArray<ConfigScalarMapping>;
  readonly sourceRoot: string | null;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly knownTypeSymbols: ReadonlyMap<string, ts.Symbol>;
  readonly underlyingSymbolToTypeName: ReadonlyMap<ts.Symbol, string>;
}

export interface ExtractTypesResult {
  types: CollectedTypesResult["types"];
  extractedTypes: ReadonlyArray<ExtractedTypeInfo>;
  diagnostics: Diagnostics;
  detectedScalarNames: ReadonlyArray<string>;
  detectedScalars: ReadonlyArray<ScalarMetadataInfo>;
  collectedScalars: ReadonlyArray<CollectedScalarType>;
  scalarMappingTable: ScalarBaseTypeMappingTable | null;
  discoveredTypeNames: ReadonlySet<string>;
}

/**
 * Extracts GraphQL types from the TypeScript program.
 *
 * Runs a two-pass extraction: pass 1 extracts types and detects scalar usages
 * without a scalar mapping table, then a scalar mapping table is built from
 * the detected scalars, and pass 2 re-extracts types using that table so base
 * types (e.g. `Date`) are correctly mapped to their scalar names (e.g. `DateTime`).
 */
export function extractTypes(params: ExtractTypesParams): ExtractTypesResult {
  const {
    program,
    sourceFiles,
    customScalarNames,
    globalTypeMappings,
    configScalars,
    sourceRoot,
    knownTypeNames,
    knownTypeSymbols,
    underlyingSymbolToTypeName,
  } = params;
  const allDiagnostics: Diagnostic[] = [];

  // Pass 1: Extract types and detect scalars (without scalar mapping table)
  const pass1Result = extractTypesFromProgram(program, sourceFiles, {
    globalTypeMappings,
    knownTypeNames,
    knownTypeSymbols,
    underlyingSymbolToTypeName,
    scalarMappingTable: null,
  });

  // Build scalar mapping table from detected scalars
  const scalarMappingTable =
    pass1Result.detectedScalars.length > 0
      ? buildScalarMappingTable({
          detectedScalars: pass1Result.detectedScalars,
          checker: program.getTypeChecker(),
          program,
        })
      : null;

  // Report scalar mapping conflicts as diagnostics
  if (scalarMappingTable) {
    for (const [, conflict] of scalarMappingTable.conflicts) {
      const baseTypeName = conflict.baseTypeSymbol.getName();
      const scalarNames = conflict.conflictingScalars
        .map((s) => s.scalarName)
        .join(", ");
      allDiagnostics.push({
        code: conflict.code,
        message: `Base type '${baseTypeName}' maps to multiple scalars: ${scalarNames}. Use explicit scalar type instead of the base type.`,
        severity: "error",
        location: null,
      });
    }
  }

  // Pass 2: Re-extract types with scalar mapping table (if we have detected scalars)
  const extractionResult = scalarMappingTable
    ? extractTypesFromProgram(program, sourceFiles, {
        globalTypeMappings,
        knownTypeNames,
        knownTypeSymbols,
        underlyingSymbolToTypeName,
        scalarMappingTable,
      })
    : pass1Result;

  allDiagnostics.push(...extractionResult.diagnostics);

  const allCustomScalarNames = [
    ...customScalarNames,
    ...extractionResult.detectedScalarNames,
  ];

  const scalarValidationResult = collectScalars(
    extractionResult.detectedScalars,
    configScalars,
    { sourceRoot },
  );
  const collectedScalars: CollectedScalarType[] = scalarValidationResult.success
    ? [...scalarValidationResult.data]
    : [];
  if (!scalarValidationResult.success) {
    for (const error of scalarValidationResult.errors) {
      allDiagnostics.push({
        code: error.code,
        message: error.message,
        severity: error.severity,
        location: null,
      });
    }
  }

  const conversionResult = convertToGraphQL(extractionResult.types);
  allDiagnostics.push(...conversionResult.diagnostics);

  const validationResult = validateTypes({
    types: conversionResult.types,
    customScalarNames: allCustomScalarNames,
  });
  allDiagnostics.push(...validationResult.diagnostics);

  const result = collectResults(conversionResult.types, allDiagnostics);
  return {
    ...result,
    extractedTypes: extractionResult.types,
    detectedScalarNames: extractionResult.detectedScalarNames,
    detectedScalars: extractionResult.detectedScalars,
    collectedScalars,
    scalarMappingTable,
    discoveredTypeNames: extractionResult.discoveredTypeNames,
  };
}
