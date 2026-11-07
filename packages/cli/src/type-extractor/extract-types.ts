import type { Program, Symbol as TsSymbol } from "typescript/async";
import type { Diagnostic, Diagnostics } from "../core/index.js";
import type { CheckerLoader } from "../shared/checker-loader.js";
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
import {
  type ExtractionResult,
  extractTypesFromProgram,
} from "./extractor/type-extractor.js";
import {
  buildScalarMappingTable,
  createRecordedScalarMappingTable,
  isScalarMappingTableUnread,
  type ScalarBaseTypeMappingTable,
} from "./mapper/scalar-base-type-mapper.js";
import type { ExtractedTypeInfo, GlobalTypeMapping } from "./types/index.js";
import { validateTypes } from "./validator/type-validator.js";

export interface ExtractTypesParams {
  readonly program: Program;
  readonly checker: CheckerLoader;
  readonly sourceFiles: ReadonlyArray<string>;
  readonly customScalarNames: ReadonlyArray<string>;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  readonly configScalars: ReadonlyArray<ConfigScalarMapping>;
  readonly sourceRoot: string | null;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly knownTypeSymbols: ReadonlyMap<string, TsSymbol>;
  readonly underlyingSymbolToTypeName: ReadonlyMap<TsSymbol, string>;
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

export interface FinalizeTypeExtractionParams {
  /** The extraction that used `scalarMappingTable`. */
  readonly extractionResult: ExtractionResult;
  readonly scalarMappingTable: ScalarBaseTypeMappingTable | null;
  readonly customScalarNames: ReadonlyArray<string>;
  readonly configScalars: ReadonlyArray<ConfigScalarMapping>;
  readonly sourceRoot: string | null;
}

/**
 * Turns extracted types into GraphQL types and validates them, along with
 * the scalars they use.
 */
export function finalizeTypeExtraction(
  params: FinalizeTypeExtractionParams,
): ExtractTypesResult {
  const {
    extractionResult,
    scalarMappingTable,
    customScalarNames,
    configScalars,
    sourceRoot,
  } = params;
  const allDiagnostics: Diagnostic[] = [];

  // Report scalar mapping conflicts as diagnostics
  if (scalarMappingTable) {
    for (const [, conflict] of scalarMappingTable.conflicts) {
      const baseTypeName = conflict.baseTypeSymbol.name;
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

/**
 * Extracts GraphQL types from the TypeScript program.
 *
 * Extracts types without a scalar mapping table first, which also detects
 * the scalars declared in the program. If a field's type is the base type of
 * one of them (e.g. `Date` for a `DateTime` scalar), extraction runs again
 * with the mapping table built from them, so the field maps to the scalar.
 */
export async function extractTypes(
  params: ExtractTypesParams,
): Promise<ExtractTypesResult> {
  const {
    program,
    checker,
    sourceFiles,
    customScalarNames,
    globalTypeMappings,
    configScalars,
    sourceRoot,
    knownTypeNames,
    knownTypeSymbols,
    underlyingSymbolToTypeName,
  } = params;
  const options = {
    globalTypeMappings,
    knownTypeNames,
    knownTypeSymbols,
    underlyingSymbolToTypeName,
  };

  const unmappedScalars = createRecordedScalarMappingTable();
  const firstPass = await extractTypesFromProgram({
    program,
    checker,
    sourceFiles,
    options: { ...options, scalarMappingTable: unmappedScalars },
  });

  const scalarMappingTable =
    firstPass.detectedScalars.length > 0
      ? await buildScalarMappingTable({
          detectedScalars: firstPass.detectedScalars,
          checker,
          program,
        })
      : null;

  const extractionResult = isScalarMappingTableUnread(
    unmappedScalars,
    scalarMappingTable,
  )
    ? firstPass
    : await extractTypesFromProgram({
        program,
        checker,
        sourceFiles,
        options: { ...options, scalarMappingTable },
      });

  return finalizeTypeExtraction({
    extractionResult,
    scalarMappingTable,
    customScalarNames,
    configScalars,
    sourceRoot,
  });
}
