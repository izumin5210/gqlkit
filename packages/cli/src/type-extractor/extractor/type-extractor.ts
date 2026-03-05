import { resolve } from "node:path";
import ts from "typescript";
import { isInternalTypeSymbol } from "../../shared/constants.js";
import { detectDefaultValueMetadata } from "../../shared/default-value-detector.js";
import {
  type DirectiveArgumentValue,
  type DirectiveInfo,
  detectDirectiveMetadata,
  hasDirectiveMetadata,
  unwrapDirectiveType,
} from "../../shared/directive-detector.js";
import { detectIgnoreFieldsMetadata } from "../../shared/ignore-fields-detector.js";
import { validateIgnoreFields } from "../../shared/ignore-fields-validator.js";
import { extractInlineObjectProperties as extractInlineObjectPropertiesShared } from "../../shared/inline-object-extractor.js";
import { isInlineObjectType } from "../../shared/inline-object-utils.js";
import {
  extractImplementsFromDefineInterface,
  extractImplementsFromGqlTypeDef,
  isDefineInterfaceTypeAlias,
} from "../../shared/interface-detector.js";
import { detectScalarMetadata } from "../../shared/metadata-detector.js";
import {
  getSourceLocationFromNode,
  type SourceLocation,
} from "../../shared/source-location.js";
import {
  extractTsDocFromSymbol,
  extractTsDocInfo,
} from "../../shared/tsdoc-parser.js";
import {
  extractPropertySymbols,
  filterNonNullTypeNodes,
  findEnumParentSymbol,
  findNonNullTypeNode,
  getNonNullableTypes,
  getTypeNameFromNode,
  hasUndefinedInType,
  isAnonymousObjectType,
  isBooleanUnion,
  isExported,
  isNullableUnion,
  isNullOrUndefined,
  shouldTreatIntersectionAsInline,
} from "../../shared/typescript-utils.js";
import type { ScalarMetadataInfo } from "../collector/scalar-collector.js";
import type {
  ScalarBaseTypeMappingTable,
  ScalarMappingContext,
} from "../mapper/scalar-base-type-mapper.js";
import {
  createArrayType,
  createInlineObjectType,
  createNumericLiteralType,
  createPrimitiveType,
  createReferenceType,
  createScalarType,
  createStringLiteralType,
  createUnionType,
  type Diagnostic,
  type EnumMemberInfo,
  type ExtractedTypeInfo,
  type FieldDefinition,
  type InlineObjectMember,
  type InlineObjectProperty,
  type TSTypeReference,
  type TypeKind,
  type TypeMetadata,
} from "../types/index.js";
import { resolveFieldType } from "./field-type-resolver.js";

/**
 * Global type mapping configuration.
 * Maps TypeScript type names to GraphQL scalar names when tsType.from is omitted.
 */
export interface GlobalTypeMapping {
  /** TypeScript type name (e.g., "Date", "URL") */
  readonly typeName: string;
  /** GraphQL scalar name (e.g., "DateTime", "URL") */
  readonly scalarName: string;
  /** Usage constraint */
  readonly only: "input" | "output" | null;
}

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

interface TypeReferenceResult {
  readonly tsType: TSTypeReference;
}

/**
 * Context for type declaration resolution.
 * Used when processing type declarations (not field types).
 */
interface TypeDeclarationContext {
  readonly checker: ts.TypeChecker;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly visitedTypes: WeakSet<ts.Type>;
}

/**
 * Attempts to extract a type as an inline object, with cycle detection.
 * Returns a reference type if a cycle is detected, otherwise returns an inline object.
 */
function tryExtractAsInlineObject(
  type: ts.Type,
  ctx: TypeDeclarationContext,
): TypeReferenceResult {
  const { checker, visitedTypes } = ctx;
  if (visitedTypes.has(type)) {
    const typeName = type.symbol?.getName() ?? "Object";
    return {
      tsType: createReferenceType({
        name: typeName === "__type" ? "Object" : typeName,
        nullable: false,
      }),
    };
  }
  visitedTypes.add(type);
  const inlineProperties = extractInlineObjectPropertiesShared(
    type,
    checker,
    (t) => convertTsTypeToReference(t, ctx).tsType,
  );
  return {
    tsType: createInlineObjectType({
      properties: inlineProperties,
      description: null,
      deprecated: null,
    }),
  };
}

