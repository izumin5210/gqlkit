import { resolve } from "node:path";
import {
  type Declaration,
  type EnumDeclaration,
  type ExportDeclaration,
  getCombinedModifierFlags,
  getNameOfDeclaration,
  ModifierFlags,
  type Node,
  type PropertyName,
  type SourceFile,
  type TypeNode,
} from "typescript/ast";
import {
  isEnumDeclaration,
  isExportAssignment,
  isExportDeclaration,
  isIdentifier,
  isInterfaceDeclaration,
  isNamedExports,
  isNumericLiteral,
  isPrefixUnaryExpression,
  isPropertyDeclaration,
  isPropertySignatureDeclaration,
  isStringLiteral,
  isTypeAliasDeclaration,
  isTypeReferenceNode,
  isUnionTypeNode,
} from "typescript/ast/is";
import {
  type Program,
  SymbolFlags,
  type Symbol as TsSymbol,
  type Type,
  TypeFlags,
} from "typescript/async";
import {
  type Diagnostic,
  type DirectiveArgumentValue,
  type DirectiveInfo,
  type InlineObjectMember,
  isBuiltInScalar,
  type PropertyDef,
  type SourceLocation,
  type TSTypeReference,
} from "../../core/index.js";
import type { CheckerLoader } from "../../shared/checker-loader.js";
import { prefetchPropertyFacts } from "../../shared/checker-prefetch.js";
import { detectDefaultValueMetadata } from "../../shared/default-value-detector.js";
import {
  detectDirectiveMetadata,
  hasDirectiveMetadata,
  unwrapDirectiveType,
} from "../../shared/directive-detector.js";
import { getSourceLocationFromNode } from "../../shared/source-location.js";
import {
  extractTsDocFromSymbol,
  extractTsDocInfo,
} from "../../shared/tsdoc-parser.js";
import {
  extractPropertySymbols,
  filterNonNullTypeNodes,
  getNonNullableTypes,
  getTypeNameFromNode,
  hasUndefinedInType,
  isAnonymousObjectType,
  isExported,
  isNullableUnion,
  isNullOrUndefined,
  type SymbolKey,
} from "../../shared/typescript-utils.js";
import type { ScalarMetadataInfo } from "../collector/scalar-collector.js";
import { detectIgnoreFieldsMetadata } from "../detector/ignore-fields-detector.js";
import { validateIgnoreFields } from "../detector/ignore-fields-validator.js";
import {
  extractImplementsFromDefineInterface,
  extractImplementsFromGqlTypeDef,
  isDefineInterfaceTypeAlias,
} from "../detector/interface-detector.js";
import type {
  ScalarBaseTypeMappingTable,
  ScalarMappingContext,
} from "../mapper/scalar-base-type-mapper.js";
import type {
  EnumMemberInfo,
  ExtractedTypeInfo,
  GlobalTypeMapping,
  TypeKind,
  TypeMetadata,
} from "../types/index.js";
import {
  type DiscoveredTypeEntry,
  type FieldTypeResolverDiagnostic,
  resolveFieldType,
} from "./field-type-resolver.js";
import { detectScalarMetadata } from "./scalar-metadata-detector.js";

export interface ExtractionOptions {
  /** Global type mappings from config (scalars with tsType.from omitted) */
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  /** Set of type names declared in the schema (from Phase 1 collection) */
  readonly knownTypeNames: ReadonlySet<string>;
  /** Map of type names to their symbols (from Phase 1 collection) */
  readonly knownTypeSymbols: ReadonlyMap<string, SymbolKey>;
  /** Map of underlying symbols to schema type names (for type alias resolution) */
  readonly underlyingSymbolToTypeName: ReadonlyMap<SymbolKey, string>;
  /** Scalar base type mapping table for automatic base type -> scalar mapping */
  readonly scalarMappingTable: ScalarBaseTypeMappingTable | null;
}

export interface ExtractionResult {
  readonly types: ReadonlyArray<ExtractedTypeInfo>;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
  readonly detectedScalarNames: ReadonlyArray<string>;
  readonly detectedScalars: ReadonlyArray<ScalarMetadataInfo>;
  readonly discoveredTypeNames: ReadonlySet<string>;
}

function isDefaultExport(node: Node, sourceFile: SourceFile): boolean {
  let hasDefaultExport = false;
  const nodeName = getNameOfDeclaration(node as Declaration)?.getText(
    sourceFile,
  );

  sourceFile.forEachChild((child) => {
    if (
      isExportAssignment(child) &&
      !child.isExportEquals &&
      isIdentifier(child.expression)
    ) {
      if (child.expression.text === nodeName) {
        hasDefaultExport = true;
      }
    }
  });

  return hasDefaultExport;
}

export interface FieldExtractionResult {
  fields: PropertyDef[];
  diagnostics: Diagnostic[];
}

async function collectAllFieldNames(
  type: Type,
  checker: CheckerLoader,
): Promise<ReadonlySet<string>> {
  const properties = await extractPropertySymbols(type, checker);
  const fieldNames = new Set<string>();
  for (const prop of properties) {
    const propName = prop.name;
    if (!propName.startsWith(" $")) {
      fieldNames.add(propName);
    }
  }
  return fieldNames;
}

/**
 * Shared field/argument-extraction engine (refactor-plan.md §1.2-D, Phase 5).
 *
 * This is the single implementation for walking property symbols of a
 * TypeScript object type and turning them into `PropertyDef`s — used both
 * for declared GraphQL type fields (type-extractor) and for flattened
 * resolver arguments (resolver-extractor's define-api-extractor, via this
 * module's re-export). `diagnosticLabel` prefixes per-property diagnostic
 * messages ("Field '<name>': ..." vs "Argument '<name>': ...") — the only
 * intentional difference left between the two call sites.
 *
 * Always reports `UNRESOLVABLE_DEFAULT_VALUE` for unresolvable `GqlField`
 * default values. This used to be conditional on a `reportDefaultValueErrors`
 * parameter (`false` for the resolver-argument call site) that preserved a
 * pre-existing behavior split found while unifying this engine in Phase 5:
 * declared-type fields already surfaced the diagnostic, but the old
 * `extractArgsFromType` silently dropped it (it read
 * `defaultValueResult.defaultValue` but never `.errors`). Phase 9 item 5
 * (Decision D6) flips arguments to match and deletes the parameter — see
 * `extractArgsFromType`'s doc for the one remaining wrinkle this surfaced
 * (named args types that are also separately-declared schema types).
 */
export interface ExtractFieldsParams {
  readonly type: Type;
  readonly checker: CheckerLoader;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly knownTypeSymbols: ReadonlyMap<string, SymbolKey>;
  readonly underlyingSymbolToTypeName: ReadonlyMap<SymbolKey, string>;
  readonly sourceFiles: ReadonlySet<string>;
  readonly scalarMappingTable: ScalarBaseTypeMappingTable | null;
  readonly scalarMappingContext: ScalarMappingContext;
  readonly ignoreFields: ReadonlySet<string> | null;
  readonly discoveredTypes: Map<string, DiscoveredTypeEntry> | null;
  /** Diagnostic message prefix: "Field" for declared-type properties, "Argument" for resolver arguments. */
  readonly diagnosticLabel: string;
}

