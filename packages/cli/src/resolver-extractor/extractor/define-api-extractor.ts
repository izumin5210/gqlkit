import {
  type DeprecationInfo,
  type Diagnostic,
  type DirectiveInfo,
  METADATA_PROPERTIES,
  type PropertyDef,
  type SourceLocation,
  type TSTypeReference,
} from "../../core/index.js";
import * as ts from "../../core/typescript.js";
import type { CheckerLoader } from "../../shared/checker-loader.js";
import { isInternalTypeSymbol } from "../../shared/constants.js";
import { extractDirectivesFromType } from "../../shared/directive-detector.js";
import { getActualMetadataType } from "../../shared/metadata-detector.js";
import { getSourceLocationFromNode } from "../../shared/source-location.js";
import { extractTsDocInfo } from "../../shared/tsdoc-parser.js";
import {
  getTypeNameFromNode,
  isExported,
} from "../../shared/typescript-utils.js";
import {
  extractFieldsFromType,
  type FieldTypeResolverContext,
  type FieldTypeResolverDiagnostic,
  type GlobalTypeMapping,
  resolveFieldType,
  type ScalarBaseTypeMappingTable,
} from "../../type-extractor/index.js";

export type DefineApiResolverType =
  | "query"
  | "mutation"
  | "field"
  | "subscription";

export type AbstractResolverKind = "resolveType" | "isTypeOf";

export interface ExportedInputType {
  readonly name: string;
  readonly tsType: TSTypeReference;
  readonly sourceFile: string;
}

export interface DefineApiResolverInfo {
  readonly fieldName: string;
  readonly resolverExportName: string;
  readonly resolverType: DefineApiResolverType;
  readonly parentTypeName: string | null;
  readonly argsType: TSTypeReference | null;
  /**
   * Resolver arguments, in `PropertyDef` shape (refactor-plan.md §1.2-D:
   * `ArgumentDefinition` was a near-duplicate of `PropertyDef` missing only
   * `sourceLocation`, which `extractArgsFromType` already computes via the
   * shared `extractFieldsFromType` engine — see that function).
   */
  readonly args: ReadonlyArray<PropertyDef> | null;
  readonly returnType: TSTypeReference;
  readonly sourceFile: string;
  readonly sourceLocation: SourceLocation;
  readonly exportedInputTypes: ReadonlyArray<ExportedInputType>;
  readonly description: string | null;
  readonly deprecated: DeprecationInfo | null;
  readonly directives: ReadonlyArray<DirectiveInfo> | null;
}

export interface AbstractResolverInfo {
  readonly kind: AbstractResolverKind;
  readonly targetTypeName: string;
  readonly exportName: string;
  readonly sourceFile: string;
  readonly sourceLocation: SourceLocation;
}