function findGlobalTypeMapping(
  typeName: string,
  globalTypeMappings: ReadonlyArray<GlobalTypeMapping>,
): GlobalTypeMapping | undefined {
  return globalTypeMappings.find((m) => m.typeName === typeName);
}

function convertTsTypeToReference(
  type: ts.Type,
  ctx: TypeDeclarationContext,
  typeNode?: ts.TypeNode,
): TypeReferenceResult {
  const { checker, globalTypeMappings, knownTypeNames } = ctx;
  const metadataResult = detectScalarMetadata(type, checker);
  // Skip scalar detection if it's an array of scalars (e.g., Int[])
  // Array types should be handled by the array handling logic below
  if (
    metadataResult.scalarName &&
    !metadataResult.isPrimitive &&
    !metadataResult.isList
  ) {
    return {
      tsType: createScalarType({
        name: metadataResult.scalarName,
        scalarInfo: {
          scalarName: metadataResult.scalarName,
          typeName: metadataResult.scalarName,
          baseType: undefined,
          isCustom: true,
          only: metadataResult.only,
        },
        nullable: metadataResult.nullable,
      }),
    };
  }

  if (isBooleanUnion(type)) {
    const nullable = isNullableUnion(type);
    return {
      tsType: createPrimitiveType({ name: "boolean", nullable }),
    };
  }

  if (type.isUnion()) {
    const nullable = isNullableUnion(type);

    // Preserve type alias name for enum types (string literal unions)
    const aliasSymbol = type.aliasSymbol;
    if (aliasSymbol) {
      const name = aliasSymbol.getName();
      return {
        tsType: createReferenceType({ name, nullable }),
      };
    }

    const nonNullTypes = getNonNullableTypes(type);

    // Check if all non-null types belong to the same enum (for numeric enums)
    const enumParentSymbol = findEnumParentSymbol(nonNullTypes);
    if (enumParentSymbol) {
      return {
        tsType: createReferenceType({
          name: enumParentSymbol.getName(),
          nullable,
        }),
      };
    }

    if (nonNullTypes.length === 1) {
      // For nullable types like User | null, extract the non-null type node
      const nonNullTypeNode =
        typeNode && ts.isUnionTypeNode(typeNode)
          ? findNonNullTypeNode(typeNode)
          : undefined;

      const innerResult = convertTsTypeToReference(
        nonNullTypes[0]!,
        ctx,
        nonNullTypeNode,
      );
      return {
        tsType: { ...innerResult.tsType, nullable },
      };
    }

    const memberResults = nonNullTypes.map((t) =>
      convertTsTypeToReference(t, ctx),
    );

    return {
      tsType: createUnionType({
        members: memberResults.map((r) => r.tsType),
        nullable,
      }),
    };
  }

  if (checker.isArrayType(type)) {
    const typeArgs = (type as ts.TypeReference).typeArguments;
    const elementType = typeArgs?.[0];

    // Extract element type node from array type node (e.g., User[] -> User)
    let elementTypeNode: ts.TypeNode | undefined;
    if (typeNode && ts.isArrayTypeNode(typeNode)) {
      elementTypeNode = typeNode.elementType;
    }

    const elementResult = elementType
      ? convertTsTypeToReference(elementType, ctx, elementTypeNode)
      : {
          tsType: createPrimitiveType({ name: "unknown", nullable: false }),
        };

    return {
      tsType: createArrayType(elementResult.tsType),
    };
  }

  const typeString = checker.typeToString(type);

  if (type.flags & ts.TypeFlags.String) {
    return {
      tsType: createPrimitiveType({ name: "string", nullable: false }),
    };
  }
  if (type.flags & ts.TypeFlags.Number) {
    return {
      tsType: createPrimitiveType({ name: "number", nullable: false }),
    };
  }
  if (
    type.flags & ts.TypeFlags.Boolean ||
    type.flags & ts.TypeFlags.BooleanLiteral
  ) {
    return {
      tsType: createPrimitiveType({ name: "boolean", nullable: false }),
    };
  }
  if (type.flags & ts.TypeFlags.StringLiteral) {
    return {
      tsType: createStringLiteralType(typeString.replace(/"/g, "")),
    };
  }
  if (type.flags & ts.TypeFlags.NumberLiteral) {
    return {
      tsType: createNumericLiteralType(typeString),
    };
  }

  // Handle intersection types that should be treated as inline objects
  // This includes intersections with anonymous members OR intersections of
  // named object types (interfaces) that are not exported as GraphQL types
  if (type.isIntersection()) {
    // If the intersection type has an alias symbol (e.g., Comment = GqlObject<...>),
    // treat it as a named reference to avoid infinite recursion with self-referential types
    if (type.aliasSymbol) {
      const aliasName = type.aliasSymbol.getName();
      return {
        tsType: createReferenceType({ name: aliasName, nullable: false }),
      };
    }

    const shouldTreatAsInline = shouldTreatIntersectionAsInline(type);
    if (shouldTreatAsInline) {
      return tryExtractAsInlineObject(type, ctx);
    }
  }

  if (isInlineObjectType(type)) {
    // Check if typeNode references a known type (schema-defined type)
    if (typeNode && ts.isTypeReferenceNode(typeNode)) {
      const typeName = getTypeNameFromNode(typeNode);
      if (typeName && knownTypeNames.has(typeName)) {
        return {
          tsType: createReferenceType({ name: typeName, nullable: false }),
        };
      }
    }

    return tryExtractAsInlineObject(type, ctx);
  }

  // Check for utility types (Omit, Pick, Partial, Required, etc.)
  // These create mapped types that should be treated as inline objects
  if (type.flags & ts.TypeFlags.Object) {
    const objectType = type as ts.ObjectType;
    if (objectType.objectFlags & ts.ObjectFlags.Mapped) {
      // Check if typeNode references a known type (schema-defined type).
      // This handles Simplify<T> = { [K in keyof T]: T[K] } & {} pattern.
      if (typeNode && ts.isTypeReferenceNode(typeNode)) {
        const typeName = getTypeNameFromNode(typeNode);
        // Only use typeNode name if it's in knownTypeNames (schema-defined type)
        if (typeName && knownTypeNames.has(typeName)) {
          return {
            tsType: createReferenceType({ name: typeName, nullable: false }),
          };
        }
      }
      return tryExtractAsInlineObject(type, ctx);
    }
  }

  if (type.symbol) {
    const symbolName = type.symbol.getName();

    // Skip internal TypeScript symbols (see constants.ts for details)
    if (!isInternalTypeSymbol(symbolName)) {
      const globalMapping = findGlobalTypeMapping(
        symbolName,
        globalTypeMappings,
      );
      if (globalMapping) {
        return {
          tsType: createScalarType({
            name: globalMapping.scalarName,
            scalarInfo: {
              scalarName: globalMapping.scalarName,
              typeName: globalMapping.typeName,
              baseType: undefined,
              isCustom: true,
              only: globalMapping.only,
            },
            nullable: false,
          }),
        };
      }

      return {
        tsType: createReferenceType({ name: symbolName, nullable: false }),
      };
    }
  }

  return {
    tsType: createReferenceType({ name: typeString, nullable: false }),
  };
}

interface FieldExtractionResult {
  fields: FieldDefinition[];
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

interface ExtractFieldsParams {
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
}

function extractFieldsFromType(
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
  } = params;
  const fields: FieldDefinition[] = [];
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
            message: `Field '${propName}': ${error.message}`,
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

    const resolvedType = resolveFieldType(actualPropType, propTypeNode, {
      checker,
      knownTypeNames,
      knownTypeSymbols,
      underlyingSymbolToTypeName,
      globalTypeMappings,
      sourceFiles,
      scalarMappingTable,
      scalarMappingContext,
    });

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

function determineTypeKind(
  node: ts.Node,
  type: ts.Type,
  checker: ts.TypeChecker,
): TypeKind {
  if (ts.isInterfaceDeclaration(node)) {
    return "interface";
  }

  if (ts.isTypeAliasDeclaration(node)) {
    if (isDefineInterfaceTypeAlias(node, checker)) {
      return "graphqlInterface";
    }

    const unionKind = determineTypeKindFromUnion(type);
    if (unionKind) {
      return unionKind;
    }
    return "object";
  }

  return "object";
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

function determineTypeKindFromType(
  type: ts.Type,
  originalSymbol: ts.Symbol,
): TypeKind {
  const declarations = originalSymbol.getDeclarations();
  const declaration = declarations?.[0];

  if (declaration && ts.isInterfaceDeclaration(declaration)) {
    return "interface";
  }

  if (declaration && ts.isEnumDeclaration(declaration)) {
    return "enum";
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
  readonly scalarMappingContext: ScalarMappingContext;
}

interface ProcessReexportedSymbolResult {
  readonly typeInfo: ExtractedTypeInfo | null;
  readonly diagnostics: Diagnostic[];
  readonly scalarName: string | null;
  readonly scalarMetadata: ScalarMetadataInfo | null;
  readonly skip: boolean;
}

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
    scalarMappingContext,
  } = params;

  const diagnostics: Diagnostic[] = [];

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
      diagnostics.push(genericDiagnostic);
    }
  }

  const kind = determineTypeKindFromType(type, resolvedSymbol);
  const tsdocInfo = extractTsDocFromSymbol(resolvedSymbol, checker);

  const metadata: TypeMetadata = {
    name: exportedName,
    kind,
    sourceFile: filePath,
    sourceLocation: location,
    exportKind: "named",
    description: tsdocInfo.description ?? null,
    deprecated: tsdocInfo.deprecated ?? null,
    directives: null,
  };

  if (kind === "enum") {
    const declarations = resolvedSymbol.getDeclarations();
    const declaration = declarations?.[0];
    let enumMembers: ReadonlyArray<EnumMemberInfo>;
    if (declaration && ts.isEnumDeclaration(declaration)) {
      enumMembers = extractEnumMembers(declaration, checker);
    } else {
      enumMembers = extractStringLiteralUnionMembers(type, checker);
    }
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
      scalarName: null,
      scalarMetadata: null,
      skip: false,
    };
  }

  // Get typeNode for union member extraction from declaration
  const reexportDeclarations = resolvedSymbol.getDeclarations();
  const reexportDeclaration = reexportDeclarations?.[0];
  const reexportTypeNode =
    reexportDeclaration && ts.isTypeAliasDeclaration(reexportDeclaration)
      ? reexportDeclaration.type
      : undefined;
  const unionMembers = extractUnionMembers(type, reexportTypeNode);
  const ignoreFields = detectIgnoreFieldsMetadata({ type, checker });

  if (ignoreFields !== null && kind !== "union") {
    const allFieldNames = collectAllFieldNames(type, checker);
    const validationDiagnostics = validateIgnoreFields({
      typeName: exportedName,
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
        });
  diagnostics.push(...fieldResult.diagnostics);

  return {
    typeInfo: {
      metadata,
      fields: fieldResult.fields,
      unionMembers: unionMembers ?? null,
      inlineObjectMembers: null,
      enumMembers: null,
      implementedInterfaces: null,
    },
    diagnostics,
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

function processExportDeclaration(
  node: ts.ExportDeclaration,
  sourceFile: ts.SourceFile,
  filePath: string,
  checker: ts.TypeChecker,
  globalTypeMappings: ReadonlyArray<GlobalTypeMapping>,
  knownTypeNames: ReadonlySet<string>,
  knownTypeSymbols: ReadonlyMap<string, ts.Symbol>,
  underlyingSymbolToTypeName: ReadonlyMap<ts.Symbol, string>,
  scannedSourceFiles: ReadonlySet<string>,
  scalarMappingTable: ScalarBaseTypeMappingTable | null,
): ProcessExportDeclarationResult {
  const types: ExtractedTypeInfo[] = [];
  const diagnostics: Diagnostic[] = [];
  const detectedScalarNames: string[] = [];
  const detectedScalars: ScalarMetadataInfo[] = [];

  if (!node.isTypeOnly) {
    return { types, diagnostics, detectedScalarNames, detectedScalars };
  }

  const exportClause = node.exportClause;

  const symbolsToProcess: Array<{
    exportedName: string;
    resolvedSymbol: ts.Symbol;
    type: ts.Type;
  }> = [];

  if (exportClause && ts.isNamedExports(exportClause)) {
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
  } else if (!exportClause && node.moduleSpecifier) {
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
      scalarMappingContext: exportedName.endsWith("Input") ? "input" : "output",
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
}

interface ExtractInlineObjectMembersParams {
  readonly type: ts.Type;
  readonly checker: ts.TypeChecker;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly typeNode: ts.TypeNode | undefined;
}

function extractInlineObjectMembers(
  params: ExtractInlineObjectMembersParams,
): InlineObjectExtractionResult | null {
  const { type, checker, globalTypeMappings, knownTypeNames, typeNode } =
    params;
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

  const ctx: TypeDeclarationContext = {
    checker,
    globalTypeMappings,
    knownTypeNames,
    visitedTypes: new WeakSet(),
  };

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
        const memberProperties: InlineObjectProperty[] = [];

        for (const prop of properties) {
          const propType = checker.getTypeOfSymbol(prop);
          const tsdocInfo = extractTsDocFromSymbol(prop, checker);
          const typeResult = convertTsTypeToReference(propType, ctx);

          memberProperties.push({
            propertyName: prop.getName(),
            propertyType: typeResult.tsType,
            description: tsdocInfo.description ?? null,
            deprecated: tsdocInfo.deprecated ?? null,
          });
        }

        members.push({ properties: memberProperties });
      }
    }
  }

  return { members, hasInlineObjects, hasNamedTypes };
}

function extractUnionMembers(
  type: ts.Type,
  typeNode?: ts.TypeNode,
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

        if (node.typeParameters && node.typeParameters.length > 0) {
          diagnostics.push({
            code: "UNSUPPORTED_SYNTAX",
            message: `Generic type '${name}' is not supported. Consider using a concrete type instead.`,
            severity: "warning",
            location: typeSourceLocation,
          });
        }

        const symbol = checker.getSymbolAtLocation(node.name);
        if (!symbol) {
          return;
        }

        const type = checker.getDeclaredTypeOfSymbol(symbol);

        const scalarMetadata = detectScalarMetadata(type, checker);
        if (scalarMetadata.scalarName && !scalarMetadata.isPrimitive) {
          detectedScalarNames.add(scalarMetadata.scalarName);
          const tsdocInfo = extractTsDocInfo(node, checker);
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

        let typeDirectives: ReadonlyArray<DirectiveInfo> | null = null;
        let actualType = type;

        if (hasDirectiveMetadata(type)) {
          const directiveResult = detectDirectiveMetadata(type, checker);
          if (directiveResult.directives.length > 0) {
            typeDirectives = directiveResult.directives;
          }
          if (directiveResult.errors.length > 0) {
            for (const error of directiveResult.errors) {
              diagnostics.push({
                code: error.code,
                message: `Type '${name}': ${error.message}`,
                severity: "error",
                location: typeSourceLocation,
              });
            }
          }
          actualType = type;
        }

        const kind = determineTypeKind(node, actualType, checker);
        // Get typeNode for union member extraction (only for type aliases)
        const typeAliasTypeNode = ts.isTypeAliasDeclaration(node)
          ? node.type
          : undefined;
        const unionMembers = extractUnionMembers(actualType, typeAliasTypeNode);
        const inlineObjectResult = extractInlineObjectMembers({
          type: actualType,
          checker,
          globalTypeMappings,
          knownTypeNames,
          typeNode: typeAliasTypeNode,
        });
        const tsdocInfo = extractTsDocInfo(node, checker);

        let implementedInterfaces: ReadonlyArray<string> | null = null;
        if (ts.isTypeAliasDeclaration(node)) {
          if (kind === "graphqlInterface") {
            const interfaces = extractImplementsFromDefineInterface(
              node,
              sourceFile,
              checker,
            );
            if (interfaces.length > 0) {
              implementedInterfaces = interfaces;
            }
          } else {
            const interfaces = extractImplementsFromGqlTypeDef(
              node,
              sourceFile,
              checker,
            );
            if (interfaces.length > 0) {
              implementedInterfaces = interfaces;
            }
          }
        }

        const metadata: TypeMetadata = {
          name,
          kind,
          sourceFile: filePath,
          sourceLocation: typeSourceLocation,
          exportKind: hasDefaultExport ? "default" : "named",
          description: tsdocInfo.description,
          deprecated: tsdocInfo.deprecated,
          directives: typeDirectives,
        };

        if (kind === "enum") {
          const enumMembers = extractStringLiteralUnionMembers(
            actualType,
            checker,
          );
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

        const ignoreFields = detectIgnoreFieldsMetadata({ type, checker });

        if (ignoreFields !== null && kind !== "union") {
          const allFieldNames = collectAllFieldNames(type, checker);
          const validationDiagnostics = validateIgnoreFields({
            typeName: name,
            ignoreFields,
            allFieldNames,
            sourceLocation: typeSourceLocation,
          });
          diagnostics.push(...validationDiagnostics);
        }

        const fieldResult =
          kind === "union"
            ? { fields: [], diagnostics: [] }
            : extractFieldsFromType({
                type: actualType,
                checker,
                globalTypeMappings,
                knownTypeNames,
                knownTypeSymbols,
                underlyingSymbolToTypeName,
                sourceFiles: scannedSourceFilesSet,
                scalarMappingTable,
                scalarMappingContext: name.endsWith("Input")
                  ? "input"
                  : "output",
                ignoreFields,
              });
        const fields = fieldResult.fields;
        diagnostics.push(...fieldResult.diagnostics);

        if (name.endsWith("Input") && kind === "union") {
          if (
            inlineObjectResult?.hasInlineObjects &&
            inlineObjectResult.hasNamedTypes
          ) {
            diagnostics.push({
              code: "ONEOF_MIXED_MEMBERS",
              message: `Input union type '${name}' mixes inline object literals with named type references. Use only inline object literals for oneOf input types.`,
              severity: "error",
              location: {
                ...typeSourceLocation,
                column: 1,
              },
            });
          } else if (
            inlineObjectResult?.hasNamedTypes &&
            !inlineObjectResult.hasInlineObjects
          ) {
            diagnostics.push({
              code: "ONEOF_NAMED_TYPE_UNION",
              message: `Input union type '${name}' uses named type references instead of inline object literals. Use inline object pattern: type ${name} = { field1: Type1 } | { field2: Type2 }`,
              severity: "error",
              location: {
                ...typeSourceLocation,
                column: 1,
              },
            });
          }
        }

        const inlineObjectMembers = inlineObjectResult?.hasInlineObjects
          ? inlineObjectResult.members
          : null;

        const typeInfo: ExtractedTypeInfo = {
          metadata,
          fields,
          unionMembers: unionMembers ?? null,
          inlineObjectMembers,
          enumMembers: null,
          implementedInterfaces,
        };

        types.push(typeInfo);
      }

      if (ts.isExportDeclaration(node)) {
        const result = processExportDeclaration(
          node,
          sourceFile,
          filePath,
          checker,
          globalTypeMappings,
          knownTypeNames,
          knownTypeSymbols,
          underlyingSymbolToTypeName,
          scannedSourceFilesSet,
          scalarMappingTable,
        );
        types.push(...result.types);
        diagnostics.push(...result.diagnostics);
        for (const scalarName of result.detectedScalarNames) {
          detectedScalarNames.add(scalarName);
        }
        detectedScalars.push(...result.detectedScalars);
      }
    });
  }

  return {
    types,
    diagnostics,
    detectedScalarNames: [...detectedScalarNames],
    detectedScalars,
  };
}