export async function extractFieldsFromType(
  params: ExtractFieldsParams,
): Promise<FieldExtractionResult> {
  const {
    type,
    checker,
    globalTypeMappings,
    knownTypeNames,
    knownTypeSymbols,
    underlyingSymbolToTypeName,
    sourceFiles,
    scalarMappingTable,
    scalarMappingContext,
    ignoreFields,
    discoveredTypes,
    diagnosticLabel,
  } = params;
  const fields: PropertyDef[] = [];
  const diagnostics: Diagnostic[] = [];
  const properties = await extractPropertySymbols(type, checker);
  await prefetchPropertyFacts(checker, properties);

  for (const prop of properties) {
    const propName = prop.name;

    if (propName.startsWith(" $")) {
      continue;
    }

    if (ignoreFields?.has(propName)) {
      continue;
    }

    const propType = await checker.getTypeOfSymbol(prop);
    const declaration = await checker.getFirstDeclarationOfSymbol(prop);

    const optional = await hasUndefinedInType(propType, checker);

    const tsdocInfo = await extractTsDocFromSymbol(prop, checker);

    let actualPropType = propType;
    let directives: ReadonlyArray<DirectiveInfo> | null = null;
    let directiveNullable = false;
    let defaultValue: DirectiveArgumentValue | null = null;

    if (await hasDirectiveMetadata(propType, checker)) {
      const directiveResult = await detectDirectiveMetadata(propType, checker);
      if (directiveResult.directives.length > 0) {
        directives = directiveResult.directives;
      }

      // Detect default value from $gqlkitFieldMeta
      const defaultValueResult = await detectDefaultValueMetadata(
        propType,
        checker,
      );
      if (defaultValueResult.defaultValue) {
        defaultValue = defaultValueResult.defaultValue;
      }
      if (defaultValueResult.errors.length > 0) {
        for (const error of defaultValueResult.errors) {
          diagnostics.push({
            code: error.code,
            message: `${diagnosticLabel} '${propName}': ${error.message}`,
            severity: "warning",
            location: getSourceLocationFromNode(declaration),
          });
        }
      }

      // Check if the original type is nullable before unwrapping
      // TypeScript normalizes WithDirectives<T | null, [...]> to (T & Directive) | null
      if (await isNullableUnion(propType, checker)) {
        directiveNullable = true;
      }
      actualPropType = await unwrapDirectiveType(propType, checker);

      // Check if the unwrapped type (from $gqlkitOriginalType) is nullable
      // This handles cases where TypeScript normalizes intersection types
      // and loses the null from the outer union
      if (
        !directiveNullable &&
        (await isNullableUnion(actualPropType, checker))
      ) {
        directiveNullable = true;
      }
    }

    // Get typeNode from property declaration to preserve type alias names
    let propTypeNode: TypeNode | undefined;
    if (
      declaration &&
      (isPropertySignatureDeclaration(declaration) ||
        isPropertyDeclaration(declaration))
    ) {
      propTypeNode = declaration.type;
    }

    const fieldDiagnostics: FieldTypeResolverDiagnostic[] = [];
    const resolvedType = await resolveFieldType(actualPropType, propTypeNode, {
      checker,
      knownTypeNames,
      knownTypeSymbols,
      underlyingSymbolToTypeName,
      globalTypeMappings,
      sourceFiles,
      scalarMappingTable,
      scalarMappingContext,
      discoveredTypes,
      diagnostics: fieldDiagnostics,
    });
    for (const d of fieldDiagnostics) {
      diagnostics.push({
        code: d.code,
        message: `${diagnosticLabel} '${propName}': ${d.message}`,
        severity: d.severity,
        location: getSourceLocationFromNode(declaration),
      });
    }

    // Skip fields with never type — they have no GraphQL representation
    if (resolvedType.kind === "never") {
      continue;
    }

    // Preserve nullability from original WithDirectives type
    const tsType =
      directiveNullable && !resolvedType.nullable
        ? { ...resolvedType, nullable: true }
        : resolvedType;

    fields.push({
      name: propName,
      tsType,
      optional,
      description: tsdocInfo.description ?? null,
      deprecated: tsdocInfo.deprecated ?? null,
      directives,
      defaultValue,
      sourceLocation: getSourceLocationFromNode(declaration),
    });
  }

  return { fields, diagnostics };
}

function isHeterogeneousEnum(node: Node): boolean {
  if (!isEnumDeclaration(node)) return false;
  const members = node.members;
  if (members.length <= 1) return false;

  let hasString = false;
  let hasNumeric = false;

  for (const member of members) {
    const initializer = member.initializer;
    if (initializer === undefined) {
      hasNumeric = true;
    } else if (isStringLiteral(initializer)) {
      hasString = true;
    } else if (
      isNumericLiteral(initializer) ||
      isPrefixUnaryExpression(initializer)
    ) {
      hasNumeric = true;
    }

    if (hasString && hasNumeric) return true;
  }

  return false;
}

function isConstEnum(node: Node): boolean {
  if (!isEnumDeclaration(node)) return false;
  const modifiers = getCombinedModifierFlags(node);
  return (modifiers & ModifierFlags.Const) !== 0;
}

async function isStringLiteralUnion(
  type: Type,
  checker: CheckerLoader,
): Promise<boolean> {
  if (!type.isUnionType()) return false;

  const nonNullTypes = await getNonNullableTypes(type, checker);

  if (nonNullTypes.length === 0) return false;

  return nonNullTypes.every((t) => t.flags & TypeFlags.StringLiteral);
}

function getEnumMemberName(memberName: PropertyName): string {
  if (isIdentifier(memberName) || isStringLiteral(memberName)) {
    return memberName.text;
  }
  return memberName.getText();
}

async function extractEnumMembers(
  node: EnumDeclaration,
  checker: CheckerLoader,
): Promise<ReadonlyArray<EnumMemberInfo>> {
  const members: EnumMemberInfo[] = [];

  for (const member of node.members) {
    const name = getEnumMemberName(member.name);
    const initializer = member.initializer;

    const symbol = await checker.getSymbolAtLocation(member.name);
    const tsdocInfo = symbol
      ? await extractTsDocFromSymbol(symbol, checker)
      : { description: undefined, deprecated: undefined };

    if (initializer && isStringLiteral(initializer)) {
      members.push({
        name,
        value: initializer.text,
        numericValue: null,
        description: tsdocInfo.description ?? null,
        deprecated: tsdocInfo.deprecated ?? null,
        sourceLocation: getSourceLocationFromNode(member),
      });
    } else {
      const constantValue = await checker.getConstantValue(member);
      if (typeof constantValue === "number") {
        members.push({
          name,
          value: name,
          numericValue: constantValue,
          description: tsdocInfo.description ?? null,
          deprecated: tsdocInfo.deprecated ?? null,
          sourceLocation: getSourceLocationFromNode(member),
        });
      }
    }
  }

  return members;
}

