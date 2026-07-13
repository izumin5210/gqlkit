import { resolve } from "node:path";
import ts from "typescript";
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
  readonly knownTypeSymbols: ReadonlyMap<string, ts.Symbol>;
  /** Map of underlying symbols to schema type names (for type alias resolution) */
  readonly underlyingSymbolToTypeName: ReadonlyMap<ts.Symbol, string>;
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

function isDefaultExport(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  let hasDefaultExport = false;
  const nodeName = (node as ts.DeclarationStatement).name?.getText(sourceFile);

  ts.forEachChild(sourceFile, (child) => {
    if (
      ts.isExportAssignment(child) &&
      !child.isExportEquals &&
      ts.isIdentifier(child.expression)
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

function collectAllFieldNames(
  type: ts.Type,
  checker: ts.TypeChecker,
): ReadonlySet<string> {
  const properties = extractPropertySymbols(type, checker);
  const fieldNames = new Set<string>();
  for (const prop of properties) {
    const propName = prop.getName();
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
  readonly type: ts.Type;
  readonly checker: ts.TypeChecker;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly knownTypeSymbols: ReadonlyMap<string, ts.Symbol>;
  readonly underlyingSymbolToTypeName: ReadonlyMap<ts.Symbol, string>;
  readonly sourceFiles: ReadonlySet<string>;
  readonly scalarMappingTable: ScalarBaseTypeMappingTable | null;
  readonly scalarMappingContext: ScalarMappingContext;
  readonly ignoreFields: ReadonlySet<string> | null;
  readonly discoveredTypes: Map<string, DiscoveredTypeEntry> | null;
  /** Diagnostic message prefix: "Field" for declared-type properties, "Argument" for resolver arguments. */
  readonly diagnosticLabel: string;
}

export function extractFieldsFromType(
  params: ExtractFieldsParams,
): FieldExtractionResult {
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
  const properties = extractPropertySymbols(type, checker);

  for (const prop of properties) {
    const propName = prop.getName();

    if (propName.startsWith(" $")) {
      continue;
    }

    if (ignoreFields?.has(propName)) {
      continue;
    }

    const propType = checker.getTypeOfSymbol(prop);
    const declarations = prop.getDeclarations();
    const declaration = declarations?.[0];

    const optional = hasUndefinedInType(propType);

    const tsdocInfo = extractTsDocFromSymbol(prop, checker);

    let actualPropType = propType;
    let directives: ReadonlyArray<DirectiveInfo> | null = null;
    let directiveNullable = false;
    let defaultValue: DirectiveArgumentValue | null = null;

    if (hasDirectiveMetadata(propType)) {
      const directiveResult = detectDirectiveMetadata(propType, checker);
      if (directiveResult.directives.length > 0) {
        directives = directiveResult.directives;
      }

      // Detect default value from $gqlkitFieldMeta
      const defaultValueResult = detectDefaultValueMetadata(propType, checker);
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
      if (isNullableUnion(propType)) {
        directiveNullable = true;
      }
      actualPropType = unwrapDirectiveType(propType, checker);

      // Check if the unwrapped type (from $gqlkitOriginalType) is nullable
      // This handles cases where TypeScript normalizes intersection types
      // and loses the null from the outer union
      if (!directiveNullable && isNullableUnion(actualPropType)) {
        directiveNullable = true;
      }
    }

    // Get typeNode from property declaration to preserve type alias names
    let propTypeNode: ts.TypeNode | undefined;
    if (
      declaration &&
      (ts.isPropertySignature(declaration) ||
        ts.isPropertyDeclaration(declaration))
    ) {
      propTypeNode = declaration.type;
    }

    const fieldDiagnostics: FieldTypeResolverDiagnostic[] = [];
    const resolvedType = resolveFieldType(actualPropType, propTypeNode, {
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

function isHeterogeneousEnum(node: ts.Node): boolean {
  if (!ts.isEnumDeclaration(node)) return false;
  const members = node.members;
  if (members.length <= 1) return false;

  let hasString = false;
  let hasNumeric = false;

  for (const member of members) {
    const initializer = member.initializer;
    if (initializer === undefined) {
      hasNumeric = true;
    } else if (ts.isStringLiteral(initializer)) {
      hasString = true;
    } else if (
      ts.isNumericLiteral(initializer) ||
      ts.isPrefixUnaryExpression(initializer)
    ) {
      hasNumeric = true;
    }

    if (hasString && hasNumeric) return true;
  }

  return false;
}

function isConstEnum(node: ts.Node): boolean {
  if (!ts.isEnumDeclaration(node)) return false;
  const modifiers = ts.getCombinedModifierFlags(node);
  return (modifiers & ts.ModifierFlags.Const) !== 0;
}

function isStringLiteralUnion(type: ts.Type): boolean {
  if (!type.isUnion()) return false;

  const nonNullTypes = getNonNullableTypes(type);

  if (nonNullTypes.length === 0) return false;

  return nonNullTypes.every((t) => t.flags & ts.TypeFlags.StringLiteral);
}

function getEnumMemberName(memberName: ts.PropertyName): string {
  if (ts.isIdentifier(memberName) || ts.isStringLiteral(memberName)) {
    return memberName.text;
  }
  return memberName.getText();
}

function extractEnumMembers(
  node: ts.EnumDeclaration,
  checker: ts.TypeChecker,
): ReadonlyArray<EnumMemberInfo> {
  const members: EnumMemberInfo[] = [];

  for (const member of node.members) {
    const name = getEnumMemberName(member.name);
    const initializer = member.initializer;

    const symbol = checker.getSymbolAtLocation(member.name);
    const tsdocInfo = symbol
      ? extractTsDocFromSymbol(symbol, checker)
      : { description: undefined, deprecated: undefined };

    if (initializer && ts.isStringLiteral(initializer)) {
      members.push({
        name,
        value: initializer.text,
        numericValue: null,
        description: tsdocInfo.description ?? null,
        deprecated: tsdocInfo.deprecated ?? null,
        sourceLocation: getSourceLocationFromNode(member),
      });
    } else {
      const constantValue = checker.getConstantValue(member);
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

function extractStringLiteralUnionMembers(
  type: ts.Type,
  checker: ts.TypeChecker,
): ReadonlyArray<EnumMemberInfo> {
  if (!type.isUnion()) return [];

  const members: EnumMemberInfo[] = [];

  for (const t of type.types) {
    if (isNullOrUndefined(t)) {
      continue;
    }
    if (t.flags & ts.TypeFlags.StringLiteral) {
      const value = checker.typeToString(t).replace(/^"|"$/g, "");
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

function determineTypeKindFromUnion(type: ts.Type): TypeKind | null {
  if (!type.isUnion()) {
    return null;
  }

  const nonNullTypes = getNonNullableTypes(type);

  if (isStringLiteralUnion(type)) {
    return "enum";
  }

  const allObjectTypes = nonNullTypes.every(
    (t) =>
      (t.flags & ts.TypeFlags.Object) !== 0 ||
      (t.flags & ts.TypeFlags.Intersection) !== 0 ||
      t.symbol !== undefined,
  );
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
  readonly declaration: ts.Declaration | undefined;
  readonly type: ts.Type;
  readonly checker: ts.TypeChecker;
}

function determineTypeKind(params: DetermineTypeKindParams): TypeKind {
  const { declaration, type, checker } = params;

  if (declaration && ts.isInterfaceDeclaration(declaration)) {
    return "interface";
  }

  if (declaration && ts.isEnumDeclaration(declaration)) {
    return "enum";
  }

  if (
    declaration &&
    ts.isTypeAliasDeclaration(declaration) &&
    isDefineInterfaceTypeAlias(declaration, checker)
  ) {
    return "graphqlInterface";
  }

  const unionKind = determineTypeKindFromUnion(type);
  if (unionKind) {
    return unionKind;
  }

  return "object";
}

function isDeclarationInScannedFiles(
  declaration: ts.Declaration,
  scannedSourceFiles: ReadonlySet<string>,
): boolean {
  const declSourceFileName = resolve(declaration.getSourceFile().fileName);
  return Array.from(scannedSourceFiles).some(
    (sf) => resolve(sf) === declSourceFileName,
  );
}

function createGenericTypeDiagnostic(
  declaration: ts.Declaration,
  exportedName: string,
  location: SourceLocation,
): Diagnostic | null {
  if (
    (ts.isTypeAliasDeclaration(declaration) ||
      ts.isInterfaceDeclaration(declaration)) &&
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
 * `ts.Node` they're iterating; re-exports pass the resolved symbol's first
 * declaration, which may live in a different file or be `undefined`.
 */
interface ProcessDeclaredTypeParams {
  readonly name: string;
  readonly type: ts.Type;
  readonly symbol: ts.Symbol;
  readonly declaration: ts.Declaration | undefined;
  readonly location: SourceLocation;
  readonly filePath: string;
  readonly exportKind: "named" | "default";
  readonly checker: ts.TypeChecker;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly knownTypeSymbols: ReadonlyMap<string, ts.Symbol>;
  readonly underlyingSymbolToTypeName: ReadonlyMap<ts.Symbol, string>;
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

function processDeclaredType(
  params: ProcessDeclaredTypeParams,
): ProcessDeclaredTypeResult {
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
  if (detectTypeLevelDirectives && hasDirectiveMetadata(type)) {
    const directiveResult = detectDirectiveMetadata(type, checker);
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

  const kind = determineTypeKind({ declaration, type, checker });
  const tsdocInfo = extractTsDocFromSymbol(symbol, checker);

  let implementedInterfaces: ReadonlyArray<string> | null = null;
  if (declaration && ts.isTypeAliasDeclaration(declaration)) {
    const declarationSourceFile = declaration.getSourceFile();
    const interfaces =
      kind === "graphqlInterface"
        ? extractImplementsFromDefineInterface(
            declaration,
            declarationSourceFile,
            checker,
          )
        : extractImplementsFromGqlTypeDef(
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
      declaration && ts.isEnumDeclaration(declaration)
        ? extractEnumMembers(declaration, checker)
        : extractStringLiteralUnionMembers(type, checker);
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
    declaration && ts.isTypeAliasDeclaration(declaration)
      ? declaration.type
      : undefined;

  const unionMembers = extractUnionMembers(type, typeNode);
  const inlineObjectResult = extractInlineObjectMembers({
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
  const ignoreFields = detectIgnoreFieldsMetadata({ type, checker });

  if (ignoreFields !== null && kind !== "union") {
    const allFieldNames = collectAllFieldNames(type, checker);
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
      : extractFieldsFromType({
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
      unionMembers: unionMembers ?? null,
      inlineObjectMembers,
      enumMembers: null,
      implementedInterfaces,
    },
    diagnostics,
  };
}

interface ProcessReexportedSymbolParams {
  readonly exportedName: string;
  readonly resolvedSymbol: ts.Symbol;
  readonly type: ts.Type;
  readonly location: SourceLocation;
  readonly filePath: string;
  readonly checker: ts.TypeChecker;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly knownTypeSymbols: ReadonlyMap<string, ts.Symbol>;
  readonly underlyingSymbolToTypeName: ReadonlyMap<ts.Symbol, string>;
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
function processReexportedSymbol(
  params: ProcessReexportedSymbolParams,
): ProcessReexportedSymbolResult {
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

  const scalarMetadataResult = detectScalarMetadata(type, checker);
  if (scalarMetadataResult.scalarName && !scalarMetadataResult.isPrimitive) {
    const tsdocInfo = extractTsDocFromSymbol(resolvedSymbol, checker);
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

  const declarations = resolvedSymbol.getDeclarations();
  const declaration = declarations?.[0];
  const preambleDiagnostics: Diagnostic[] = [];
  if (declaration) {
    if (
      isDeclarationInScannedFiles(declaration, scannedSourceFiles) &&
      (ts.isTypeAliasDeclaration(declaration) ||
        ts.isInterfaceDeclaration(declaration) ||
        ts.isEnumDeclaration(declaration))
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

  const result = processDeclaredType({
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
  readonly node: ts.ExportDeclaration;
  readonly sourceFile: ts.SourceFile;
  readonly filePath: string;
  readonly checker: ts.TypeChecker;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly knownTypeSymbols: ReadonlyMap<string, ts.Symbol>;
  readonly underlyingSymbolToTypeName: ReadonlyMap<ts.Symbol, string>;
  readonly scannedSourceFiles: ReadonlySet<string>;
  readonly scalarMappingTable: ScalarBaseTypeMappingTable | null;
  readonly discoveredTypes: Map<string, DiscoveredTypeEntry> | null;
}

function processExportDeclaration(
  params: ProcessExportDeclarationParams,
): ProcessExportDeclarationResult {
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
    resolvedSymbol: ts.Symbol;
    type: ts.Type;
  }> = [];

  if (node.isTypeOnly && exportClause && ts.isNamedExports(exportClause)) {
    // Declaration-level type-only: `export type { Foo, Bar } from "..."`
    for (const specifier of exportClause.elements) {
      const exportedName = specifier.name.text;
      const localTargetSymbol =
        checker.getExportSpecifierLocalTargetSymbol(specifier);
      if (!localTargetSymbol) continue;

      const originalSymbol =
        localTargetSymbol.flags & ts.SymbolFlags.Alias
          ? checker.getAliasedSymbol(localTargetSymbol)
          : localTargetSymbol;
      if (!originalSymbol) continue;

      const type = checker.getDeclaredTypeOfSymbol(originalSymbol);
      symbolsToProcess.push({
        exportedName,
        resolvedSymbol: originalSymbol,
        type,
      });
    }
  } else if (
    !node.isTypeOnly &&
    exportClause &&
    ts.isNamedExports(exportClause)
  ) {
    // Specifier-level type-only: `export { type Foo, type Bar } from "..."`
    for (const specifier of exportClause.elements) {
      if (!specifier.isTypeOnly) continue;
      const exportedName = specifier.name.text;
      const localTargetSymbol =
        checker.getExportSpecifierLocalTargetSymbol(specifier);
      if (!localTargetSymbol) continue;

      const originalSymbol =
        localTargetSymbol.flags & ts.SymbolFlags.Alias
          ? checker.getAliasedSymbol(localTargetSymbol)
          : localTargetSymbol;
      if (!originalSymbol) continue;

      const type = checker.getDeclaredTypeOfSymbol(originalSymbol);
      symbolsToProcess.push({
        exportedName,
        resolvedSymbol: originalSymbol,
        type,
      });
    }
  } else if (node.isTypeOnly && !exportClause && node.moduleSpecifier) {
    const moduleSymbol = checker.getSymbolAtLocation(node.moduleSpecifier);
    if (!moduleSymbol) {
      const location = getSourceLocationFromNode(node)!;
      const modulePath = ts.isStringLiteral(node.moduleSpecifier)
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

    const exports = checker.getExportsOfModule(moduleSymbol);
    for (const exportedSymbol of exports) {
      const resolvedSymbol =
        exportedSymbol.flags & ts.SymbolFlags.Alias
          ? checker.getAliasedSymbol(exportedSymbol)
          : exportedSymbol;

      if (
        !(
          resolvedSymbol.flags & ts.SymbolFlags.TypeAlias ||
          resolvedSymbol.flags & ts.SymbolFlags.Interface ||
          resolvedSymbol.flags & ts.SymbolFlags.Enum
        )
      ) {
        continue;
      }

      const type = checker.getDeclaredTypeOfSymbol(resolvedSymbol);
      symbolsToProcess.push({
        exportedName: exportedSymbol.getName(),
        resolvedSymbol,
        type,
      });
    }
  }

  const location = getSourceLocationFromNode(node)!;
  for (const { exportedName, resolvedSymbol, type } of symbolsToProcess) {
    const result = processReexportedSymbol({
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

function getNamedTypeName(memberType: ts.Type): string {
  // For type aliases (e.g., GqlObject<...>), use aliasSymbol
  if (memberType.aliasSymbol) {
    return memberType.aliasSymbol.getName();
  }
  // For regular types, use symbol
  return memberType.symbol?.getName() ?? "";
}

interface InlineObjectExtractionResult {
  readonly members: InlineObjectMember[];
  readonly hasInlineObjects: boolean;
  readonly hasNamedTypes: boolean;
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

interface ExtractInlineObjectMembersParams {
  readonly type: ts.Type;
  readonly checker: ts.TypeChecker;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly knownTypeSymbols: ReadonlyMap<string, ts.Symbol>;
  readonly underlyingSymbolToTypeName: ReadonlyMap<ts.Symbol, string>;
  readonly sourceFiles: ReadonlySet<string>;
  readonly scalarMappingTable: ScalarBaseTypeMappingTable | null;
  readonly scalarMappingContext: ScalarMappingContext;
  readonly discoveredTypes: Map<string, DiscoveredTypeEntry> | null;
  readonly typeNode: ts.TypeNode | undefined;
}

function extractInlineObjectMembers(
  params: ExtractInlineObjectMembersParams,
): InlineObjectExtractionResult | null {
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
  if (!type.isUnion()) {
    return null;
  }

  const nonNullTypes = getNonNullableTypes(type);
  const memberTypeNodes =
    typeNode && ts.isUnionTypeNode(typeNode)
      ? filterNonNullTypeNodes(typeNode)
      : [];

  const allObjectTypes = nonNullTypes.every(
    (t) =>
      (t.flags & ts.TypeFlags.Object) !== 0 ||
      (t.flags & ts.TypeFlags.Intersection) !== 0,
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
      if (ts.isTypeReferenceNode(memberNode)) {
        hasNamedTypes = true;
      } else {
        hasInlineObjects = true;
      }
    }
  } else {
    for (const memberType of nonNullTypes) {
      if (isAnonymousObjectType(memberType)) {
        hasInlineObjects = true;
      } else {
        hasNamedTypes = true;
      }
    }
  }

  if (hasInlineObjects) {
    for (const memberType of nonNullTypes) {
      if (isAnonymousObjectType(memberType)) {
        const properties = memberType.getProperties();
        const memberProperties: PropertyDef[] = [];

        for (const prop of properties) {
          const propType = checker.getTypeOfSymbol(prop);
          const tsdocInfo = extractTsDocFromSymbol(prop, checker);
          const declarations = prop.getDeclarations();
          const declaration = declarations?.[0];

          let propTypeNode: ts.TypeNode | undefined;
          if (
            declaration &&
            (ts.isPropertySignature(declaration) ||
              ts.isPropertyDeclaration(declaration))
          ) {
            propTypeNode = declaration.type;
          }

          const fieldDiagnostics: FieldTypeResolverDiagnostic[] = [];
          const resolvedType = resolveFieldType(propType, propTypeNode, {
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
              message: `Field '${prop.getName()}': ${diagnostic.message}`,
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
            name: prop.getName(),
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
  }

  return { members, hasInlineObjects, hasNamedTypes, diagnostics };
}

function extractUnionMembers(
  type: ts.Type,
  typeNode: ts.TypeNode | undefined,
): string[] | undefined {
  if (!type.isUnion()) {
    return undefined;
  }

  const nonNullTypes = getNonNullableTypes(type);

  const allObjectTypes = nonNullTypes.every(
    (t) =>
      (t.flags & ts.TypeFlags.Object) !== 0 ||
      (t.flags & ts.TypeFlags.Intersection) !== 0 ||
      t.symbol !== undefined,
  );

  if (nonNullTypes.length > 1 && allObjectTypes) {
    // Extract member type nodes from union type node if available
    const memberTypeNodes =
      typeNode && ts.isUnionTypeNode(typeNode)
        ? filterNonNullTypeNodes(typeNode)
        : [];

    const namedMembers = nonNullTypes
      .map((t, index) => {
        // First try to get name from type
        if (!isAnonymousObjectType(t)) {
          const name = getNamedTypeName(t);
          if (name !== "" && name !== "__type") {
            return name;
          }
        }
        // Fallback to typeNode name for Simplify<T> pattern
        if (memberTypeNodes[index]) {
          const memberNode = memberTypeNodes[index];
          if (ts.isTypeReferenceNode(memberNode)) {
            return getTypeNameFromNode(memberNode) ?? "";
          }
        }
        return "";
      })
      .filter((name) => name !== "" && name !== "__type");

    if (namedMembers.length > 0) {
      return namedMembers.sort();
    }
  }

  return undefined;
}

export function extractTypesFromProgram(
  program: ts.Program,
  sourceFiles: ReadonlyArray<string>,
  options: ExtractionOptions,
): ExtractionResult {
  const checker = program.getTypeChecker();
  const types: ExtractedTypeInfo[] = [];
  const diagnostics: Diagnostic[] = [];
  const detectedScalarNames = new Set<string>();
  const detectedScalars: ScalarMetadataInfo[] = [];
  const discoveredTypes = new Map<string, DiscoveredTypeEntry>();
  const {
    globalTypeMappings,
    knownTypeNames,
    knownTypeSymbols,
    underlyingSymbolToTypeName,
    scalarMappingTable,
  } = options;
  const scannedSourceFilesSet = new Set(sourceFiles);

  for (const filePath of sourceFiles) {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) {
      diagnostics.push({
        code: "PARSE_ERROR",
        message: `Could not load source file: ${filePath}`,
        severity: "error",
        location: { file: filePath, line: 1, column: 1 },
      });
      continue;
    }

    ts.forEachChild(sourceFile, (node) => {
      if (ts.isEnumDeclaration(node)) {
        const hasExport = isExported(node);
        const hasDefaultExport = isDefaultExport(node, sourceFile);

        if (!hasExport && !hasDefaultExport) {
          return;
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
          return;
        }

        if (isHeterogeneousEnum(node)) {
          diagnostics.push({
            code: "UNSUPPORTED_ENUM_TYPE",
            message: `Heterogeneous enum '${name}' is not supported. Use a string enum instead.`,
            severity: "error",
            location,
          });
          return;
        }

        const enumMembers = extractEnumMembers(node, checker);

        const validationDiagnostics = validateNumericEnumMembers(
          enumMembers,
          name,
          location,
        );
        if (validationDiagnostics.length > 0) {
          diagnostics.push(...validationDiagnostics);
          return;
        }

        const tsdocInfo = extractTsDocInfo(node, checker);
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
        return;
      }

      if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
        const hasExport = isExported(node);
        const hasDefaultExport = isDefaultExport(node, sourceFile);

        if (!hasExport && !hasDefaultExport) {
          return;
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

        const symbol = checker.getSymbolAtLocation(node.name);
        if (!symbol) {
          return;
        }

        const type = checker.getDeclaredTypeOfSymbol(symbol);

        const scalarMetadata = detectScalarMetadata(type, checker);
        if (scalarMetadata.scalarName && !scalarMetadata.isPrimitive) {
          detectedScalarNames.add(scalarMetadata.scalarName);
          const tsdocInfo = extractTsDocFromSymbol(symbol, checker);
          detectedScalars.push({
            scalarName: scalarMetadata.scalarName,
            typeName: name,
            only: scalarMetadata.only,
            sourceFile: filePath,
            line: typeSourceLocation.line,
            description: tsdocInfo.description ?? null,
          });
          return;
        }

        const result = processDeclaredType({
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

      if (ts.isExportDeclaration(node)) {
        const result = processExportDeclaration({
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
    });
  }

  // Process transitively discovered types
  const processedDiscovered = new Set<string>();
  while (discoveredTypes.size > processedDiscovered.size) {
    for (const [name, entry] of discoveredTypes) {
      if (processedDiscovered.has(name)) continue;
      processedDiscovered.add(name);
      if (knownTypeNames.has(name)) continue;

      const { fields } = extractFieldsFromType({
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