export interface ExtractDefineApiResult {
  readonly resolvers: ReadonlyArray<DefineApiResolverInfo>;
  readonly abstractTypeResolvers: ReadonlyArray<AbstractResolverInfo>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

export interface ExtractDefineApiOptions {
  readonly knownTypeNames: ReadonlySet<string>;
  readonly knownTypeSymbols: ReadonlyMap<string, ts.Symbol>;
  readonly underlyingSymbolToTypeName: ReadonlyMap<ts.Symbol, string>;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  readonly sourceFiles: ReadonlySet<string>;
  readonly scalarMappingTable: ScalarBaseTypeMappingTable | null;
}

const RESOLVER_METADATA_PROPERTY = METADATA_PROPERTIES.RESOLVER;
const ABSTRACT_RESOLVER_METADATA_PROPERTY =
  METADATA_PROPERTIES.ABSTRACT_RESOLVER;

interface MetadataKindResult {
  readonly kind: string;
  readonly actualType: ts.Type;
}

/**
 * Reads the `kind` discriminant off a metadata property (e.g. the resolver or
 * abstract-resolver marker) embedded in a `define*()` call's return type.
 * Shared skeleton for resolver-type detection and abstract-resolver-kind
 * detection (refactor-plan.md §1.2-D): both walk
 * `metadataProp -> getActualMetadataType -> "kind" string literal`, differing
 * only in which marker property they read and which kind strings are valid.
 * Returns null if the metadata property, its actual type, or `kind` are
 * absent, or `kind` isn't a string literal — callers narrow/validate the
 * returned `kind` themselves.
 */
interface DetectKindFromMetadataTypeParams {
  readonly returnType: ts.Type;
  readonly checker: CheckerLoader;
  readonly metadataProperty: string;
}

async function detectKindFromMetadataType(
  params: DetectKindFromMetadataTypeParams,
): Promise<MetadataKindResult | null> {
  const { returnType, checker, metadataProperty } = params;
  const metadataProp = await checker.getPropertyOfType(
    returnType,
    metadataProperty,
  );
  if (!metadataProp) {
    return null;
  }

  const metadataType = await checker.getTypeOfSymbol(metadataProp);
  const actualType = await getActualMetadataType(metadataType);
  if (!actualType) {
    return null;
  }

  const kindProp = await checker.getPropertyOfType(actualType, "kind");
  if (!kindProp) {
    return null;
  }

  const kindType = await checker.getTypeOfSymbol(kindProp);
  if (!kindType.isStringLiteralType()) {
    return null;
  }

  return { kind: kindType.value, actualType };
}

/**
 * Detects abstract resolver kind and target type from metadata embedded in the type.
 * Returns null if no abstract resolver metadata is found.
 */
async function detectAbstractResolverFromMetadataType(
  returnType: ts.Type,
  checker: CheckerLoader,
): Promise<{ kind: AbstractResolverKind; targetTypeName: string } | null> {
  const result = await detectKindFromMetadataType({
    returnType,
    checker,
    metadataProperty: ABSTRACT_RESOLVER_METADATA_PROPERTY,
  });
  if (!result) {
    return null;
  }

  const { kind, actualType } = result;
  if (kind !== "resolveType" && kind !== "isTypeOf") {
    return null;
  }

  const targetTypeProp = await checker.getPropertyOfType(
    actualType,
    "targetType",
  );
  if (!targetTypeProp) {
    return null;
  }

  const targetType = await checker.getTypeOfSymbol(targetTypeProp);
  const targetTypeName = await extractTypeNameFromType(targetType, checker);

  if (!targetTypeName) {
    return null;
  }

  return { kind, targetTypeName };
}

/**
 * Extracts a type name from a TypeScript type.
 * Handles internal type symbols (like __type) by falling back to typeToString.
 * Returns null for unresolvable types (any, unknown).
 */
async function extractTypeNameFromType(
  type: ts.Type,
  checker: CheckerLoader,
): Promise<string | null> {
  if (type.flags & ts.TypeFlags.Any) {
    return null;
  }

  const aliasSymbol = await type.getAliasSymbol();
  if (aliasSymbol) {
    const aliasName = aliasSymbol.name;
    if (!isInternalTypeSymbol(aliasName)) {
      return aliasName;
    }
  }

  const symbol = await type.getSymbol();
  if (symbol) {
    const symbolName = symbol.name;
    if (!isInternalTypeSymbol(symbolName)) {
      return symbolName;
    }
  }

  const typeString = await checker.typeToString(type);
  if (typeString && typeString !== "unknown" && typeString !== "any") {
    return typeString;
  }

  return null;
}

/**
 * Detects resolver type from metadata embedded in the type.
 * Follows the same pattern as scalar metadata detection.
 */
async function detectResolverFromMetadataType(
  returnType: ts.Type,
  checker: CheckerLoader,
): Promise<DefineApiResolverType | null> {
  const result = await detectKindFromMetadataType({
    returnType,
    checker,
    metadataProperty: RESOLVER_METADATA_PROPERTY,
  });
  if (!result) {
    return null;
  }

  const { kind } = result;
  if (
    kind === "query" ||
    kind === "mutation" ||
    kind === "field" ||
    kind === "subscription"
  ) {
    return kind;
  }

  return null;
}

function resolveFieldNameFromExportName(exportName: string): string | null {
  const delimiterIndex = exportName.lastIndexOf("$");
  if (delimiterIndex === -1) {
    return exportName;
  }

  const fieldName = exportName.slice(delimiterIndex + 1);
  if (fieldName.length === 0) {
    return null;
  }

  return fieldName;
}

/**
 * Checks if a type has only index signatures with no named properties.
 * Types like `{ [key: string]: number }` return true.
 * Returns false for NoArgs type (Record<string, never>).
 */
async function hasOnlyIndexSignatures(
  type: ts.Type,
  checker: CheckerLoader,
): Promise<boolean> {
  const targetType = await checker.getApparentType(type);

  const indexInfos = await checker.getIndexInfosOfType(targetType);
  const hasIndexSignatures = indexInfos.length > 0;

  if (!hasIndexSignatures) {
    return false;
  }

  const hasNeverStringIndex = indexInfos.some((info) => {
    return (
      (info.keyType.flags & ts.TypeFlags.String) !== 0 &&
      (info.valueType.flags & ts.TypeFlags.Never) !== 0
    );
  });

  if (hasNeverStringIndex) {
    return false;
  }

  const properties = (await targetType.getProperties()).filter(
    (p) => !p.name.startsWith(" $"),
  );
  if (properties.length > 0) {
    return false;
  }

  return true;
}

/**
 * Gets the type name for error messages.
 */
async function getTypeNameForDiagnostic(
  type: ts.Type,
  checker: CheckerLoader,
): Promise<string> {
  const aliasSymbol = await type.getAliasSymbol();
  if (aliasSymbol) {
    return aliasSymbol.name;
  }
  const symbol = await type.getSymbol();
  if (symbol) {
    return symbol.name;
  }
  return checker.typeToString(type);
}

/**
 * Converts diagnostics collected by a single `resolveFieldType` call into
 * located `Diagnostic`s, mirroring `type-extractor`'s per-field conversion
 * (fresh diagnostics array per declaration, immediately converted with that
 * declaration's location). This is what makes CYCLE_DETECTED (and other
 * warnings raised inside `resolveFieldType`) visible for resolver args and
 * return types instead of vanishing into a context array that nobody reads.
 */
interface ConvertFieldDiagnosticsParams {
  readonly fieldDiagnostics: ReadonlyArray<FieldTypeResolverDiagnostic>;
  readonly label: string;
  readonly location: SourceLocation | null;
}

function convertFieldDiagnostics(
  params: ConvertFieldDiagnosticsParams,
): Diagnostic[] {
  const { fieldDiagnostics, label, location } = params;
  return fieldDiagnostics.map((d) => ({
    code: d.code,
    message: `${label}: ${d.message}`,
    severity: d.severity,
    location,
  }));
}

interface ExtractArgsResult {
  readonly args: PropertyDef[];
  readonly diagnostics: Diagnostic[];
}

interface ExtractArgsFromTypeParams {
  readonly argsType: ts.Type;
  /** The whole args type's own resolved reference — used only to detect the
   * declared-args-type overlap described below, not returned. */
  readonly argsTypeRef: TSTypeReference;
  readonly ctx: FieldTypeResolverContext;
}

/**
 * Extracts resolver arguments from an args type by delegating to the same
 * property-walking engine type-extractor uses for declared-type fields
 * (`extractFieldsFromType`, refactor-plan.md §1.2-D / Phase 5). This is what
 * makes argument directives, the `never`-kind skip, and the `directiveNullable`
 * unwrap quirk behave identically for arguments and fields — previously this
 * function reimplemented the same walk without directive detection, which
 * silently dropped `@directive` usages declared on argument properties.
 *
 * Unlike the previous implementation, no `argsTypeNode` parameter is needed
 * to locate per-property type nodes: `extractFieldsFromType` derives those
 * from each property symbol's own declaration, which resolves correctly for
 * both named args types and inline args type literals.
 *
 * `extractFieldsFromType` already returns `PropertyDef[]`, the same shape
 * `DefineApiResolverInfo.args` is declared in, so the result is used as-is —
 * no further per-field mapping needed (previously this function copied each
 * field into a separate `ArgumentDefinition` shape that silently dropped the
 * `sourceLocation` `extractFieldsFromType` already computes).
 */
async function extractArgsFromType(
  params: ExtractArgsFromTypeParams,
): Promise<ExtractArgsResult> {
  const { argsType, argsTypeRef, ctx } = params;
  const { fields, diagnostics } = await extractFieldsFromType({
    type: argsType,
    checker: ctx.checker,
    globalTypeMappings: ctx.globalTypeMappings,
    knownTypeNames: ctx.knownTypeNames,
    knownTypeSymbols: ctx.knownTypeSymbols,
    underlyingSymbolToTypeName: ctx.underlyingSymbolToTypeName,
    sourceFiles: ctx.sourceFiles,
    scalarMappingTable: ctx.scalarMappingTable,
    scalarMappingContext: ctx.scalarMappingContext,
    ignoreFields: null,
    discoveredTypes: ctx.discoveredTypes,
    diagnosticLabel: "Argument",
  });

  // A named args type that's ALSO a separately-declared schema type (e.g. an
  // exported `*Input`-shaped type used directly as `TArgs`, flattened onto
  // this resolver's argument list) has its fields walked a second time here
  // by design: its own field list (as a declared type) and its flattened
  // argument list are extracted independently, by two different pipeline
  // stages. type-extractor's declared-type extraction already reports
  // UNRESOLVABLE_DEFAULT_VALUE for such a type's fields (labeled "Field");
  // reporting it again here (labeled "Argument") would be the same finding
  // twice, not a new one, so only this diagnostic code is filtered — every
  // other diagnostic this walk can produce is specific to the argument-list
  // context and stays.
  const isDeclaredArgsType =
    argsTypeRef.kind === "reference" &&
    argsTypeRef.name !== null &&
    ctx.knownTypeNames.has(argsTypeRef.name);

  const filteredDiagnostics = isDeclaredArgsType
    ? diagnostics.filter((d) => d.code !== "UNRESOLVABLE_DEFAULT_VALUE")
    : diagnostics;

  return { args: fields, diagnostics: filteredDiagnostics };
}

async function extractDirectivesFromTypeNode(
  typeNode: ts.TypeNode | undefined,
  checker: CheckerLoader,
): Promise<ReadonlyArray<DirectiveInfo> | null> {
  if (!typeNode) {
    return null;
  }

  const type = await checker.getTypeFromTypeNode(typeNode);
  const directiveResult = await extractDirectivesFromType(type, checker);

  if (directiveResult.directives.length > 0) {
    return directiveResult.directives;
  }

  return null;
}

interface TypeArgumentsResult {
  parentTypeName: string | null;
  argsType: TSTypeReference | null;
  args: PropertyDef[] | null;
  returnType: TSTypeReference;
  directives: ReadonlyArray<DirectiveInfo> | null;
  diagnostics: Diagnostic[];
}

interface ValidateArgsTypeParams {
  readonly argsType: ts.Type;
  readonly argsTypeNode: ts.TypeNode;
  readonly checker: CheckerLoader;
}

/**
 * Validates an args type and returns diagnostics for problematic types.
 */
async function validateArgsType(
  params: ValidateArgsTypeParams,
): Promise<Diagnostic[]> {
  const { argsType, argsTypeNode, checker } = params;
  const diagnostics: Diagnostic[] = [];

  if (await hasOnlyIndexSignatures(argsType, checker)) {
    const typeName = await getTypeNameForDiagnostic(argsType, checker);
    diagnostics.push({
      code: "INDEX_SIGNATURE_ONLY",
      message: `Type '${typeName}' contains only index signatures and cannot be represented as a GraphQL type. Use a concrete object type instead.`,
      severity: "error",
      location: getSourceLocationFromNode(argsTypeNode),
    });
  }

  return diagnostics;
}

interface CallTypeNodes {
  readonly parentTypeName: string | null;
  readonly argsTypeNode: ts.TypeNode;
  readonly returnTypeNode: ts.TypeNode;
  readonly directiveTypeNode: ts.TypeNode | undefined;
}

/**
 * Locates the args/return/directive type-argument nodes on a `define*()`
 * call. `defineField` carries an extra leading parent-type argument that the
 * other `define*` functions don't (`<Parent, Args, Return, Directives>` vs
 * `<Args, Return, Directives>`) — this is the only difference between the
 * two index layouts (refactor-plan.md §1.2-D).
 */
function resolveCallTypeNodes(
  typeArgs: ts.NodeArray<ts.TypeNode>,
  resolverType: DefineApiResolverType,
): CallTypeNodes | null {
  if (resolverType === "field") {
    if (typeArgs.length < 3) {
      return null;
    }
    const [parentTypeNode, argsTypeNode, returnTypeNode, directiveTypeNode] =
      typeArgs;

    if (!parentTypeNode || !argsTypeNode || !returnTypeNode) {
      return null;
    }

    return {
      parentTypeName: getTypeNameFromNode(parentTypeNode) ?? null,
      argsTypeNode,
      returnTypeNode,
      directiveTypeNode,
    };
  }

  if (typeArgs.length < 2) {
    return null;
  }
  const [argsTypeNode, returnTypeNode, directiveTypeNode] = typeArgs;

  if (!argsTypeNode || !returnTypeNode) {
    return null;
  }

  return {
    parentTypeName: null,
    argsTypeNode,
    returnTypeNode,
    directiveTypeNode,
  };
}

interface ExtractTypeArgumentsFromCallParams {
  readonly node: ts.CallExpression;
  readonly inputContext: FieldTypeResolverContext;
  readonly outputContext: FieldTypeResolverContext;
  readonly resolverType: DefineApiResolverType;
}

async function extractTypeArgumentsFromCall(
  params: ExtractTypeArgumentsFromCallParams,
): Promise<TypeArgumentsResult | null> {
  const { node, inputContext, outputContext, resolverType } = params;
  const { checker } = inputContext;
  const typeArgs = node.typeArguments;
  if (!typeArgs) {
    return null;
  }

  const callTypeNodes = resolveCallTypeNodes(typeArgs, resolverType);
  if (!callTypeNodes) {
    return null;
  }
  const { parentTypeName, argsTypeNode, returnTypeNode, directiveTypeNode } =
    callTypeNodes;

  const argsType = await checker.getTypeFromTypeNode(argsTypeNode);
  const returnType = await checker.getTypeFromTypeNode(returnTypeNode);

  const argsTypeRef = await resolveFieldType(argsType, undefined, inputContext);
  const isNoArgs =
    argsTypeRef.kind === "reference" && argsTypeRef.name === "Record";

  const diagnostics: Diagnostic[] = [];

  if (!isNoArgs) {
    diagnostics.push(
      ...(await validateArgsType({ argsType, argsTypeNode, checker })),
    );
  }

  const argsResult = isNoArgs
    ? null
    : await extractArgsFromType({ argsType, argsTypeRef, ctx: inputContext });
  if (argsResult) {
    diagnostics.push(...argsResult.diagnostics);
  }

  const directives = await extractDirectivesFromTypeNode(
    directiveTypeNode,
    checker,
  );

  const returnTypeDiagnostics: FieldTypeResolverDiagnostic[] = [];
  const returnTypeRef = await resolveFieldType(returnType, returnTypeNode, {
    ...outputContext,
    diagnostics: returnTypeDiagnostics,
  });
  diagnostics.push(
    ...convertFieldDiagnostics({
      fieldDiagnostics: returnTypeDiagnostics,
      label: "Return type",
      location: getSourceLocationFromNode(returnTypeNode),
    }),
  );

  return {
    parentTypeName,
    argsType: isNoArgs ? null : argsTypeRef,
    args: argsResult && argsResult.args.length > 0 ? argsResult.args : null,
    returnType: returnTypeRef,
    directives,
    diagnostics,
  };
}

async function extractExportedInputTypes(
  sourceFile: ts.SourceFile,
  ctx: FieldTypeResolverContext,
): Promise<ExportedInputType[]> {
  const exportedTypes: ExportedInputType[] = [];

  for (const node of sourceFile.statements) {
    if (ts.isTypeAliasDeclaration(node) && isExported(node)) {
      const name = node.name.getText(sourceFile);
      const type = await ctx.checker.getTypeAtLocation(node.name);
      const tsType = await resolveFieldType(type, undefined, ctx);

      exportedTypes.push({
        name,
        tsType,
        sourceFile: sourceFile.fileName,
      });
    }
  }

  return exportedTypes;
}

const DEFINE_CALL_FUNCTION_NAMES: ReadonlySet<string> = new Set([
  "defineQuery",
  "defineMutation",
  "defineField",
  "defineSubscription",
]);

/**
 * Recursively searches an expression's subtree for a call to one of the
 * `define*` resolver functions. Used to detect (and reject) `define*()`
 * calls hidden behind a conditional/binary expression, e.g.
 * `cond ? defineQuery(...) : defineQuery(...)` — only a direct
 * `export const x = defineXxx(...)` is supported. Replaces a former
 * text-regex heuristic on `initializer.getText()` (refactor-plan.md
 * §1.2-E/Phase 8 item 4) with an AST walk; verified equivalent for every
 * golden case that exercises this path (`subscription-error-complex-expression`
 * is the only one in the suite).
 */
function containsDefineCall(node: ts.Node): boolean {
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    DEFINE_CALL_FUNCTION_NAMES.has(node.expression.text)
  ) {
    return true;
  }