const GRAPHQL_NAME_REGEX = /^[_A-Za-z][_0-9A-Za-z]*$/;

function isValidGraphQLName(name: string): boolean {
  return GRAPHQL_NAME_REGEX.test(name);
}

function validateNumericEnumMembers(
  members: ReadonlyArray<EnumMemberInfo>,
  enumName: string,
  enumLocation: SourceLocation,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const numericMembers = members.filter((m) => m.numericValue !== null);
  if (numericMembers.length === 0) {
    return diagnostics;
  }

  const valueToMembers = new Map<number, string[]>();
  for (const member of numericMembers) {
    const value = member.numericValue!;
    const existing = valueToMembers.get(value) ?? [];
    existing.push(member.name);
    valueToMembers.set(value, existing);
  }

  for (const [value, memberNames] of valueToMembers) {
    if (memberNames.length > 1) {
      diagnostics.push({
        code: "DUPLICATE_ENUM_VALUE",
        message: `Enum '${enumName}' has duplicate numeric value ${value} (used by ${memberNames.join(" and ")})`,
        severity: "error",
        location: enumLocation,
      });
    }
  }

  for (const member of members) {
    if (!isValidGraphQLName(member.name)) {
      diagnostics.push({
        code: "INVALID_ENUM_MEMBER_NAME",
        message: `Enum member '${enumName}.${member.name}' is not a valid GraphQL identifier`,
        severity: "error",
        location: member.sourceLocation ?? enumLocation,
      });
    }
  }

  return diagnostics;
}

async function extractStringLiteralUnionMembers(
  type: Type,
  checker: CheckerLoader,
): Promise<ReadonlyArray<EnumMemberInfo>> {
  if (!type.isUnionType()) return [];

  const members: EnumMemberInfo[] = [];

  for (const t of await checker.getTypesOfType(type)) {
    if (isNullOrUndefined(t)) {
      continue;
    }
    if (t.flags & TypeFlags.StringLiteral) {
      const value = (await checker.typeToString(t)).replace(/^"|"$/g, "");
      members.push({
        name: value,
        value: value,
        numericValue: null,
        description: null,
        deprecated: null,
        sourceLocation: null,
      });
    }
  }

  return members;
}

async function determineTypeKindFromUnion(
  type: Type,
  checker: CheckerLoader,
): Promise<TypeKind | null> {
  if (!type.isUnionType()) {
    return null;
  }

  const nonNullTypes = await getNonNullableTypes(type, checker);

  if (await isStringLiteralUnion(type, checker)) {
    return "enum";
  }

  const objectLike = await Promise.all(
    nonNullTypes.map(
      async (t) =>
        (t.flags & TypeFlags.Object) !== 0 ||
        (t.flags & TypeFlags.Intersection) !== 0 ||
        (await checker.getSymbolOfType(t)) !== undefined,
    ),
  );
  const allObjectTypes = objectLike.every(Boolean);
  if (nonNullTypes.length > 1 && allObjectTypes) {
    return "union";
  }

  return null;
}

/**
 * Determines the {@link TypeKind} of a declared type.
 *
 * Unified for both processing paths (refactor-plan.md §1.2-D, Phase 8 item 2):
 * for locally-declared types the caller passes the declaration node it already
 * has in hand (`node` itself); for re-exported types the caller passes the
 * resolved symbol's first declaration, which may be `undefined` (no
 * declaration found) or live in a different source file than the
 * `export type { ... } from ...` statement. All branches below already guard
 * on `declaration` being present, so a missing declaration safely falls
 * through to the union/object checks — matching both callers' prior
 * behavior exactly.
 */
interface DetermineTypeKindParams {
  readonly declaration: Declaration | undefined;
  readonly type: Type;
  readonly checker: CheckerLoader;
}

async function determineTypeKind(
  params: DetermineTypeKindParams,
): Promise<TypeKind> {
  const { declaration, type, checker } = params;

  if (declaration && isInterfaceDeclaration(declaration)) {
    return "interface";
  }

  if (declaration && isEnumDeclaration(declaration)) {
    return "enum";
  }

  if (
    declaration &&
    isTypeAliasDeclaration(declaration) &&
    (await isDefineInterfaceTypeAlias(declaration, checker))
  ) {
    return "graphqlInterface";
  }

  const unionKind = await determineTypeKindFromUnion(type, checker);
  if (unionKind) {
    return unionKind;
  }

  return "object";
}

function isDeclarationInScannedFiles(
  declaration: Declaration,
  scannedSourceFiles: ReadonlySet<string>,
): boolean {
  const declSourceFileName = resolve(declaration.getSourceFile().fileName);
  return Array.from(scannedSourceFiles).some(
    (sf) => resolve(sf) === declSourceFileName,
  );
}

function createGenericTypeDiagnostic(
  declaration: Declaration,
  exportedName: string,
  location: SourceLocation,
): Diagnostic | null {
  if (
    (isTypeAliasDeclaration(declaration) ||
      isInterfaceDeclaration(declaration)) &&
    declaration.typeParameters &&
    declaration.typeParameters.length > 0
  ) {
    return {
      code: "UNSUPPORTED_SYNTAX",
      message: `Generic type '${exportedName}' is not supported. Consider using a concrete type instead.`,
      severity: "warning",
      location,
    };
  }
  return null;
}

/**
 * Validates the oneOf-input-union convention: an `*Input`-suffixed type whose
 * kind is `"union"` must use only inline object literal members, never named
 * type references. Shared by both declared-type processing paths
 * (refactor-plan.md §1.2-D / Phase 8 item 2 — this diagnostic block used to
 * be duplicated ~28 lines at a time in each path).
 */
interface ValidateOneOfInputUnionParams {
  readonly typeName: string;
  readonly kind: TypeKind;
  readonly location: SourceLocation;
  readonly inlineObjectResult: InlineObjectExtractionResult | null;
}

function validateOneOfInputUnion(
  params: ValidateOneOfInputUnionParams,
): Diagnostic[] {
  const { typeName, kind, location, inlineObjectResult } = params;

  if (!(typeName.endsWith("Input") && kind === "union")) {
    return [];
  }

  if (
    inlineObjectResult?.hasInlineObjects &&
    inlineObjectResult.hasNamedTypes
  ) {
    return [
      {
        code: "ONEOF_MIXED_MEMBERS",
        message: `Input union type '${typeName}' mixes inline object literals with named type references. Use only inline object literals for oneOf input types.`,
        severity: "error",
        location: { ...location, column: 1 },
      },
    ];
  }

  if (
    inlineObjectResult?.hasNamedTypes &&
    !inlineObjectResult.hasInlineObjects
  ) {
    return [
      {
        code: "ONEOF_NAMED_TYPE_UNION",
        message: `Input union type '${typeName}' uses named type references instead of inline object literals. Use inline object pattern: type ${typeName} = { field1: Type1 } | { field2: Type2 }`,
        severity: "error",
        location: { ...location, column: 1 },
      },
    ];
  }

  return [];
}

