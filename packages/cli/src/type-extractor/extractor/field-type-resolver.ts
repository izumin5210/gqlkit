import ts from "typescript";
import { isInternalTypeSymbol } from "../../shared/constants.js";
import { extractInlineObjectProperties as extractInlineObjectPropertiesShared } from "../../shared/inline-object-extractor.js";
import { isInlineObjectType } from "../../shared/inline-object-utils.js";
import { detectScalarMetadata } from "../../shared/metadata-detector.js";
import {
  findEnumParentSymbol,
  findNonNullTypeNode,
  getNonNullableTypes,
  getTypeNameFromNode,
  isBooleanUnion,
  isNullableUnion,
  resolveOriginalSymbol,
} from "../../shared/typescript-utils.js";
import {
  createArrayType,
  createInlineObjectType,
  createLiteralType,
  createPrimitiveType,
  createReferenceType,
  createScalarType,
  createUnionType,
} from "../types/ts-type-reference-factory.js";
import type { TSTypeReference } from "../types/typescript.js";
import type { GlobalTypeMapping } from "./type-extractor.js";

export interface FieldTypeResolverContext {
  readonly checker: ts.TypeChecker;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly knownTypeSymbols: ReadonlyMap<string, ts.Symbol>;
  readonly underlyingSymbolToTypeName: ReadonlyMap<ts.Symbol, string>;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  readonly sourceFiles: ReadonlySet<string>;
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
    return createScalarType(
      metadataResult.scalarName,
      {
        scalarName: metadataResult.scalarName,
        typeName: metadataResult.scalarName,
        baseType: undefined,
        isCustom: true,
        only: metadataResult.only,
      },
      metadataResult.nullable,
    );
  }

  // Boolean union handling
  if (isBooleanUnion(type)) {
    const nullable = isNullableUnion(type);
    return createPrimitiveType("boolean", nullable);
  }

  // Union type handling
  if (type.isUnion()) {
    const nullable = isNullableUnion(type);

    // Preserve type alias name for enum types (string literal unions)
    const aliasSymbol = type.aliasSymbol;
    if (aliasSymbol) {
      const name = aliasSymbol.getName();
      if (
        isKnownSchemaType(name, aliasSymbol, ctx)
      ) {
        return createReferenceType(name, nullable);
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
        return createReferenceType(typeName, nullable);
      }
    }

    const nonNullTypes = getNonNullableTypes(type);

    // Check if all non-null types belong to the same enum (for numeric enums)
    const enumParentSymbol = findEnumParentSymbol(nonNullTypes);
    if (enumParentSymbol) {
      return createReferenceType(enumParentSymbol.getName(), nullable);
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

    return createUnionType(memberResults, nullable);
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
      : createPrimitiveType("unknown");

    return createArrayType(elementResult);
  }

  // Primitive types
  const typeString = checker.typeToString(type);

  if (type.flags & ts.TypeFlags.String) {
    return createPrimitiveType("string");
  }
  if (type.flags & ts.TypeFlags.Number) {
    return createPrimitiveType("number");
  }
  if (
    type.flags & ts.TypeFlags.Boolean ||
    type.flags & ts.TypeFlags.BooleanLiteral
  ) {
    return createPrimitiveType("boolean");
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
      if (
        isKnownSchemaType(aliasName, type.aliasSymbol, ctx)
      ) {
        return createReferenceType(aliasName);
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
        return createReferenceType(typeName);
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
          return createReferenceType(typeName);
        }
      }
      // Not a known type - treat as inline object
      return tryExtractAsInlineObject(type, ctx);
    }
  }

  // Extract type name from typeNode first (takes precedence over type.symbol).
  // This handles cases like:
  // - `typeof def` where the type's symbol is internal (__type, __object)
  // - `Simplify<T>` where the typeNode is the declared alias name but type.symbol is the expanded type
  if (typeNode && ts.isTypeReferenceNode(typeNode)) {
    const typeName = getTypeNameFromNode(typeNode);
    const nodeSymbol = checker.getSymbolAtLocation(typeNode.typeName);
    if (
      typeName &&
      isKnownSchemaType(typeName, nodeSymbol ?? undefined, ctx)
    ) {
      return createReferenceType(typeName);
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
        return createScalarType(globalMapping.scalarName, {
          scalarName: globalMapping.scalarName,
          typeName: globalMapping.typeName,
          baseType: undefined,
          isCustom: true,
          only: globalMapping.only,
        });
      }

      // Check if it's a known type by symbol comparison
      if (
        isKnownSchemaType(symbolName, type.symbol, ctx)
      ) {
        return createReferenceType(symbolName);
      }

      // Check if the symbol is the underlying type of a schema type alias
      // For `type User = ExternalUser;`, this allows `ExternalUser` to be recognized as `User`
      const resolvedSymbol = resolveOriginalSymbol(type.symbol, checker);
      const schemaTypeName = ctx.underlyingSymbolToTypeName.get(resolvedSymbol);
      if (schemaTypeName) {
        return createReferenceType(schemaTypeName);
      }

      // If the name exists in schema but symbol doesn't match,
      // it's a different type with the same name
      if (knownTypeNames.has(symbolName)) {
        // Check if the type is declared within schema files (local shadowing)
        if (isTypeFromSchemaFiles(type.symbol, ctx.sourceFiles)) {
          // Local shadowing - use name matching for backwards compatibility
          return createReferenceType(symbolName);
        }
        // Type from outside schema files - expand as inline object
        return tryExtractAsInlineObject(type, ctx);
      }

      // Unknown type - still return reference but it will likely cause validation error later
      return createReferenceType(symbolName);
    }
  }

  return createReferenceType(typeString);
}

function tryExtractAsInlineObject(
  type: ts.Type,
  ctx: InternalFieldTypeContext,
): TSTypeReference {
  const { visitedTypes } = ctx;
  if (visitedTypes.has(type)) {
    // Cycle detected, return a placeholder reference
    const typeName = type.symbol?.getName() ?? "Unknown";
    return createReferenceType(typeName);
  }

  visitedTypes.add(type);

  const inlineProperties = extractInlineObjectPropertiesShared(
    type,
    ctx.checker,
    (propType) => resolveFieldTypeInternal(propType, undefined, ctx),
  );

  return createInlineObjectType(inlineProperties);
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
