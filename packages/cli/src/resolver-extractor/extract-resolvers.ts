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
import {
  type ExtractDefineApiResult,
  extractDefineApiResolvers,
} from "./extractor/define-api-extractor.js";
import type { ExtractResolversResult } from "./types.js";
import { validateResolverTypes } from "./validator/resolver-type-validator.js";

export interface ExtractResolverDefinitionsParams {
  readonly program: Program;
  readonly checker: CheckerLoader;
  readonly sourceFiles: ReadonlyArray<string>;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly knownTypeSymbols: ReadonlyMap<string, TsSymbol>;
  readonly underlyingSymbolToTypeName: ReadonlyMap<TsSymbol, string>;
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
  const { program, checker, sourceFiles, ...options } = params;
  return extractDefineApiResolvers({
    program,
    checker,
    files: sourceFiles,
    options: { ...options, sourceFiles: new Set(sourceFiles) },
  });
}

export interface CompleteResolverExtractionParams {
  readonly program: Program;
  readonly sourceFiles: ReadonlyArray<string>;
  readonly definitions: ExtractDefineApiResult;
  /** Names of types already extracted from `GqlObject`/`GqlInterface`/etc. declarations (type-extractor's stage). */
  readonly declaredTypeNames: ReadonlyArray<string>;
  /** Custom scalar names, both config-declared and auto-detected. */
  readonly customScalarNames: ReadonlyArray<string>;
}

/**
 * Groups extracted resolver definitions into GraphQL fields and validates
 * the types they reference against the extracted types.
 */
export async function completeResolverExtraction(
  params: CompleteResolverExtractionParams,
): Promise<ExtractResolversResult> {
  const {
    program,
    sourceFiles,
    definitions,
    declaredTypeNames,
    customScalarNames,
  } = params;
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
    abstractTypeResolvers: definitions.abstractTypeResolvers,
    diagnostics: collectDiagnostics(allDiagnostics),
  };
}

export interface ExtractResolversParams
  extends ExtractResolverDefinitionsParams {
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
  const { declaredTypeNames, customScalarNames, ...definitionParams } = params;
  return completeResolverExtraction({
    program: params.program,
    sourceFiles: params.sourceFiles,
    definitions: await extractResolverDefinitions(definitionParams),
    declaredTypeNames,
    customScalarNames,
  });
}