/**
 * Shared "process one declared type" pipeline (refactor-plan.md §1.2-D,
 * Phase 8 item 2): kind detection → interface-implements extraction →
 * enum-member extraction (early return) OR union/inline-object extraction →
 * ignore-fields validation → field extraction → oneOf validation → building
 * the `ExtractedTypeInfo` to push.
 *
 * Deliberately excludes scalar detection, the generic-type-parameter
 * diagnostic, and (for re-exports) the already-locally-processed dedup skip
 * — those stay in each caller because their relative ORDER against each
 * other differs per path (see the two callers) and reordering them would be
 * an observable behavior change, not a decomposition.
 *
 * `declaration` is the type's own declaration node (interface/type-alias/enum)
 * for kind detection and implements-extraction. Local declarations pass the
 * `Node` they're iterating; re-exports pass the resolved symbol's first
 * declaration, which may live in a different file or be `undefined`.
 */
interface ProcessDeclaredTypeParams {
  readonly name: string;
  readonly type: Type;
  readonly symbol: TsSymbol;
  readonly declaration: Declaration | undefined;
  readonly location: SourceLocation;
  readonly filePath: string;
  readonly exportKind: "named" | "default";
  readonly checker: CheckerLoader;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly knownTypeSymbols: ReadonlyMap<string, SymbolKey>;
  readonly underlyingSymbolToTypeName: ReadonlyMap<SymbolKey, string>;
  readonly scannedSourceFiles: ReadonlySet<string>;
  readonly scalarMappingTable: ScalarBaseTypeMappingTable | null;
  readonly discoveredTypes: Map<string, DiscoveredTypeEntry> | null;
  /**
   * Only the locally-declared path detects `WithDirectives<...>` at the
   * type level (`typeDirectives` + its error diagnostics). The re-exported
   * path never did this — a pre-existing divergence (not part of the
   * audited directive-detection bug family), preserved as-is rather than
   * silently normalized. See refactor-plan.md Phase 8 sub-task report.
   */
  readonly detectTypeLevelDirectives: boolean;
}

interface ProcessDeclaredTypeResult {
  readonly typeInfo: ExtractedTypeInfo | null;
  readonly diagnostics: Diagnostic[];
}

async function processDeclaredType(
  params: ProcessDeclaredTypeParams,
): Promise<ProcessDeclaredTypeResult> {
  const {
    name,
    type,
    symbol,
    declaration,
    location,
    filePath,
    exportKind,
    checker,
    globalTypeMappings,
    knownTypeNames,
    knownTypeSymbols,
    underlyingSymbolToTypeName,
    scannedSourceFiles,
    scalarMappingTable,
    discoveredTypes,
    detectTypeLevelDirectives,
  } = params;

  const diagnostics: Diagnostic[] = [];

  let typeDirectives: ReadonlyArray<DirectiveInfo> | null = null;
  if (
    detectTypeLevelDirectives &&
    (await hasDirectiveMetadata(type, checker))
  ) {
    const directiveResult = await detectDirectiveMetadata(type, checker);
    if (directiveResult.directives.length > 0) {
      typeDirectives = directiveResult.directives;
    }
    for (const error of directiveResult.errors) {
      diagnostics.push({
        code: error.code,
        message: `Type '${name}': ${error.message}`,
        severity: "error",
        location,
      });
    }
  }

  const kind = await determineTypeKind({ declaration, type, checker });
  const tsdocInfo = await extractTsDocFromSymbol(symbol, checker);

  let implementedInterfaces: ReadonlyArray<string> | null = null;
  if (declaration && isTypeAliasDeclaration(declaration)) {
    const declarationSourceFile = declaration.getSourceFile();
    const interfaces =
      kind === "graphqlInterface"
        ? extractImplementsFromDefineInterface(
            declaration,
            declarationSourceFile,
            checker,
          )
        : await extractImplementsFromGqlTypeDef(
            declaration,
            declarationSourceFile,
            checker,
          );
    if (interfaces.length > 0) {
      implementedInterfaces = interfaces;
    }
  }

  const metadata: TypeMetadata = {
    name,
    kind,
    sourceFile: filePath,
    sourceLocation: location,
    exportKind,
    description: tsdocInfo.description ?? null,
    deprecated: tsdocInfo.deprecated ?? null,
    directives: typeDirectives,
  };

  if (kind === "enum") {
    const enumMembers =
      declaration && isEnumDeclaration(declaration)
        ? await extractEnumMembers(declaration, checker)
        : await extractStringLiteralUnionMembers(type, checker);
    return {
      typeInfo: {
        metadata,
        fields: [],
        unionMembers: null,
        inlineObjectMembers: null,
        enumMembers,
        implementedInterfaces: null,
      },
      diagnostics,
    };
  }

  const scalarMappingContext: ScalarMappingContext = name.endsWith("Input")
    ? "input"
    : "output";
  const typeNode =
    declaration && isTypeAliasDeclaration(declaration)
      ? declaration.type
      : undefined;

  const unionMembers = await extractUnionMembers({
    type,
    typeNode: typeNode ?? null,
    checker,
  });
  const inlineObjectResult = await extractInlineObjectMembers({
    type,
    checker,
    globalTypeMappings,
    knownTypeNames,
    knownTypeSymbols,
    underlyingSymbolToTypeName,
    sourceFiles: scannedSourceFiles,
    scalarMappingTable,
    scalarMappingContext,
    discoveredTypes,
    typeNode,
  });
  diagnostics.push(...(inlineObjectResult?.diagnostics ?? []));
  const ignoreFields = await detectIgnoreFieldsMetadata({ type, checker });

  if (ignoreFields !== null && kind !== "union") {
    const allFieldNames = await collectAllFieldNames(type, checker);
    const validationDiagnostics = validateIgnoreFields({
      typeName: name,
      ignoreFields,
      allFieldNames,
      sourceLocation: location,
    });
    diagnostics.push(...validationDiagnostics);
  }

  const fieldResult =
    kind === "union"
      ? { fields: [], diagnostics: [] }
      : await extractFieldsFromType({
          type,
          checker,
          globalTypeMappings,
          knownTypeNames,
          knownTypeSymbols,
          underlyingSymbolToTypeName,
          sourceFiles: scannedSourceFiles,
          scalarMappingTable,
          scalarMappingContext,
          ignoreFields,
          discoveredTypes,
          diagnosticLabel: "Field",
        });
  diagnostics.push(...fieldResult.diagnostics);

  diagnostics.push(
    ...validateOneOfInputUnion({
      typeName: name,
      kind,
      location,
      inlineObjectResult,
    }),
  );

  const inlineObjectMembers = inlineObjectResult?.hasInlineObjects
    ? inlineObjectResult.members
    : null;

  return {
    typeInfo: {
      metadata,
      fields: fieldResult.fields,
      unionMembers,
      inlineObjectMembers,
      enumMembers: null,
      implementedInterfaces,
    },
    diagnostics,
  };
}

