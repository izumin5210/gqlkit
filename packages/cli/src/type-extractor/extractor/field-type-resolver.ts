import ts from "typescript";
import { isInternalTypeSymbol } from "../../shared/constants.js";
import { extractInlineObjectProperties as extractInlineObjectPropertiesShared } from "../../shared/inline-object-extractor.js";
import { isInlineObjectType } from "../../shared/inline-object-utils.js";
import { detectScalarMetadata } from "../../shared/metadata-detector.js";
import {
  type DeprecationInfo,
  extractTsDocFromSymbol,
} from "../../shared/tsdoc-parser.js";
import {
  findEnumParentSymbol,
  findNonNullTypeNode,
  getNonNullableTypes,
  getTypeNameFromNode,
  isBooleanUnion,
  isNullableUnion,
  resolveOriginalSymbol,
} from "../../shared/typescript-utils.js";
import type {
  ScalarBaseTypeMappingTable,
  ScalarMappingContext,
} from "../mapper/scalar-base-type-mapper.js";
import { lookupScalarMapping } from "../mapper/scalar-base-type-mapper.js";
import {
  createArrayType,
  createInlineEnumType,
  createInlineObjectType,
  createLiteralType,
  createPrimitiveType,
  createReferenceType,
  createScalarType,
  createUnionType,
} from "../types/ts-type-reference-factory.js";
import type {
  InlineEnumMemberInfo,
  TSTypeReference,
} from "../types/typescript.js";
import type { GlobalTypeMapping } from "./type-extractor.js";

export interface FieldTypeResolverContext {
  readonly checker: ts.TypeChecker;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly knownTypeSymbols: ReadonlyMap<string, ts.Symbol>;
  readonly underlyingSymbolToTypeName: ReadonlyMap<ts.Symbol, string>;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  readonly sourceFiles: ReadonlySet<string>;
  /** Scalar base type mapping table for automatic base type -> scalar mapping */
  readonly scalarMappingTable: ScalarBaseTypeMappingTable | null;
  /** Current resolution context for scalar mapping (input or output) */
  readonly scalarMappingContext: ScalarMappingContext;
}

/**
 * Internal context including cycle detection state.
 */
interface InternalFieldTypeContext extends FieldTypeResolverContext {
  readonly visitedTypes: WeakSet<ts.Type>;
}

/**
 * Resolves a TypeScript type to a TSTypeReference for use in field context.
 *
 * This function is specifically for field type resolution (not type declarations).
 * Key differences from type declaration context:
 * - Uses knownTypeNames to determine if a type exists in the schema
 * - Intersection types are always treated as inline objects
 * - Utility types (both builtin and user-defined) are treated as inline objects
 *   unless they are explicitly declared in the schema
 */
export function resolveFieldType(
  type: ts.Type,
  typeNode: ts.TypeNode | undefined,
  ctx: FieldTypeResolverContext,
): TSTypeReference {
  const internalCtx: InternalFieldTypeContext = {
    ...ctx,
    visitedTypes: new WeakSet(),
  };
  return resolveFieldTypeInternal(type, typeNode, internalCtx);
}