  return node.forEachChild(containsDefineCall) ?? false;
}

interface ProcessResolverDeclarationParams {
  readonly declaration: ts.VariableDeclaration;
  readonly statement: ts.VariableStatement;
  readonly sourceFile: ts.SourceFile;
  readonly filePath: string;
  readonly checker: CheckerLoader;
  readonly inputContext: FieldTypeResolverContext;
  readonly outputContext: FieldTypeResolverContext;
  readonly exportedInputTypes: ReadonlyArray<ExportedInputType>;
}

interface ProcessResolverDeclarationResult {
  readonly resolver: DefineApiResolverInfo | null;
  readonly abstractResolver: AbstractResolverInfo | null;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

/**
 * Processes a single `export const x = ...` declaration, classifying it as a
 * resolver, an abstract-type resolver, a diagnostic-only error, or nothing
 * (non-`define*` declarations are common — e.g. plain constants — and are
 * silently skipped, matching pre-decomposition behavior). Guard order is
 * unchanged from the original inline loop body (refactor-plan.md §1.2-E).
 */
async function processResolverDeclaration(
  params: ProcessResolverDeclarationParams,
): Promise<ProcessResolverDeclarationResult | null> {
  const {
    declaration,
    statement,
    sourceFile,
    filePath,
    checker,
    inputContext,
    outputContext,
    exportedInputTypes,
  } = params;

  if (!ts.isIdentifier(declaration.name)) {
    return null;
  }

  const exportName = declaration.name.getText(sourceFile);
  const initializer = declaration.initializer;

  if (!initializer) {
    return null;
  }

  if (!ts.isCallExpression(initializer)) {
    if (
      (ts.isConditionalExpression(initializer) ||
        ts.isBinaryExpression(initializer)) &&
      containsDefineCall(initializer)
    ) {
      return {
        resolver: null,
        abstractResolver: null,
        diagnostics: [
          {
            code: "INVALID_DEFINE_CALL",
            message: `Complex expressions with define* functions are not supported. Use a simple 'export const ${exportName} = defineXxx(...)' pattern.`,
            severity: "error",
            location: getSourceLocationFromNode(declaration.name),
          },
        ],
      };
    }
    return null;
  }

  // Computed once and offered to both detectors below (they previously
  // each called getTypeAtLocation on this same node independently).
  const returnType = await checker.getTypeAtLocation(initializer);

  const abstractResolverInfo = await detectAbstractResolverFromMetadataType(
    returnType,
    checker,
  );

  if (abstractResolverInfo) {
    const sourceLocation = getSourceLocationFromNode(declaration.name);
    if (!sourceLocation) {
      return null;
    }
    return {
      resolver: null,
      abstractResolver: {
        kind: abstractResolverInfo.kind,
        targetTypeName: abstractResolverInfo.targetTypeName,
        exportName,
        sourceFile: filePath,
        sourceLocation,
      },
      diagnostics: [],
    };
  }

  const resolverType = await detectResolverFromMetadataType(
    returnType,
    checker,
  );

  if (!resolverType) {
    return null;
  }

  const fieldName = resolveFieldNameFromExportName(exportName);
  if (fieldName === null) {
    return {
      resolver: null,
      abstractResolver: null,
      diagnostics: [
        {
          code: "INVALID_DEFINE_CALL",
          message: `Resolver export '${exportName}' must have a non-empty field name after '$'.`,
          severity: "error",
          location: getSourceLocationFromNode(declaration.name),
        },
      ],
    };
  }

  const funcName = ts.isIdentifier(initializer.expression)
    ? initializer.expression.text
    : undefined;

  const typeInfo = await extractTypeArgumentsFromCall({
    node: initializer,
    inputContext,
    outputContext,
    resolverType,
  });

  if (!typeInfo) {
    return {
      resolver: null,
      abstractResolver: null,
      diagnostics: [
        {
          code: "INVALID_DEFINE_CALL",
          message: `Failed to extract type arguments from ${funcName ?? "define*"} call for '${exportName}'`,
          severity: "error",
          location: getSourceLocationFromNode(declaration.name),
        },
      ],
    };
  }

  const tsdocInfo = await extractTsDocInfo(statement, checker);
  const sourceLocation = getSourceLocationFromNode(declaration.name) ?? {
    file: filePath,
    line: 1,
    column: 1,
  };

  return {
    resolver: {
      fieldName,
      resolverExportName: exportName,
      resolverType,
      parentTypeName: typeInfo.parentTypeName,
      argsType: typeInfo.argsType,
      args: typeInfo.args,
      returnType: typeInfo.returnType,
      sourceFile: filePath,
      sourceLocation,
      exportedInputTypes,
      description: tsdocInfo.description,
      deprecated: tsdocInfo.deprecated,
      directives: typeInfo.directives,
    },
    abstractResolver: null,
    diagnostics: typeInfo.diagnostics,
  };
}

export interface ExtractDefineApiResolversParams {
  readonly program: ts.Program;
  readonly checker: CheckerLoader;
  readonly files: ReadonlyArray<string>;
  readonly options: ExtractDefineApiOptions;
}

export async function extractDefineApiResolvers(
  params: ExtractDefineApiResolversParams,
): Promise<ExtractDefineApiResult> {
  const { program, checker, files, options } = params;
  const resolvers: DefineApiResolverInfo[] = [];
  const abstractTypeResolvers: AbstractResolverInfo[] = [];
  const diagnostics: Diagnostic[] = [];

  const {
    knownTypeNames,
    knownTypeSymbols,
    underlyingSymbolToTypeName,
    globalTypeMappings,
    sourceFiles,
    scalarMappingTable,
  } = options;
  // `inputContext.diagnostics` / `outputContext.diagnostics` below are shared
  // scratch arrays reused across every resolver processed in this function.
  // They are intentionally never read back in bulk: doing so would attribute
  // every collected diagnostic to whichever resolver happens to be current
  // when the array is inspected, with no usable location. Call sites that
  // need located diagnostics (extractArgsFromType per argument, and the
  // return-type resolution below) instead pass their own fresh diagnostics
  // array via `{ ...ctx, diagnostics: [...] }` and convert it immediately
  // (see convertFieldDiagnostics), mirroring type-extractor's per-field
  // pattern. The remaining direct uses of inputContext/outputContext (the
  // whole-args-object reference used for the `isNoArgs`/argsType bookkeeping,
  // and extractExportedInputTypes) deliberately keep the old swallow-diagnostics
  // behavior, since they would otherwise re-report the same cycle a second
  // time for the same argument.
  const inputContext: FieldTypeResolverContext = {
    checker,
    knownTypeNames,
    knownTypeSymbols,
    underlyingSymbolToTypeName,
    globalTypeMappings,
    sourceFiles,
    scalarMappingTable,
    scalarMappingContext: "input",
    discoveredTypes: null,
    diagnostics: [],
  };
  const outputContext: FieldTypeResolverContext = {
    checker,
    knownTypeNames,
    knownTypeSymbols,
    underlyingSymbolToTypeName,
    globalTypeMappings,
    sourceFiles,
    scalarMappingTable,
    scalarMappingContext: "output",
    discoveredTypes: null,
    diagnostics: [],
  };

  // Resolver declarations are independent of each other (no discovered-type
  // registry here, and the contexts' diagnostics arrays are write-only
  // scratch), so all of them are processed concurrently: their checker
  // queries batch into shared round trips. Results are collected in source
  // order, which keeps the output deterministic.
  const resultsByFile = await Promise.all(
    files.map(async (filePath) => {
      const sourceFile = await program.getSourceFile(filePath);
      if (!sourceFile) {
        return [];
      }

      const exportedInputTypes = await extractExportedInputTypes(
        sourceFile,
        inputContext,
      );

      const declarations = sourceFile.statements.flatMap((node) =>
        ts.isVariableStatement(node) && isExported(node)
          ? node.declarationList.declarations.map((declaration) => ({
              declaration,
              statement: node,
            }))
          : [],
      );

      return Promise.all(
        declarations.map(({ declaration, statement }) =>
          processResolverDeclaration({
            declaration,
            statement,
            sourceFile,
            filePath,
            checker,
            inputContext,
            outputContext,
            exportedInputTypes,
          }),
        ),
      );
    }),
  );

  for (const result of resultsByFile.flat()) {
    if (!result) {
      continue;
    }

    diagnostics.push(...result.diagnostics);
    if (result.abstractResolver) {
      abstractTypeResolvers.push(result.abstractResolver);
    }
    if (result.resolver) {
      resolvers.push(result.resolver);
    }
  }

  return { resolvers, abstractTypeResolvers, diagnostics };
}