interface ProcessReexportedSymbolParams {
  readonly exportedName: string;
  readonly resolvedSymbol: TsSymbol;
  readonly type: Type;
  readonly location: SourceLocation;
  readonly filePath: string;
  readonly checker: CheckerLoader;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly knownTypeSymbols: ReadonlyMap<string, SymbolKey>;
  readonly underlyingSymbolToTypeName: ReadonlyMap<SymbolKey, string>;
  readonly scannedSourceFiles: ReadonlySet<string>;
  readonly scalarMappingTable: ScalarBaseTypeMappingTable | null;
  readonly discoveredTypes: Map<string, DiscoveredTypeEntry> | null;
}

interface ProcessReexportedSymbolResult {
  readonly typeInfo: ExtractedTypeInfo | null;
  readonly diagnostics: Diagnostic[];
  readonly scalarName: string | null;
  readonly scalarMetadata: ScalarMetadataInfo | null;
  readonly skip: boolean;
}

/**
 * Preamble for one re-exported symbol (`export type { X } from "..."`):
 * scalar detection → dedup skip (if the underlying declaration lives in an
 * already-scanned file, it's processed once as a local declaration instead)
 * → the generic-type-parameter diagnostic. Delegates everything from kind
 * detection onward to {@link processDeclaredType}.
 */
async function processReexportedSymbol(
  params: ProcessReexportedSymbolParams,
): Promise<ProcessReexportedSymbolResult> {
  const {
    exportedName,
    resolvedSymbol,
    type,
    location,
    filePath,
    checker,
    globalTypeMappings,
    knownTypeNames,
    knownTypeSymbols,
    underlyingSymbolToTypeName,
    scannedSourceFiles,
    scalarMappingTable,
    discoveredTypes,
  } = params;

  const scalarMetadataResult = await detectScalarMetadata(type, checker);
  if (scalarMetadataResult.scalarName && !scalarMetadataResult.isPrimitive) {
    const tsdocInfo = await extractTsDocFromSymbol(resolvedSymbol, checker);
    return {
      typeInfo: null,
      diagnostics: [],
      scalarName: scalarMetadataResult.scalarName,
      scalarMetadata: {
        scalarName: scalarMetadataResult.scalarName,
        typeName: exportedName,
        only: scalarMetadataResult.only,
        sourceFile: filePath,
        line: location.line,
        description: tsdocInfo.description ?? null,
      },
      skip: false,
    };
  }

  const declaration = await checker.getFirstDeclarationOfSymbol(resolvedSymbol);
  const preambleDiagnostics: Diagnostic[] = [];
  if (declaration) {
    if (
      isDeclarationInScannedFiles(declaration, scannedSourceFiles) &&
      (isTypeAliasDeclaration(declaration) ||
        isInterfaceDeclaration(declaration) ||
        isEnumDeclaration(declaration))
    ) {
      return {
        typeInfo: null,
        diagnostics: [],
        scalarName: null,
        scalarMetadata: null,
        skip: true,
      };
    }

    const genericDiagnostic = createGenericTypeDiagnostic(
      declaration,
      exportedName,
      location,
    );
    if (genericDiagnostic) {
      preambleDiagnostics.push(genericDiagnostic);
    }
  }

  const result = await processDeclaredType({
    name: exportedName,
    type,
    symbol: resolvedSymbol,
    declaration,
    location,
    filePath,
    exportKind: "named",
    checker,
    globalTypeMappings,
    knownTypeNames,
    knownTypeSymbols,
    underlyingSymbolToTypeName,
    scannedSourceFiles,
    scalarMappingTable,
    discoveredTypes,
    detectTypeLevelDirectives: false,
  });

  return {
    typeInfo: result.typeInfo,
    diagnostics: [...preambleDiagnostics, ...result.diagnostics],
    scalarName: null,
    scalarMetadata: null,
    skip: false,
  };
}

interface ProcessExportDeclarationResult {
  readonly types: ExtractedTypeInfo[];
  readonly diagnostics: Diagnostic[];
  readonly detectedScalarNames: string[];
  readonly detectedScalars: ScalarMetadataInfo[];
}

interface ProcessExportDeclarationParams {
  readonly node: ExportDeclaration;
  readonly sourceFile: SourceFile;
  readonly filePath: string;
  readonly checker: CheckerLoader;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly knownTypeSymbols: ReadonlyMap<string, SymbolKey>;
  readonly underlyingSymbolToTypeName: ReadonlyMap<SymbolKey, string>;
  readonly scannedSourceFiles: ReadonlySet<string>;
  readonly scalarMappingTable: ScalarBaseTypeMappingTable | null;
  readonly discoveredTypes: Map<string, DiscoveredTypeEntry> | null;
}