function resolveFieldTypeInternal(
  type: ts.Type,
  typeNode: ts.TypeNode | undefined,
  ctx: InternalFieldTypeContext,
): TSTypeReference {
  const { checker, knownTypeNames, globalTypeMappings } = ctx;

  // Scalar detection
  const metadataResult = detectScalarMetadata(type, checker);
  if (
    metadataResult.scalarName &&
    !metadataResult.isPrimitive &&
    !metadataResult.isList
  ) {
    return createScalarType({
      name: metadataResult.scalarName,
      scalarInfo: {
        scalarName: metadataResult.scalarName,
        typeName: metadataResult.scalarName,
        baseType: undefined,
        isCustom: true,
        only: metadataResult.only,
      },
      nullable: metadataResult.nullable,
    });
  }

  // Boolean union handling
  if (isBooleanUnion(type)) {
    const nullable = isNullableUnion(type);
    return createPrimitiveType({ name: "boolean", nullable });
  }

  // Union type handling
  if (type.isUnion()) {
    const nullable = isNullableUnion(type);

    // Preserve type alias name for enum types (string literal unions)
    const aliasSymbol = type.aliasSymbol;
    if (aliasSymbol) {
      const name = aliasSymbol.getName();
      if (isKnownSchemaType(name, aliasSymbol, ctx)) {
        return createReferenceType({ name, nullable });
      }
    }

    // Fallback: Extract name from typeNode when aliasSymbol is not available (e.g., re-exported types)
    if (typeNode && ts.isTypeReferenceNode(typeNode)) {
      const typeName = getTypeNameFromNode(typeNode);
      const nodeSymbol = checker.getSymbolAtLocation(typeNode.typeName);
      if (
        typeName &&
        isKnownSchemaType(typeName, nodeSymbol ?? undefined, ctx)
      ) {
        return createReferenceType({ name: typeName, nullable });
      }
    }

    const nonNullTypes = getNonNullableTypes(type);

    // Check if all non-null types belong to the same enum
    const enumParentSymbol = findEnumParentSymbol(nonNullTypes);
    if (enumParentSymbol) {
      const enumName = enumParentSymbol.getName();
      // If enum is in knownTypeNames, treat as reference type
      if (isKnownSchemaType(enumName, enumParentSymbol, ctx)) {
        return createReferenceType({ name: enumName, nullable });
      }
      // External enum: extract members and treat as inline enum
      const externalEnumResult = tryExtractExternalEnumAsInlineEnum(
        enumParentSymbol,
        checker,
      );
      if (externalEnumResult) {
        return createInlineEnumType({
          members: externalEnumResult.members,
          nullable,
          externalEnumSymbol: enumParentSymbol,
          externalEnumDescription: externalEnumResult.description,
          externalEnumDeprecated: externalEnumResult.deprecated,
        });
      }
    }

    // Check if all non-null types are string literals (inline enum)
    const inlineEnumResult = tryExtractAsInlineEnum(nonNullTypes);
    if (inlineEnumResult) {
      return createInlineEnumType({
        members: inlineEnumResult,
        nullable,
        externalEnumSymbol: null,
        externalEnumDescription: null,
        externalEnumDeprecated: null,
      });
    }

    if (nonNullTypes.length === 1) {
      const nonNullTypeNode =
        typeNode && ts.isUnionTypeNode(typeNode)
          ? findNonNullTypeNode(typeNode)
          : undefined;

      const innerResult = resolveFieldTypeInternal(
        nonNullTypes[0]!,
        nonNullTypeNode,
        ctx,
      );
      return { ...innerResult, nullable };
    }

    const memberResults = nonNullTypes.map((t) =>
      resolveFieldTypeInternal(t, undefined, ctx),
    );

    return createUnionType({ members: memberResults, nullable });
  }

  // Array type handling
  if (checker.isArrayType(type)) {
    const typeArgs = (type as ts.TypeReference).typeArguments;
    const elementType = typeArgs?.[0];

    let elementTypeNode: ts.TypeNode | undefined;
    if (typeNode && ts.isArrayTypeNode(typeNode)) {
      elementTypeNode = typeNode.elementType;
    }

    const elementResult = elementType
      ? resolveFieldTypeInternal(elementType, elementTypeNode, ctx)
      : createPrimitiveType({ name: "unknown", nullable: false });

    return createArrayType(elementResult);
  }

  // Primitive types
  const typeString = checker.typeToString(type);

  if (type.flags & ts.TypeFlags.String) {
    return createPrimitiveType({ name: "string", nullable: false });
  }
  if (type.flags & ts.TypeFlags.Number) {
    return createPrimitiveType({ name: "number", nullable: false });
  }
  if (
    type.flags & ts.TypeFlags.Boolean ||
    type.flags & ts.TypeFlags.BooleanLiteral
  ) {
    return createPrimitiveType({ name: "boolean", nullable: false });
  }
  if (type.flags & ts.TypeFlags.StringLiteral) {
    return createLiteralType(typeString.replace(/"/g, ""));
  }
  if (type.flags & ts.TypeFlags.NumberLiteral) {
    return createLiteralType(typeString);
  }

  // Intersection types in field context are ALWAYS treated as inline objects
  // GraphQL doesn't have intersection types, so we must expand them
  if (type.isIntersection()) {
    // If the intersection has an alias that's in knownTypeNames, use it
    if (type.aliasSymbol) {
      const aliasName = type.aliasSymbol.getName();
      if (isKnownSchemaType(aliasName, type.aliasSymbol, ctx)) {
        return createReferenceType({ name: aliasName, nullable: false });
      }
    }

    // Otherwise, treat as inline object
    return tryExtractAsInlineObject(type, ctx);
  }

  // Inline object type handling
  if (isInlineObjectType(type)) {
    // Check if typeNode references a known type
    if (typeNode && ts.isTypeReferenceNode(typeNode)) {
      const typeName = getTypeNameFromNode(typeNode);
      const nodeSymbol = checker.getSymbolAtLocation(typeNode.typeName);
      if (
        typeName &&
        isKnownSchemaType(typeName, nodeSymbol ?? undefined, ctx)
      ) {
        return createReferenceType({ name: typeName, nullable: false });
      }
    }

    return tryExtractAsInlineObject(type, ctx);
  }

  // Mapped types (utility types like Omit, Pick, user-defined utilities)
  if (type.flags & ts.TypeFlags.Object) {
    const objectType = type as ts.ObjectType;
    if (objectType.objectFlags & ts.ObjectFlags.Mapped) {
      // Check if typeNode references a known type (schema-defined type)
      if (typeNode && ts.isTypeReferenceNode(typeNode)) {
        const typeName = getTypeNameFromNode(typeNode);
        const nodeSymbol = checker.getSymbolAtLocation(typeNode.typeName);
        if (
          typeName &&
          isKnownSchemaType(typeName, nodeSymbol ?? undefined, ctx)
        ) {
          return createReferenceType({ name: typeName, nullable: false });
        }
      }
      // Not a known type - treat as inline object
      return tryExtractAsInlineObject(type, ctx);
    }
  }

  // Type alias expansion: type aliases not in knownTypeNames should be expanded as inline objects
  // This handles cases like: type MyPayload = { user: User; success: boolean; }
  // where MyPayload is used as return type but not declared as a schema type
  // Only expand if the underlying type is an anonymous object literal, not a named type
  // IMPORTANT: Only expand if the name doesn't exist in schema at all.
  // If the name exists but symbols don't match, that's a shadowing case handled by later logic.
  if (type.aliasSymbol) {
    const aliasName = type.aliasSymbol.getName();
    if (!knownTypeNames.has(aliasName)) {
      // Check if this is an anonymous object type (not an interface or another named type)
      // using ts.ObjectFlags.Anonymous for a more robust check than internal symbol names
      const isAnonymousObject =
        (type.flags & ts.TypeFlags.Object) !== 0 &&
        ((type as ts.ObjectType).objectFlags & ts.ObjectFlags.Anonymous) !== 0;

      if (isAnonymousObject) {
        // Not a known schema type and is an anonymous object - expand to generate Payload type
        return tryExtractAsInlineObject(type, ctx);
      }
    }
  }

  // Extract type name from typeNode first (takes precedence over type.symbol).
  // This handles cases like:
  // - `typeof def` where the type's symbol is internal (__type, __object)
  // - `Simplify<T>` where the typeNode is the declared alias name but type.symbol is the expanded type
  if (typeNode && ts.isTypeReferenceNode(typeNode)) {
    const typeName = getTypeNameFromNode(typeNode);
    const nodeSymbol = checker.getSymbolAtLocation(typeNode.typeName);
    if (typeName && isKnownSchemaType(typeName, nodeSymbol ?? undefined, ctx)) {
      return createReferenceType({ name: typeName, nullable: false });
    }
  }

  // Named type reference (symbol-based lookup)
  if (type.symbol) {
    const symbolName = type.symbol.getName();

    if (!isInternalTypeSymbol(symbolName)) {
      // Check for global type mappings (custom scalars)
      const globalMapping = globalTypeMappings.find(
        (m) => m.typeName === symbolName,
      );
      if (globalMapping) {
        return createScalarType({
          name: globalMapping.scalarName,
          scalarInfo: {
            scalarName: globalMapping.scalarName,
            typeName: globalMapping.typeName,
            baseType: undefined,
            isCustom: true,
            only: globalMapping.only,
          },
          nullable: false,
        });
      }

      // Check if it's a known type by symbol comparison
      if (isKnownSchemaType(symbolName, type.symbol, ctx)) {
        return createReferenceType({ name: symbolName, nullable: false });
      }

      // Check if the symbol is the underlying type of a schema type alias
      // For `type User = ExternalUser;`, this allows `ExternalUser` to be recognized as `User`
      const resolvedSymbol = resolveOriginalSymbol(type.symbol, checker);
      const schemaTypeName = ctx.underlyingSymbolToTypeName.get(resolvedSymbol);
      if (schemaTypeName) {
        return createReferenceType({ name: schemaTypeName, nullable: false });
      }

      // If the name exists in schema but symbol doesn't match,
      // it's a different type with the same name
      if (knownTypeNames.has(symbolName)) {
        // Check if the type is declared within schema files (local shadowing)
        if (isTypeFromSchemaFiles(type.symbol, ctx.sourceFiles)) {
          // Local shadowing - use name matching for backwards compatibility
          return createReferenceType({ name: symbolName, nullable: false });
        }
        // Type from outside schema files - expand as inline object
        return tryExtractAsInlineObject(type, ctx);
      }

      // Check for scalar base type mapping
      // This allows automatic mapping of base types (e.g., Date) to scalar types (e.g., DateTime)
      if (ctx.scalarMappingTable) {
        const scalarMappingResult = lookupScalarMapping({
          baseTypeSymbol: resolvedSymbol,
          context: ctx.scalarMappingContext,
          table: ctx.scalarMappingTable,
        });

        if (scalarMappingResult.mapping) {
          return createScalarType({
            name: scalarMappingResult.mapping.scalarName,
            scalarInfo: {
              scalarName: scalarMappingResult.mapping.scalarName,
              typeName: scalarMappingResult.mapping.sourceTypeName,
              baseType: undefined,
              isCustom: true,
              only: scalarMappingResult.mapping.only,
            },
            nullable: false,
          });
        }
        // Note: Conflicts are handled at the pipeline level, not here
      }

      // Check for external TypeScript enum (not in knownTypeNames)
      // When a field uses an enum type directly (not as a union), handle it here
      // Check both symbol flags and declarations since the flags may vary
      const isEnumSymbol =
        (resolvedSymbol.flags & ts.SymbolFlags.Enum) !== 0 ||
        resolvedSymbol.getDeclarations()?.some(ts.isEnumDeclaration) === true;
      if (isEnumSymbol) {
        const externalEnumResult = tryExtractExternalEnumAsInlineEnum(
          resolvedSymbol,
          checker,
        );
        if (externalEnumResult) {
          return createInlineEnumType({
            members: externalEnumResult.members,
            nullable: false,
            externalEnumSymbol: resolvedSymbol,
            externalEnumDescription: externalEnumResult.description,
            externalEnumDeprecated: externalEnumResult.deprecated,
          });
        }
      }

      // Unknown type - still return reference but it will likely cause validation error later
      return createReferenceType({ name: symbolName, nullable: false });
    }
  }

  return createReferenceType({ name: typeString, nullable: false });
}

function tryExtractAsInlineObject(
  type: ts.Type,
  ctx: InternalFieldTypeContext,
): TSTypeReference {
  const { visitedTypes, checker } = ctx;
  if (visitedTypes.has(type)) {
    // Cycle detected, return a placeholder reference
    const typeName = type.symbol?.getName() ?? "Unknown";
    return createReferenceType({ name: typeName, nullable: false });
  }

  visitedTypes.add(type);

  const inlineProperties = extractInlineObjectPropertiesShared(
    type,
    checker,
    (propType) => resolveFieldTypeInternal(propType, undefined, ctx),
  );

  // Extract type-level TSDoc from the alias symbol if present (Requirement 7.2)
  // Only extract from user-defined types, not built-in TypeScript utility types
  let description: string | null = null;
  let deprecated: DeprecationInfo | null = null;
  if (type.aliasSymbol) {
    const declarations = type.aliasSymbol.getDeclarations();
    const isUserDefined =
      declarations?.some((decl) => {
        const sourceFile = decl.getSourceFile();
        return !sourceFile.isDeclarationFile;
      }) ?? false;

    if (isUserDefined) {
      const tsdocInfo = extractTsDocFromSymbol(type.aliasSymbol, checker);
      description = tsdocInfo.description;
      deprecated = tsdocInfo.deprecated;
    }
  }

  return createInlineObjectType({
    properties: inlineProperties,
    description,
    deprecated,
  });
}

/**
 * Checks if all types are string literals and extracts them as inline enum members.
 * Returns null if any type is not a string literal.
 */
function tryExtractAsInlineEnum(
  types: ReadonlyArray<ts.Type>,
): ReadonlyArray<InlineEnumMemberInfo> | null {
  if (types.length === 0) {
    return null;
  }

  const members: InlineEnumMemberInfo[] = [];

  for (const type of types) {
    if (!(type.flags & ts.TypeFlags.StringLiteral)) {
      return null;
    }

    const literalType = type as ts.StringLiteralType;
    const value = literalType.value;

    members.push({
      value,
      description: null,
      deprecated: null,
    });
  }

  return members;
}

/**
 * Result of extracting an external TypeScript enum.
 * Includes both member info and type-level TSDoc.
 */
interface ExternalEnumExtractionResult {
  readonly members: ReadonlyArray<InlineEnumMemberInfo>;
  /** TSDoc description from the enum type itself */
  readonly description: string | null;
  /** @deprecated tag from the enum type itself */
  readonly deprecated: DeprecationInfo | null;
}

/**
 * Extracts enum members from an external TypeScript enum symbol.
 * Returns the member info including TSDoc description and deprecated status,
 * as well as the enum type's own TSDoc information.
 * Returns null if the enum declaration cannot be found or has no valid members.
 */
function tryExtractExternalEnumAsInlineEnum(
  enumSymbol: ts.Symbol,
  checker: ts.TypeChecker,
): ExternalEnumExtractionResult | null {
  const declarations = enumSymbol.getDeclarations();
  if (!declarations || declarations.length === 0) {
    return null;
  }

  const enumDeclaration = declarations.find(ts.isEnumDeclaration);
  if (!enumDeclaration) {
    return null;
  }

  const members: InlineEnumMemberInfo[] = [];

  for (const member of enumDeclaration.members) {
    const initializer = member.initializer;
    if (!initializer || !ts.isStringLiteral(initializer)) {
      continue;
    }

    const value = initializer.text;
    const memberSymbol = checker.getSymbolAtLocation(member.name);
    const tsdocInfo = memberSymbol
      ? extractTsDocFromSymbol(memberSymbol, checker)
      : { description: null, deprecated: null };

    members.push({
      value,
      description: tsdocInfo.description,
      deprecated: tsdocInfo.deprecated,
    });
  }

  if (members.length === 0) {
    return null;
  }

  // Extract TSDoc from the enum type itself
  const enumTsDoc = extractTsDocFromSymbol(enumSymbol, checker);

  return {
    members,
    description: enumTsDoc.description,
    deprecated: enumTsDoc.deprecated,
  };
}

/**
 * Checks if a type's symbol matches the known schema type symbol.
 * Returns true if both name matches AND symbol matches (or if symbol comparison is not possible).
 */
function isKnownSchemaType(
  name: string,
  typeSymbol: ts.Symbol | undefined,
  ctx: FieldTypeResolverContext,
): boolean {
  const { knownTypeNames, knownTypeSymbols, checker } = ctx;

  if (!knownTypeNames.has(name)) {
    return false;
  }

  const schemaSymbol = knownTypeSymbols.get(name);
  if (!schemaSymbol || !typeSymbol) {
    return false;
  }

  const resolvedTypeSymbol = resolveOriginalSymbol(typeSymbol, checker);
  return resolvedTypeSymbol === schemaSymbol;
}

/**
 * Checks if a type's symbol is declared within the schema source files.
 * Returns true if the type is a local definition (shadowing), false if from external files.
 */
function isTypeFromSchemaFiles(
  symbol: ts.Symbol,
  sourceFiles: ReadonlySet<string>,
): boolean {
  const declarations = symbol.getDeclarations();
  if (!declarations || declarations.length === 0) {
    return false;
  }

  const declaration = declarations[0];
  if (!declaration) {
    return false;
  }

  const sourceFile = declaration.getSourceFile();
  return sourceFiles.has(sourceFile.fileName);
}
