import type { Program, Symbol as TsSymbol } from "typescript/async";
import type { Diagnostic } from "../core/index.js";
import type { CheckerLoader } from "../shared/checker-loader.js";
import { collectDiagnostics } from "../shared/index.js";
import {
  collectLocalTypeDeclarationNames,
  type GlobalTypeMapping,
  type ScalarBaseTypeMappingTable,
} from "../type-extractor/index.js";
import { convertDefineApiToFields } from "./converter/field-converter.js";
import { extractDefineApiResolvers } from "./extractor/define-api-extractor.js";
import type { ExtractResolversResult } from "./types.js";
import { validateResolverTypes } from "./validator/resolver-type-validator.js";

export interface ExtractResolversParams {
  readonly program: Program;
  readonly checker: CheckerLoader;
  readonly sourceFiles: ReadonlyArray<string>;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly knownTypeSymbols: ReadonlyMap<string, TsSymbol>;
  readonly underlyingSymbolToTypeName: ReadonlyMap<TsSymbol, string>;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  readonly scalarMappingTable: ScalarBaseTypeMappingTable | null;
  /** Names of types already extracted from `GqlObject`/`GqlInterface`/etc. declarations (type-extractor's stage). */
  readonly declaredTypeNames: ReadonlyArray<string>;
  /** Custom scalar names, both config-declared and auto-detected. */
  readonly customScalarNames: ReadonlyArray<string>;
}

/**
 * Extracts GraphQL resolver definitions (queries, mutations, subscriptions,
 * type extensions, and abstract-type resolvers) from `define*` calls in the
 * TypeScript program.
 */
export async function extractResolvers(
  params: ExtractResolversParams,
): Promise<ExtractResolversResult> {
  const {
    program,
    checker,
    sourceFiles,
    knownTypeNames,
    knownTypeSymbols,
    underlyingSymbolToTypeName,
    globalTypeMappings,
    scalarMappingTable,
    declaredTypeNames,
    customScalarNames,
  } = params;
  const allDiagnostics: Diagnostic[] = [];

  const sourceFilesSet = new Set(sourceFiles);
  const defineApiExtractionResult = await extractDefineApiResolvers({
    program,
    checker,
    files: sourceFiles,
    options: {
      knownTypeNames,
      knownTypeSymbols,
      underlyingSymbolToTypeName,
      globalTypeMappings,
      sourceFiles: sourceFilesSet,
      scalarMappingTable,
    },
  });
  allDiagnostics.push(...defineApiExtractionResult.diagnostics);

  const result = convertDefineApiToFields(defineApiExtractionResult.resolvers);
  allDiagnostics.push(...result.diagnostics);

  const validationResult = validateResolverTypes({
    queryFields: result.queryFields,
    mutationFields: result.mutationFields,
    subscriptionFields: result.subscriptionFields,
    typeExtensions: result.typeExtensions,
    declaredTypeNames,
    customScalarNames,
    localTypeDeclarationNames: await collectLocalTypeDeclarationNames(
      program,
      sourceFiles,
    ),
  });
  allDiagnostics.push(...validationResult.diagnostics);

  return {
    queryFields: result.queryFields,
    mutationFields: result.mutationFields,
    subscriptionFields: result.subscriptionFields,
    typeExtensions: result.typeExtensions,
    abstractTypeResolvers: defineApiExtractionResult.abstractTypeResolvers,
    diagnostics: collectDiagnostics(allDiagnostics),
  };
}