async function processExportDeclaration(
  params: ProcessExportDeclarationParams,
): Promise<ProcessExportDeclarationResult> {
  const {
    node,
    sourceFile,
    filePath,
    checker,
    globalTypeMappings,
    knownTypeNames,
    knownTypeSymbols,
    underlyingSymbolToTypeName,
    scannedSourceFiles,
    scalarMappingTable,
    discoveredTypes,
  } = params;
  const types: ExtractedTypeInfo[] = [];
  const diagnostics: Diagnostic[] = [];
  const detectedScalarNames: string[] = [];
  const detectedScalars: ScalarMetadataInfo[] = [];

  const exportClause = node.exportClause;

  const symbolsToProcess: Array<{
    exportedName: string;
    resolvedSymbol: TsSymbol;
    type: Type;
  }> = [];

  if (node.isTypeOnly && exportClause && isNamedExports(exportClause)) {
    // Declaration-level type-only: `export type { Foo, Bar } from "..."`
    for (const specifier of exportClause.elements) {
      const exportedName = specifier.name.text;
      const localTargetSymbol =
        await checker.getExportSpecifierLocalTargetSymbol(specifier);
      if (!localTargetSymbol) continue;

      const originalSymbol =
        localTargetSymbol.flags & SymbolFlags.Alias
          ? await checker.getAliasedSymbol(localTargetSymbol)
          : localTargetSymbol;
      if (!originalSymbol) continue;

      const type = await checker.getDeclaredTypeOfSymbol(originalSymbol);
      symbolsToProcess.push({
        exportedName,
        resolvedSymbol: originalSymbol,
        type,
      });
    }
  } else if (!node.isTypeOnly && exportClause && isNamedExports(exportClause)) {
    // Specifier-level type-only: `export { type Foo, type Bar } from "..."`
    for (const specifier of exportClause.elements) {
      if (!specifier.isTypeOnly) continue;
      const exportedName = specifier.name.text;
      const localTargetSymbol =
        await checker.getExportSpecifierLocalTargetSymbol(specifier);
      if (!localTargetSymbol) continue;

      const originalSymbol =
        localTargetSymbol.flags & SymbolFlags.Alias
          ? await checker.getAliasedSymbol(localTargetSymbol)
          : localTargetSymbol;
      if (!originalSymbol) continue;

      const type = await checker.getDeclaredTypeOfSymbol(originalSymbol);
      symbolsToProcess.push({
        exportedName,
        resolvedSymbol: originalSymbol,
        type,
      });
    }
  } else if (node.isTypeOnly && !exportClause && node.moduleSpecifier) {
    const moduleSymbol = await checker.getSymbolAtLocation(
      node.moduleSpecifier,
    );
    if (!moduleSymbol) {
      const location = getSourceLocationFromNode(node)!;
      const modulePath = isStringLiteral(node.moduleSpecifier)
        ? node.moduleSpecifier.text
        : node.moduleSpecifier.getText(sourceFile);
      diagnostics.push({
        code: "MODULE_RESOLUTION_ERROR",
        message: `Could not resolve module '${modulePath}'`,
        severity: "error",
        location,
      });
      return { types, diagnostics, detectedScalarNames, detectedScalars };
    }

    const exports = await checker.getExportsOfModule(moduleSymbol);
    for (const exportedSymbol of exports) {
      const resolvedSymbol =
        exportedSymbol.flags & SymbolFlags.Alias
          ? await checker.getAliasedSymbol(exportedSymbol)
          : exportedSymbol;

      if (
        !(
          resolvedSymbol.flags & SymbolFlags.TypeAlias ||
          resolvedSymbol.flags & SymbolFlags.Interface ||
          resolvedSymbol.flags & SymbolFlags.Enum
        )
      ) {
        continue;
      }

      const type = await checker.getDeclaredTypeOfSymbol(resolvedSymbol);
      symbolsToProcess.push({
        exportedName: exportedSymbol.name,
        resolvedSymbol,
        type,
      });
    }
  }

  const location = getSourceLocationFromNode(node)!;
  for (const { exportedName, resolvedSymbol, type } of symbolsToProcess) {
    const result = await processReexportedSymbol({
      exportedName,
      resolvedSymbol,
      type,
      location,
      filePath,
      checker,
      globalTypeMappings,
      knownTypeNames,
      knownTypeSymbols,
      underlyingSymbolToTypeName,
      scannedSourceFiles,
      scalarMappingTable,
      discoveredTypes,
    });

    if (result.skip) continue;

    if (result.scalarName && result.scalarMetadata) {
      detectedScalarNames.push(result.scalarName);
      detectedScalars.push(result.scalarMetadata);
      continue;
    }

    diagnostics.push(...result.diagnostics);
    if (result.typeInfo) {
      types.push(result.typeInfo);
    }
  }

  return { types, diagnostics, detectedScalarNames, detectedScalars };
}

async function getNamedTypeName(
  memberType: Type,
  checker: CheckerLoader,
): Promise<string> {
  // For type aliases (e.g., GqlObject<...>), use aliasSymbol
  const memberTypeAliasSymbol = await checker.getAliasSymbolOfType(memberType);
  if (memberTypeAliasSymbol) {
    return memberTypeAliasSymbol.name;
  }
  // For regular types, use symbol
  return (await checker.getSymbolOfType(memberType))?.name ?? "";
}

