import type ts from "typescript";
import type { Diagnostic } from "../core/index.js";
import { collectDiagnostics } from "../shared/index.js";
import type {
  GlobalTypeMapping,
  ScalarBaseTypeMappingTable,
} from "../type-extractor/index.js";
import { convertDefineApiToFields } from "./converter/field-converter.js";
import { extractDefineApiResolvers } from "./extractor/define-api-extractor.js";
import type { ExtractResolversResult } from "./types.js";

export interface ExtractResolversParams {
  readonly program: ts.Program;
  readonly sourceFiles: ReadonlyArray<string>;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly knownTypeSymbols: ReadonlyMap<string, ts.Symbol>;
  readonly underlyingSymbolToTypeName: ReadonlyMap<ts.Symbol, string>;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  readonly scalarMappingTable: ScalarBaseTypeMappingTable | null;
}

/**
 * Extracts GraphQL resolver definitions (queries, mutations, subscriptions,
 * type extensions, and abstract-type resolvers) from `define*` calls in the
 * TypeScript program.
 */
export function extractResolvers(
  params: ExtractResolversParams,
): ExtractResolversResult {
  const {
    program,
    sourceFiles,
    knownTypeNames,
    knownTypeSymbols,
    underlyingSymbolToTypeName,
    globalTypeMappings,
    scalarMappingTable,
  } = params;
  const allDiagnostics: Diagnostic[] = [];

  const sourceFilesSet = new Set(sourceFiles);
  const defineApiExtractionResult = extractDefineApiResolvers(
    program,
    sourceFiles,
    {
      knownTypeNames,
      knownTypeSymbols,
      underlyingSymbolToTypeName,
      globalTypeMappings,
      sourceFiles: sourceFilesSet,
      scalarMappingTable,
    },
  );
  allDiagnostics.push(...defineApiExtractionResult.diagnostics);

  const result = convertDefineApiToFields(defineApiExtractionResult.resolvers);
  allDiagnostics.push(...result.diagnostics);
  return {
    queryFields: result.queryFields,
    mutationFields: result.mutationFields,
    subscriptionFields: result.subscriptionFields,
    typeExtensions: result.typeExtensions,
    abstractTypeResolvers: defineApiExtractionResult.abstractTypeResolvers,
    diagnostics: collectDiagnostics(allDiagnostics),
  };
}
