import type { Program } from "typescript/async";
import type { Diagnostic } from "../core/index.js";
import type { CheckerLoader } from "../shared/checker-loader.js";
import { collectDiagnostics } from "../shared/index.js";
import type { SymbolKey } from "../shared/typescript-utils.js";
import type {
  GlobalTypeMapping,
  ScalarBaseTypeMappingTable,
} from "../type-extractor/index.js";
import { convertDefineApiToFields } from "./converter/field-converter.js";
import {
  type ExtractDefineApiResult,
  extractDefineApiResolvers,
} from "./extractor/define-api-extractor.js";
import type { ExtractResolversResult } from "./types.js";
import { validateResolverTypes } from "./validator/resolver-type-validator.js";

export interface ExtractResolverDefinitionsParams {
  readonly program: Program;
  readonly checker: CheckerLoader;
  /** The files whose resolvers to extract, in order. */
  readonly files: ReadonlyArray<string>;
  /** Every scanned source file. */
  readonly sourceFiles: ReadonlyArray<string>;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly knownTypeSymbols: ReadonlyMap<string, SymbolKey>;
  readonly underlyingSymbolToTypeName: ReadonlyMap<SymbolKey, string>;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  readonly scalarMappingTable: ScalarBaseTypeMappingTable | null;
}

/**
 * The part of resolver extraction that asks the checker: classifies every
 * exported `define*` call and resolves its argument and return types. The
 * result holds no TypeScript objects, so it can cross API instances.
 */
export async function extractResolverDefinitions(
  params: ExtractResolverDefinitionsParams,
): Promise<ExtractDefineApiResult> {
  const { program, checker, files, sourceFiles, ...options } = params;
  return extractDefineApiResolvers({
    program,
    checker,
    files,
    options: { ...options, sourceFiles: new Set(sourceFiles) },
  });
}

export interface CompleteResolverExtractionParams {
  readonly definitions: ExtractDefineApiResult;
  /**
   * Names of the extracted types, including those extracted from the
   * definitions' `localTypeReferences`.
   */
  readonly declaredTypeNames: ReadonlyArray<string>;
  /** Custom scalar names, both config-declared and auto-detected. */
  readonly customScalarNames: ReadonlyArray<string>;
}

/**
 * Groups extracted resolver definitions into GraphQL fields and validates
 * the types they reference against the extracted types.
 */
export function completeResolverExtraction(
  params: CompleteResolverExtractionParams,
): ExtractResolversResult {
  const { definitions, declaredTypeNames, customScalarNames } = params;
  const allDiagnostics: Diagnostic[] = [...definitions.diagnostics];

  const result = convertDefineApiToFields(definitions.resolvers);
  allDiagnostics.push(...result.diagnostics);

  const validationResult = validateResolverTypes({
    queryFields: result.queryFields,
    mutationFields: result.mutationFields,
    subscriptionFields: result.subscriptionFields,
    typeExtensions: result.typeExtensions,
    declaredTypeNames,
    customScalarNames,
  });
  allDiagnostics.push(...validationResult.diagnostics);

  return {
    queryFields: result.queryFields,
    mutationFields: result.mutationFields,
    subscriptionFields: result.subscriptionFields,
    typeExtensions: result.typeExtensions,
    abstractTypeResolvers: definitions.abstractTypeResolvers,
    diagnostics: collectDiagnostics(allDiagnostics),
  };
}