interface InlineObjectExtractionResult {
  readonly members: InlineObjectMember[];
  readonly hasInlineObjects: boolean;
  readonly hasNamedTypes: boolean;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

interface ExtractInlineObjectMembersParams {
  readonly type: Type;
  readonly checker: CheckerLoader;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly knownTypeSymbols: ReadonlyMap<string, SymbolKey>;
  readonly underlyingSymbolToTypeName: ReadonlyMap<SymbolKey, string>;
  readonly sourceFiles: ReadonlySet<string>;
  readonly scalarMappingTable: ScalarBaseTypeMappingTable | null;
  readonly scalarMappingContext: ScalarMappingContext;
  readonly discoveredTypes: Map<string, DiscoveredTypeEntry> | null;
  readonly typeNode: TypeNode | undefined;
}

async function extractInlineObjectMembers(
  params: ExtractInlineObjectMembersParams,
): Promise<InlineObjectExtractionResult | null> {
  const {
    type,
    checker,
    globalTypeMappings,
    knownTypeNames,
    knownTypeSymbols,
    underlyingSymbolToTypeName,
    sourceFiles,
    scalarMappingTable,
    scalarMappingContext,
    discoveredTypes,
    typeNode,
  } = params;
  if (!type.isUnionType()) {
    return null;
  }

  const nonNullTypes = await getNonNullableTypes(type, checker);
  const memberTypeNodes =
    typeNode && isUnionTypeNode(typeNode)
      ? filterNonNullTypeNodes(typeNode)
      : [];

  const allObjectTypes = nonNullTypes.every(
    (t) =>
      (t.flags & TypeFlags.Object) !== 0 ||
      (t.flags & TypeFlags.Intersection) !== 0,
  );

  if (nonNullTypes.length < 2 || !allObjectTypes) {
    return null;
  }

  let hasInlineObjects = false;
  let hasNamedTypes = false;
  const members: InlineObjectMember[] = [];
  const diagnostics: Diagnostic[] = [];

  if (memberTypeNodes.length > 0) {
    for (const memberNode of memberTypeNodes) {
      if (isTypeReferenceNode(memberNode)) {
        hasNamedTypes = true;
      } else {
        hasInlineObjects = true;
      }
    }
  } else {
    for (const memberType of nonNullTypes) {
      if (await isAnonymousObjectType(memberType, checker)) {
        hasInlineObjects = true;
      } else {
        hasNamedTypes = true;
      }
    }
  }

  if (hasInlineObjects) {
    const isAnonymous = await Promise.all(
      nonNullTypes.map((t) => isAnonymousObjectType(t, checker)),
    );
    const anonymousMembers = nonNullTypes.filter((_, i) => isAnonymous[i]);
    const propertiesOfMembers = await Promise.all(
      anonymousMembers.map((t) => checker.getPropertiesOfType(t)),
    );
    await prefetchPropertyFacts(checker, propertiesOfMembers.flat());

    for (const properties of propertiesOfMembers) {
      const memberProperties: PropertyDef[] = [];

      for (const prop of properties) {
        const propType = await checker.getTypeOfSymbol(prop);
        const tsdocInfo = await extractTsDocFromSymbol(prop, checker);
        const declaration = await checker.getFirstDeclarationOfSymbol(prop);

        let propTypeNode: TypeNode | undefined;
        if (
          declaration &&
          (isPropertySignatureDeclaration(declaration) ||
            isPropertyDeclaration(declaration))
        ) {
          propTypeNode = declaration.type;
        }

        const fieldDiagnostics: FieldTypeResolverDiagnostic[] = [];
        const resolvedType = await resolveFieldType(propType, propTypeNode, {
          checker,
          knownTypeNames,
          knownTypeSymbols,
          underlyingSymbolToTypeName,
          globalTypeMappings,
          sourceFiles,
          scalarMappingTable,
          scalarMappingContext,
          discoveredTypes,
          diagnostics: fieldDiagnostics,
        });
        for (const diagnostic of fieldDiagnostics) {
          diagnostics.push({
            code: diagnostic.code,
            message: `Field '${prop.name}': ${diagnostic.message}`,
            severity: diagnostic.severity,
            location: getSourceLocationFromNode(declaration),
          });
        }

        // Field resolution diagnostics for inline union members currently mean
        // the outer property itself has no GraphQL representation.
        if (fieldDiagnostics.length > 0) {
          continue;
        }

        // Skip fields with never type — they have no GraphQL representation.
        if (resolvedType.kind === "never") {
          continue;
        }

        // This path (anonymous union-member object types) has never detected
        // optionality/directives/defaultValue/sourceLocation — unlike
        // extractFieldsFromType/extractInlineObjectProperties above, which do.
        // Fill with PropertyDef's "unset" values; no consumer of
        // InlineObjectMember.properties reads these fields.
        memberProperties.push({
          name: prop.name,
          tsType: resolvedType,
          optional: false,
          description: tsdocInfo.description ?? null,
          deprecated: tsdocInfo.deprecated ?? null,
          directives: null,
          defaultValue: null,
          sourceLocation: null,
        });
      }

      members.push({ properties: memberProperties });
    }
  }

  return { members, hasInlineObjects, hasNamedTypes, diagnostics };
}

interface ExtractUnionMembersParams {
  readonly type: Type;
  readonly typeNode: TypeNode | null;
  readonly checker: CheckerLoader;
}

async function extractUnionMembers(
  params: ExtractUnionMembersParams,
): Promise<string[] | null> {
  const { type, typeNode, checker } = params;
  if (!type.isUnionType()) {
    return null;
  }

  const nonNullTypes = await getNonNullableTypes(type, checker);

  const objectLike = await Promise.all(
    nonNullTypes.map(
      async (t) =>
        (t.flags & TypeFlags.Object) !== 0 ||
        (t.flags & TypeFlags.Intersection) !== 0 ||
        (await checker.getSymbolOfType(t)) !== undefined,
    ),
  );
  const allObjectTypes = objectLike.every(Boolean);

  if (nonNullTypes.length > 1 && allObjectTypes) {
    // The checker orders union constituents by its own rules, not by source
    // position, so member nodes are matched to constituents by type identity.
    const memberTypeNodes = new Map<Type, TypeNode>();
    if (typeNode && isUnionTypeNode(typeNode)) {
      for (const memberNode of filterNonNullTypeNodes(typeNode)) {
        memberTypeNodes.set(
          await checker.getTypeFromTypeNode(memberNode),
          memberNode,
        );
      }
    }

    const memberNames = await Promise.all(
      nonNullTypes.map(async (t) => {
        // First try to get name from type
        if (!(await isAnonymousObjectType(t, checker))) {
          const name = await getNamedTypeName(t, checker);
          if (name !== "" && name !== "__type") {
            return name;
          }
        }
        // Fallback to typeNode name for Simplify<T> pattern
        const memberNode = memberTypeNodes.get(t);
        if (memberNode) {
          if (isTypeReferenceNode(memberNode)) {
            return getTypeNameFromNode(memberNode) ?? "";
          }
        }
        return "";
      }),
    );
    const namedMembers = memberNames.filter(
      (name) => name !== "" && name !== "__type",
    );

    if (namedMembers.length > 0) {
      return namedMembers.sort();
    }
  }

  return null;
}

/**
 * What extracting the declarations of the files accumulates, in file order.
 * Extraction is split here so that ranges of files can be extracted
 * separately and their results appended in order.
 */
export interface DeclaredTypesExtraction {
  readonly types: ExtractedTypeInfo[];
  readonly diagnostics: Diagnostic[];
  readonly detectedScalarNames: Set<string>;
  readonly detectedScalars: ScalarMetadataInfo[];
  /**
   * Named types found through fields, registered by the first declaration
   * that reaches them. Field-type resolution only asks whether a name is
   * registered and registers new ones.
   */
  readonly discoveredTypes: Map<string, DiscoveredTypeEntry>;
}

export function createDeclaredTypesExtraction(): DeclaredTypesExtraction {
  return {
    types: [],
    diagnostics: [],
    detectedScalarNames: new Set(),
    detectedScalars: [],
    discoveredTypes: new Map(),
  };
}

export interface ExtractDeclaredTypesParams {
  readonly program: Program;
  readonly checker: CheckerLoader;
  /** The files whose declarations to extract, in order. */
  readonly files: ReadonlyArray<string>;
  /** Every scanned source file. */
  readonly sourceFiles: ReadonlyArray<string>;
  readonly options: ExtractionOptions;
  /** Results of the preceding files, which this appends to. */
  readonly extraction: DeclaredTypesExtraction;
}

/** Extracts the types exported by `files`, in order. */
export async function extractDeclaredTypes(
  params: ExtractDeclaredTypesParams,
): Promise<void> {
  const { program, checker, files, sourceFiles, options, extraction } = params;
  const {
    types,
    diagnostics,
    detectedScalarNames,
    detectedScalars,
    discoveredTypes,
  } = extraction;
  const {
    globalTypeMappings,
    knownTypeNames,
    knownTypeSymbols,
    underlyingSymbolToTypeName,
    scalarMappingTable,
  } = options;
  const scannedSourceFilesSet = new Set(sourceFiles);

  for (const filePath of files) {
    const sourceFile = await program.getSourceFile(filePath);
    if (!sourceFile) {
      diagnostics.push({
        code: "PARSE_ERROR",
        message: `Could not load source file: ${filePath}`,
        severity: "error",
        location: { file: filePath, line: 1, column: 1 },
      });
      continue;
    }

    for (const node of sourceFile.statements) {
      if (isEnumDeclaration(node)) {
        const hasExport = isExported(node);
        const hasDefaultExport = isDefaultExport(node, sourceFile);

        if (!hasExport && !hasDefaultExport) {
          continue;
        }

        const name = node.name.getText(sourceFile);
        const location = getSourceLocationFromNode(node)!;

        if (isConstEnum(node)) {
          diagnostics.push({
            code: "UNSUPPORTED_ENUM_TYPE",
            message: `Const enum '${name}' is not supported. Use a regular enum instead.`,
            severity: "error",
            location,
          });
          continue;
        }

        if (isHeterogeneousEnum(node)) {
          diagnostics.push({
            code: "UNSUPPORTED_ENUM_TYPE",
            message: `Heterogeneous enum '${name}' is not supported. Use a string enum instead.`,
            severity: "error",
            location,
          });
          continue;
        }

        const enumMembers = await extractEnumMembers(node, checker);

        const validationDiagnostics = validateNumericEnumMembers(
          enumMembers,
          name,
          location,
        );
        if (validationDiagnostics.length > 0) {
          diagnostics.push(...validationDiagnostics);
          continue;
        }

        const tsdocInfo = await extractTsDocInfo(node, checker);
        const metadata: TypeMetadata = {
          name,
          kind: "enum",
          sourceFile: filePath,
          sourceLocation: location,
          exportKind: hasDefaultExport ? "default" : "named",
          description: tsdocInfo.description,
          deprecated: tsdocInfo.deprecated,
          directives: null,
        };

        types.push({
          metadata,
          fields: [],
          unionMembers: null,
          inlineObjectMembers: null,
          enumMembers,
          implementedInterfaces: null,
        });
        continue;
      }

      if (isInterfaceDeclaration(node) || isTypeAliasDeclaration(node)) {
        const hasExport = isExported(node);
        const hasDefaultExport = isDefaultExport(node, sourceFile);

        if (!hasExport && !hasDefaultExport) {
          continue;
        }

        const name = node.name.getText(sourceFile);
        const typeSourceLocation = getSourceLocationFromNode(node)!;

        const genericDiagnostic = createGenericTypeDiagnostic(
          node,
          name,
          typeSourceLocation,
        );
        if (genericDiagnostic) {
          diagnostics.push(genericDiagnostic);
        }

        const symbol = await checker.getSymbolAtLocation(node.name);
        if (!symbol) {
          continue;
        }

        const type = await checker.getDeclaredTypeOfSymbol(symbol);

        const scalarMetadata = await detectScalarMetadata(type, checker);
        if (scalarMetadata.scalarName && !scalarMetadata.isPrimitive) {
          detectedScalarNames.add(scalarMetadata.scalarName);
          const tsdocInfo = await extractTsDocFromSymbol(symbol, checker);
          detectedScalars.push({
            scalarName: scalarMetadata.scalarName,
            typeName: name,
            only: scalarMetadata.only,
            sourceFile: filePath,
            line: typeSourceLocation.line,
            description: tsdocInfo.description ?? null,
          });
          continue;
        }

        const result = await processDeclaredType({
          name,
          type,
          symbol,
          declaration: node,
          location: typeSourceLocation,
          filePath,
          exportKind: hasDefaultExport ? "default" : "named",
          checker,
          globalTypeMappings,
          knownTypeNames,
          knownTypeSymbols,
          underlyingSymbolToTypeName,
          scannedSourceFiles: scannedSourceFilesSet,
          scalarMappingTable,
          discoveredTypes,
          detectTypeLevelDirectives: true,
        });
        diagnostics.push(...result.diagnostics);
        if (result.typeInfo) {
          types.push(result.typeInfo);
        }
      }

      if (isExportDeclaration(node)) {
        const result = await processExportDeclaration({
          node,
          sourceFile,
          filePath,
          checker,
          globalTypeMappings,
          knownTypeNames,
          knownTypeSymbols,
          underlyingSymbolToTypeName,
          scannedSourceFiles: scannedSourceFilesSet,
          scalarMappingTable,
          discoveredTypes,
        });
        types.push(...result.types);
        diagnostics.push(...result.diagnostics);
        for (const scalarName of result.detectedScalarNames) {
          detectedScalarNames.add(scalarName);
        }
        detectedScalars.push(...result.detectedScalars);
      }
    }
  }
}

export interface CompleteTypeExtractionParams {
  readonly checker: CheckerLoader;
  readonly sourceFiles: ReadonlyArray<string>;
  readonly options: ExtractionOptions;
  /** Results of every file. */
  readonly extraction: DeclaredTypesExtraction;
}

/**
 * Extracts the types discovered through fields of the declared ones, and
 * collects the scalars all extracted fields use.
 */
export async function completeTypeExtraction(
  params: CompleteTypeExtractionParams,
): Promise<ExtractionResult> {
  const { checker, sourceFiles, options, extraction } = params;
  const {
    types,
    diagnostics,
    detectedScalarNames,
    detectedScalars,
    discoveredTypes,
  } = extraction;
  const {
    globalTypeMappings,
    knownTypeNames,
    knownTypeSymbols,
    underlyingSymbolToTypeName,
    scalarMappingTable,
  } = options;
  const scannedSourceFilesSet = new Set(sourceFiles);

  // Process transitively discovered types
  const processedDiscovered = new Set<string>();
  while (discoveredTypes.size > processedDiscovered.size) {
    for (const [name, entry] of discoveredTypes) {
      if (processedDiscovered.has(name)) continue;
      processedDiscovered.add(name);
      if (knownTypeNames.has(name)) continue;

      const { fields } = await extractFieldsFromType({
        type: entry.tsType,
        checker,
        globalTypeMappings,
        knownTypeNames,
        knownTypeSymbols,
        underlyingSymbolToTypeName,
        sourceFiles: scannedSourceFilesSet,
        scalarMappingTable,
        scalarMappingContext: "output",
        ignoreFields: null,
        discoveredTypes,
        diagnosticLabel: "Field",
      });
      if (fields.length === 0) continue;

      types.push({
        metadata: {
          name,
          kind: "object",
          sourceFile: entry.sourceFile,
          sourceLocation: entry.sourceLocation,
          exportKind: "named",
          description: null,
          deprecated: null,
          directives: null,
        },
        fields,
        enumMembers: null,
        unionMembers: null,
        implementedInterfaces: null,
        inlineObjectMembers: null,
      });
    }
  }

  // Collect scalar names from field types (e.g., unknown → Unknown scalar)
  for (const typeInfo of types) {
    for (const field of typeInfo.fields) {
      collectScalarNamesFromType(field.tsType, detectedScalarNames);
    }
    for (const member of typeInfo.inlineObjectMembers ?? []) {
      for (const property of member.properties) {
        collectScalarNamesFromType(property.tsType, detectedScalarNames);
      }
    }
  }

  return {
    types,
    diagnostics,
    detectedScalarNames: [...detectedScalarNames],
    detectedScalars,
    discoveredTypeNames: new Set(discoveredTypes.keys()),
  };
}

export interface ExtractTypesFromProgramParams {
  readonly program: Program;
  readonly checker: CheckerLoader;
  readonly sourceFiles: ReadonlyArray<string>;
  readonly options: ExtractionOptions;
}

export async function extractTypesFromProgram(
  params: ExtractTypesFromProgramParams,
): Promise<ExtractionResult> {
  const { program, checker, sourceFiles, options } = params;
  const extraction = createDeclaredTypesExtraction();
  await extractDeclaredTypes({
    program,
    checker,
    files: sourceFiles,
    sourceFiles,
    options,
    extraction,
  });
  return completeTypeExtraction({ checker, sourceFiles, options, extraction });
}

function collectScalarNamesFromType(
  tsType: TSTypeReference,
  scalarNames: Set<string>,
): void {
  if (
    tsType.kind === "scalar" &&
    tsType.scalarInfo?.isCustom &&
    !isBuiltInScalar(tsType.scalarInfo.scalarName)
  ) {
    scalarNames.add(tsType.scalarInfo.scalarName);
  }
  if (tsType.elementType) {
    collectScalarNamesFromType(tsType.elementType, scalarNames);
  }
  if (tsType.members) {
    for (const member of tsType.members) {
      collectScalarNamesFromType(member, scalarNames);
    }
  }
  if (tsType.inlineObjectProperties) {
    for (const prop of tsType.inlineObjectProperties) {
      collectScalarNamesFromType(prop.tsType, scalarNames);
    }
  }
}
