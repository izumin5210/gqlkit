import { relative } from "node:path";
import { SyntaxKind, type TypeNode } from "typescript/ast";
import {
  isArrayTypeNode,
  isEnumDeclaration,
  isStringLiteral,
  isTypeReferenceNode,
  isUnionTypeNode,
} from "typescript/ast/is";
import {
  ObjectFlags,
  type ObjectType,
  type StringLiteralType,
  SymbolFlags,
  type Symbol as TsSymbol,
  type Type,
  TypeFlags,
  type TypeReference,
} from "typescript/async";
import {
  createArrayType,
  createInlineEnumType,
  createInlineObjectType,
  createNeverType,
  createNumericLiteralType,
  createPrimitiveType,
  createReferenceType,
  createScalarType,
  createStringLiteralType,
  createUnionType,
  type DeprecationInfo,
  type DiagnosticCode,
  type InlineEnumMemberInfo,
  type SourceLocation,
  type TSTypeReference,
} from "../../core/index.js";
import type { CheckerLoader } from "../../shared/checker-loader.js";
import { isInternalTypeSymbol } from "../../shared/constants.js";
import { getSourceLocationFromNode } from "../../shared/source-location.js";
import { extractTsDocFromSymbol } from "../../shared/tsdoc-parser.js";
import {
  filterNonNullTypeNodes,
  findEnumParentSymbol,
  findNonNullTypeNode,
  getNonNullableTypes,
  getSymbolIdentityKey,
  getTypeNameFromNode,
  isBooleanUnion,
  isNullableUnion,
  resolveOriginalSymbol,
  type SymbolKey,
} from "../../shared/typescript-utils.js";
import {
  detectBrandedType,
  detectUniformBrandedType,
} from "../detector/branded-type-detector.js";
import { extractInlineObjectProperties as extractInlineObjectPropertiesShared } from "../detector/inline-object-extractor.js";
import { isInlineObjectType } from "../detector/inline-object-utils.js";
import type {
  ScalarBaseTypeMappingTable,
  ScalarMappingContext,
} from "../mapper/scalar-base-type-mapper.js";
import { lookupScalarMapping } from "../mapper/scalar-base-type-mapper.js";
import type { GlobalTypeMapping } from "../types/index.js";
import { detectScalarMetadata } from "./scalar-metadata-detector.js";

export interface DiscoveredTypeEntry {
  readonly name: string;
  readonly tsType: Type;
  readonly tsSymbol: TsSymbol;
  readonly sourceFile: string;
  readonly sourceLocation: SourceLocation;
}

export interface FieldTypeResolverDiagnostic {
  readonly code: DiagnosticCode;
  readonly message: string;
  readonly severity: "error" | "warning";
}

export interface FieldTypeResolverContext {
  readonly checker: CheckerLoader;
  readonly knownTypeNames: ReadonlySet<string>;
  readonly knownTypeSymbols: ReadonlyMap<string, SymbolKey>;
  readonly underlyingSymbolToTypeName: ReadonlyMap<SymbolKey, string>;
  readonly globalTypeMappings: ReadonlyArray<GlobalTypeMapping>;
  readonly sourceFiles: ReadonlySet<string>;
  /** Scalar base type mapping table for automatic base type -> scalar mapping */
  readonly scalarMappingTable: ScalarBaseTypeMappingTable | null;
  /** Current resolution context for scalar mapping (input or output) */
  readonly scalarMappingContext: ScalarMappingContext;
  /** Mutable map for collecting transitively discovered types */
  readonly discoveredTypes: Map<string, DiscoveredTypeEntry> | null;
  /** Mutable array for collecting diagnostics during field type resolution */
  readonly diagnostics: FieldTypeResolverDiagnostic[];
}

/**
 * Internal context including cycle detection state.
 */
interface InternalFieldTypeContext extends FieldTypeResolverContext {
  readonly visitedTypes: WeakSet<Type>;
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
export async function resolveFieldType(
  type: Type,
  typeNode: TypeNode | undefined,
  ctx: FieldTypeResolverContext,
): Promise<TSTypeReference> {
  const internalCtx: InternalFieldTypeContext = {
    ...ctx,
    visitedTypes: new WeakSet(),
  };
  return resolveFieldTypeInternal(type, typeNode, internalCtx);
}

/**
 * Checks whether `typeNode` is a `TypeReferenceNode` naming a known schema
 * type, returning the corresponding reference `TSTypeReference` if so, or
 * `null` if not (fall through to the next resolution strategy).
 *
 * `resolveFieldTypeInternal` performs this exact check ~6 times against
 * different candidate nodes at different points in its strategy chain
 * (refactor-plan.md §1.2-E, Phase 8 item 3) — decomposition only, the call
 * sites' order and surrounding guards are unchanged.
 */
interface TryReferenceFromTypeNodeParams {
  readonly typeNode: TypeNode | undefined;
  readonly ctx: FieldTypeResolverContext;
  readonly nullable: boolean;
}

async function tryReferenceFromTypeNode(
  params: TryReferenceFromTypeNodeParams,
): Promise<TSTypeReference | null> {
  const { typeNode, ctx, nullable } = params;
  if (!(typeNode && isTypeReferenceNode(typeNode))) {
    return null;
  }
  const typeName = getTypeNameFromNode(typeNode);
  const nodeSymbol = await ctx.checker.getSymbolAtLocation(typeNode.typeName);
  if (
    typeName &&
    (await isKnownSchemaType(typeName, nodeSymbol ?? undefined, ctx))
  ) {
    return createReferenceType({ name: typeName, nullable });
  }
  return null;
}

/**
 * Registers `name` for transitive discovery if it's eligible: a user-defined
 * type (declaration outside a `.d.ts` file) with at least one property, not
 * already discovered. Returns whether `name` is now present in
 * `discoveredTypes` — either just registered here, or already present
 * (both cases mean "safe to return a reference").
 *
 * `resolveFieldTypeInternal` repeats this ~25-30 line block 3 times, once
 * per place a non-schema named type is encountered (intersection alias,
 * anonymous type-alias expansion, plain named type) (refactor-plan.md
 * §1.2-E, Phase 8 item 3) — decomposition only.
 */
interface RegisterDiscoveredTypeParams {
  readonly checker: CheckerLoader;
  readonly name: string;
  readonly type: Type;
  readonly symbol: TsSymbol;
  readonly discoveredTypes: Map<string, DiscoveredTypeEntry> | null;
}

async function registerDiscoveredType(
  params: RegisterDiscoveredTypeParams,
): Promise<boolean> {
  const { checker, name, type, symbol, discoveredTypes } = params;
  if (!discoveredTypes) {
    return false;
  }
  if (!discoveredTypes.has(name)) {
    const decl = await checker.getFirstDeclarationOfSymbol(symbol);
    if (decl && !decl.getSourceFile().isDeclarationFile) {
      const properties = await checker.getPropertiesOfType(type);
      if (properties.length > 0) {
        const declSourceFile = decl.getSourceFile();
        const location = getSourceLocationFromNode(decl) ?? {
          file: declSourceFile.fileName,
          line: 1,
          column: 1,
        };
        discoveredTypes.set(name, {
          name,
          tsType: type,
          tsSymbol: symbol,
          sourceFile: relative(process.cwd(), declSourceFile.fileName),
          sourceLocation: location,
        });
      }
    }
  }
  return discoveredTypes.has(name);
}

/**
 * Resolves one union member. An unresolvable reference to an object type with
 * properties (e.g. an external library type) is expanded as an inline object;
 * discovered types stay references so they can be registered later under
 * their original names.
 */
async function resolveUnionMember(
  t: Type,
  ctx: InternalFieldTypeContext,
): Promise<TSTypeReference> {
  const { checker } = ctx;
  const result = await resolveFieldTypeInternal(t, undefined, ctx);
  if (
    result.kind === "reference" &&
    result.name !== null &&
    !ctx.knownTypeNames.has(result.name) &&
    t.flags & TypeFlags.Object &&
    (await checker.getPropertiesOfType(t)).length > 0 &&
    !ctx.discoveredTypes?.has(result.name)
  ) {
    return tryExtractAsInlineObject(t, ctx, result.name);
  }
  return result;
}

async function resolveFieldTypeInternal(
  type: Type,
  typeNode: TypeNode | undefined,
  ctx: InternalFieldTypeContext,
): Promise<TSTypeReference> {
  const { checker, knownTypeNames, globalTypeMappings } = ctx;

  // Scalar detection
  const metadataResult = await detectScalarMetadata(type, checker);
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
        baseType: null,
        isCustom: true,
        only: metadataResult.only,
      },
      nullable: metadataResult.nullable,
    });
  }

  // Early typeNode-based known type check.
  // When resolving property types from inline objects, checker.getTypeOfSymbol()
  // can lose the original type alias (e.g., GqlObject<T> intersection flattened to T).
  // The typeNode from the property declaration preserves the original type reference,
  // so check it before any structural analysis.
  {
    const ref = await tryReferenceFromTypeNode({
      typeNode,
      ctx,
      nullable: await isNullableUnion(type, checker),
    });
    if (ref) return ref;
  }

  // Boolean union handling
  if (await isBooleanUnion(type, checker)) {
    const nullable = await isNullableUnion(type, checker);
    return createPrimitiveType({ name: "boolean", nullable });
  }

  // Union type handling
  if (type.isUnionType()) {
    const nullable = await isNullableUnion(type, checker);

    // Preserve type alias name for enum types (string literal unions)
    const aliasSymbol = await checker.getAliasSymbolOfType(type);
    if (aliasSymbol) {
      const name = aliasSymbol.name;
      if (await isKnownSchemaType(name, aliasSymbol, ctx)) {
        return createReferenceType({ name, nullable });
      }
    }

    // Fallback: Extract name from typeNode when aliasSymbol is not available (e.g., re-exported types)
    {
      const ref = await tryReferenceFromTypeNode({ typeNode, ctx, nullable });
      if (ref) return ref;
    }

    // Handle `T | null` where T is a known union type alias.
    // TypeScript flattens `T | null` when T is itself a union, losing aliasSymbol.
    // Recover the alias by inspecting the UnionTypeNode children for a TypeReferenceNode.
    // Only applies when there is exactly one non-null type node (e.g., `Item | null`),
    // not when there are multiple (e.g., `User | Post | null` which is an inline union).
    if (nullable && typeNode && isUnionTypeNode(typeNode)) {
      const nonNullTypeNodes = filterNonNullTypeNodes(typeNode);
      if (nonNullTypeNodes.length === 1) {
        const ref = await tryReferenceFromTypeNode({
          typeNode: nonNullTypeNodes[0],
          ctx,
          nullable,
        });
        if (ref) return ref;
      }
    }

    const nonNullTypes = await getNonNullableTypes(type, checker);

    // Check if all non-null types belong to the same enum
    const enumParentSymbol = await findEnumParentSymbol(nonNullTypes, checker);
    if (enumParentSymbol) {
      const enumName = enumParentSymbol.name;
      // If enum is in knownTypeNames, treat as reference type
      if (await isKnownSchemaType(enumName, enumParentSymbol, ctx)) {
        return createReferenceType({ name: enumName, nullable });
      }
      // External enum: extract members and treat as inline enum
      const externalEnumResult = await tryExtractExternalEnumAsInlineEnum(
        enumParentSymbol,
        checker,
      );
      if (externalEnumResult) {
        return createInlineEnumType({
          members: externalEnumResult.members,
          nullable,
          externalEnumKey: getSymbolIdentityKey(enumParentSymbol),
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
        externalEnumKey: null,
        externalEnumDescription: null,
        externalEnumDeprecated: null,
      });
    }

    // Check if all non-null types are branded primitives with the same base type
    // This handles cases like: boolean & { __nominal: true }
    // which expands to: (true & { __nominal: true }) | (false & { __nominal: true })
    const uniformBrandedResult = await detectUniformBrandedType(
      nonNullTypes,
      checker,
    );
    if (
      uniformBrandedResult.isBranded &&
      uniformBrandedResult.baseType !== null
    ) {
      return createPrimitiveType({
        name: uniformBrandedResult.baseType,
        nullable,
      });
    }

    if (nonNullTypes.length === 1) {
      const nonNullTypeNode =
        typeNode && isUnionTypeNode(typeNode)
          ? findNonNullTypeNode(typeNode)
          : undefined;

      const innerResult = await resolveFieldTypeInternal(
        nonNullTypes[0]!,
        nonNullTypeNode,
        ctx,
      );
      return { ...innerResult, nullable };
    }

    // Members are resolved one at a time: resolution records discovered types
    // and cycle-detection state on the shared context, whose order shows up in
    // the output.
    const memberResults: TSTypeReference[] = [];
    for (const t of nonNullTypes) {
      memberResults.push(await resolveUnionMember(t, ctx));
    }

    const aliasName = (await checker.getAliasSymbolOfType(type))?.name ?? null;
    return createUnionType({ members: memberResults, nullable, aliasName });
  }

  // Array type handling
  if (await checker.isArrayType(type)) {
    const typeArgs = await checker.getTypeArguments(type as TypeReference);
    const elementType = typeArgs[0];

    let elementTypeNode: TypeNode | undefined;
    if (typeNode && isArrayTypeNode(typeNode)) {
      elementTypeNode = typeNode.elementType;
    }

    const elementResult = elementType
      ? await resolveFieldTypeInternal(elementType, elementTypeNode, ctx)
      : createPrimitiveType({ name: "unknown", nullable: false });

    return createArrayType(elementResult);
  }

  // Never type — represents an impossible value, skip this field
  // Also handles `undefined` which results from `field?: never` (never | undefined simplifies to undefined)
  if (type.flags & TypeFlags.Never || type.flags & TypeFlags.Undefined) {
    return createNeverType();
  }

  // Unknown type — represents arbitrary values, map to JSON scalar (graphql-scalars)
  if (type.flags & TypeFlags.Unknown) {
    return createScalarType({
      name: "JSON",
      scalarInfo: {
        scalarName: "JSON",
        typeName: "unknown",
        baseType: null,
        isCustom: true,
        only: null,
      },
      nullable: false,
    });
  }

  // Primitive types
  if (type.flags & TypeFlags.String) {
    return createPrimitiveType({ name: "string", nullable: false });
  }
  if (type.flags & TypeFlags.Number) {
    return createPrimitiveType({ name: "number", nullable: false });
  }
  if (type.flags & TypeFlags.Boolean || type.flags & TypeFlags.BooleanLiteral) {
    return createPrimitiveType({ name: "boolean", nullable: false });
  }
  if (type.flags & TypeFlags.StringLiteral) {
    return createStringLiteralType(
      (await checker.typeToString(type)).replace(/"/g, ""),
    );
  }
  if (type.flags & TypeFlags.NumberLiteral) {
    return createNumericLiteralType(await checker.typeToString(type));
  }
  // Template literal types (e.g., `prefix-${string}`) represent string subsets
  if (type.flags & TypeFlags.TemplateLiteral) {
    return createPrimitiveType({ name: "string", nullable: false });
  }

  // Intersection types in field context
  // GraphQL doesn't have intersection types, so we must resolve them appropriately
  if (type.isIntersectionType()) {
    // 1. If the intersection has an alias that's in knownTypeNames, use it as reference
    const aliasSymbol = await checker.getAliasSymbolOfType(type);
    if (aliasSymbol) {
      const aliasName = aliasSymbol.name;
      if (await isKnownSchemaType(aliasName, aliasSymbol, ctx)) {
        return createReferenceType({ name: aliasName, nullable: false });
      }

      // 2. Check if aliasSymbol has a globalTypeMapping (custom scalar)
      const globalMapping = globalTypeMappings.find(
        (m) => m.typeName === aliasName,
      );
      if (globalMapping) {
        return createScalarType({
          name: globalMapping.scalarName,
          scalarInfo: {
            scalarName: globalMapping.scalarName,
            typeName: globalMapping.typeName,
            baseType: null,
            isCustom: true,
            only: globalMapping.only,
          },
          nullable: false,
        });
      }
    }

    // 3. Check if this is a branded primitive type pattern
    const brandedResult = await detectBrandedType(type, checker);
    if (brandedResult.isBranded && brandedResult.baseType !== null) {
      return createPrimitiveType({
        name: brandedResult.baseType,
        nullable: false,
      });
    }

    // 4. Register in discoveredTypes if applicable (same logic as alias expansion)
    //    This handles non-exported recursive intersection types that would otherwise
    //    cause cycle detection failures in tryExtractAsInlineObject.
    if (aliasSymbol) {
      const aliasName = aliasSymbol.name;
      if (!knownTypeNames.has(aliasName)) {
        const isDiscovered = await registerDiscoveredType({
          checker: ctx.checker,
          name: aliasName,
          type,
          symbol: await resolveOriginalSymbol(aliasSymbol, checker),
          discoveredTypes: ctx.discoveredTypes,
        });
        if (isDiscovered) {
          return createReferenceType({ name: aliasName, nullable: false });
        }
      }
    }

    // 5. Otherwise, treat as inline object
    return tryExtractAsInlineObject(type, ctx, null);
  }

  // Inline object type handling
  if (await isInlineObjectType(type, checker)) {
    // Index signature types (Record<string, T>, { [key: string]: T })
    // These have no named properties, only index signatures — map to JSONObject (graphql-scalars)
    const hasStringIndex =
      (await checker.getStringIndexTypeOfType(type)) !== undefined;
    if (
      hasStringIndex &&
      (await checker.getPropertiesOfType(type)).length === 0
    ) {
      return createScalarType({
        name: "JSONObject",
        scalarInfo: {
          scalarName: "JSONObject",
          typeName: "Record",
          baseType: null,
          isCustom: true,
          only: null,
        },
        nullable: false,
      });
    }

    // Check if typeNode references a known type
    {
      const ref = await tryReferenceFromTypeNode({
        typeNode,
        ctx,
        nullable: false,
      });
      if (ref) return ref;
    }

    return tryExtractAsInlineObject(type, ctx, null);
  }

  // Mapped types (utility types like Omit, Pick, user-defined utilities)
  if (type.flags & TypeFlags.Object) {
    const objectType = type as ObjectType;
    if (objectType.objectFlags & ObjectFlags.Mapped) {
      // Index signature mapped types (Record<string, T>) — map to JSONObject (graphql-scalars)
      const hasMappedStringIndex =
        (await checker.getStringIndexTypeOfType(type)) !== undefined;
      if (
        hasMappedStringIndex &&
        (await checker.getPropertiesOfType(type)).length === 0
      ) {
        return createScalarType({
          name: "JSONObject",
          scalarInfo: {
            scalarName: "JSONObject",
            typeName: "Record",
            baseType: null,
            isCustom: true,
            only: null,
          },
          nullable: false,
        });
      }

      // Check if typeNode references a known type (schema-defined type)
      {
        const ref = await tryReferenceFromTypeNode({
          typeNode,
          ctx,
          nullable: false,
        });
        if (ref) return ref;
      }
      // Not a known type - treat as inline object
      return tryExtractAsInlineObject(type, ctx, null);
    }
  }

  // Type alias expansion: type aliases not in knownTypeNames should be expanded as inline objects
  // This handles cases like: type MyPayload = { user: User; success: boolean; }
  // where MyPayload is used as return type but not declared as a schema type
  // Only expand if the underlying type is an anonymous object literal, not a named type
  // IMPORTANT: Only expand if the name doesn't exist in schema at all.
  // If the name exists but symbols don't match, that's a shadowing case handled by later logic.
  const aliasSymbol = await checker.getAliasSymbolOfType(type);
  if (aliasSymbol) {
    const aliasName = aliasSymbol.name;
    if (!knownTypeNames.has(aliasName)) {
      // Check if this is an anonymous object type (not an interface or another named type)
      // using ObjectFlags.Anonymous for a more robust check than internal symbol names
      const isAnonymousObject =
        (type.flags & TypeFlags.Object) !== 0 &&
        ((type as ObjectType).objectFlags & ObjectFlags.Anonymous) !== 0;

      if (isAnonymousObject) {
        // Check if this type alias qualifies for transitive discovery.
        // Type aliases to object literals used as union members should be
        // discovered with their original alias name, not expanded as inline
        // objects with auto-generated names. (#202)
        const isDiscovered = await registerDiscoveredType({
          checker: ctx.checker,
          name: aliasName,
          type,
          symbol: await resolveOriginalSymbol(aliasSymbol, checker),
          discoveredTypes: ctx.discoveredTypes,
        });
        if (isDiscovered) {
          return createReferenceType({ name: aliasName, nullable: false });
        }
        // Not a known schema type and is an anonymous object - expand to generate Payload type
        return tryExtractAsInlineObject(type, ctx, null);
      }
    }
  }

  // Extract type name from typeNode first (takes precedence over type.symbol).
  // This handles cases like:
  // - `typeof def` where the type's symbol is internal (__type, __object)
  // - `Simplify<T>` where the typeNode is the declared alias name but type.symbol is the expanded type
  {
    const ref = await tryReferenceFromTypeNode({
      typeNode,
      ctx,
      nullable: false,
    });
    if (ref) return ref;
  }

  // Named type reference (symbol-based lookup)
  const symbol = await checker.getSymbolOfType(type);
  if (symbol) {
    const symbolName = symbol.name;

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
            baseType: null,
            isCustom: true,
            only: globalMapping.only,
          },
          nullable: false,
        });
      }

      // Check if it's a known type by symbol comparison
      if (await isKnownSchemaType(symbolName, symbol, ctx)) {
        return createReferenceType({ name: symbolName, nullable: false });
      }

      // Check if the symbol is the underlying type of a schema type alias
      // For `type User = ExternalUser;`, this allows `ExternalUser` to be recognized as `User`
      const resolvedSymbol = await resolveOriginalSymbol(symbol, checker);
      const schemaTypeName = ctx.underlyingSymbolToTypeName.get(
        getSymbolIdentityKey(resolvedSymbol),
      );
      if (schemaTypeName) {
        return createReferenceType({ name: schemaTypeName, nullable: false });
      }

      // If the name exists in schema but symbol doesn't match,
      // it's a different type with the same name
      if (knownTypeNames.has(symbolName)) {
        // Check if the type is declared within schema files (local shadowing)
        if (await isTypeFromSchemaFiles(symbol, ctx.sourceFiles, checker)) {
          // Local shadowing - use name matching for backwards compatibility
          return createReferenceType({ name: symbolName, nullable: false });
        }
        // Type from outside schema files - expand as inline object
        return tryExtractAsInlineObject(type, ctx, null);
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
              baseType: null,
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
        (resolvedSymbol.flags & SymbolFlags.Enum) !== 0 ||
        resolvedSymbol.declarations.some(
          (handle) => handle.kind === SyntaxKind.EnumDeclaration,
        );
      if (isEnumSymbol) {
        const externalEnumResult = await tryExtractExternalEnumAsInlineEnum(
          resolvedSymbol,
          checker,
        );
        if (externalEnumResult) {
          return createInlineEnumType({
            members: externalEnumResult.members,
            nullable: false,
            externalEnumKey: getSymbolIdentityKey(resolvedSymbol),
            externalEnumDescription: externalEnumResult.description,
            externalEnumDeprecated: externalEnumResult.deprecated,
          });
        }
      }

      // Discover extractable named types for transitive type registration
      await registerDiscoveredType({
        checker: ctx.checker,
        name: symbolName,
        type,
        symbol: resolvedSymbol,
        discoveredTypes: ctx.discoveredTypes,
      });

      // Unknown type - still return reference but it will likely cause validation error later
      return createReferenceType({ name: symbolName, nullable: false });
    }
  }

  return createReferenceType({
    name: await checker.typeToString(type),
    nullable: false,
  });
}

async function tryExtractAsInlineObject(
  type: Type,
  ctx: InternalFieldTypeContext,
  hintName: string | null,
): Promise<TSTypeReference> {
  const { visitedTypes, checker } = ctx;
  if (visitedTypes.has(type)) {
    // Prefer aliasSymbol (type alias name) over type.symbol (which may be __type for anonymous objects)
    const candidateName =
      (await checker.getAliasSymbolOfType(type))?.name ??
      (await checker.getSymbolOfType(type))?.name;
    if (
      candidateName &&
      !isInternalTypeSymbol(candidateName) &&
      (ctx.knownTypeNames.has(candidateName) ||
        ctx.discoveredTypes?.has(candidateName))
    ) {
      // Valid reference target exists in the schema
      return createReferenceType({ name: candidateName, nullable: false });
    }
    // No valid reference target — emit warning and skip field
    ctx.diagnostics.push({
      code: "CYCLE_DETECTED",
      message: "Cycle detected in type resolution; field will be skipped",
      severity: "warning",
    });
    return createNeverType();
  }

  visitedTypes.add(type);

  const inlineProperties = await extractInlineObjectPropertiesShared(
    type,
    checker,
    (propType, _checker, typeNode) =>
      resolveFieldTypeInternal(propType, typeNode, ctx),
  );

  // Allow this type to be visited again in sibling union members.
  // Cycle detection still works because real cycles are caught during the
  // recursive extractInlineObjectPropertiesShared call above (while the
  // type is still in visitedTypes). Removing it afterward prevents
  // false-positive cycle detection when TypeScript shares the same type
  // object across multiple union members (common with generic .d.ts types).
  visitedTypes.delete(type);

  // Extract type-level TSDoc from the alias symbol if present.
  // Only extract from user-defined types, not built-in TypeScript utility types
  let description: string | null = null;
  let deprecated: DeprecationInfo | null = null;
  const aliasSymbol = await checker.getAliasSymbolOfType(type);
  if (aliasSymbol) {
    const declarations = await checker.getDeclarationsOfSymbol(aliasSymbol);
    const isUserDefined =
      declarations?.some((decl) => {
        const sourceFile = decl.getSourceFile();
        return !sourceFile.isDeclarationFile;
      }) ?? false;

    if (isUserDefined) {
      const tsdocInfo = await extractTsDocFromSymbol(aliasSymbol, checker);
      description = tsdocInfo.description;
      deprecated = tsdocInfo.deprecated;
    }
  }

  return createInlineObjectType({
    properties: inlineProperties,
    description,
    deprecated,
    hintName,
  });
}

/**
 * Checks if all types are string literals and extracts them as inline enum members.
 * Returns null if any type is not a string literal.
 */
function tryExtractAsInlineEnum(
  types: ReadonlyArray<Type>,
): ReadonlyArray<InlineEnumMemberInfo> | null {
  if (types.length === 0) {
    return null;
  }

  const members: InlineEnumMemberInfo[] = [];

  for (const type of types) {
    if (!(type.flags & TypeFlags.StringLiteral)) {
      return null;
    }

    const literalType = type as StringLiteralType;
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
  /** Deprecation info from the `@deprecated` TSDoc tag on the enum type itself */
  readonly deprecated: DeprecationInfo | null;
}

/**
 * Extracts enum members from an external TypeScript enum symbol.
 * Returns the member info including TSDoc description and deprecated status,
 * as well as the enum type's own TSDoc information.
 * Returns null if the enum declaration cannot be found or has no valid members.
 */
async function tryExtractExternalEnumAsInlineEnum(
  enumSymbol: TsSymbol,
  checker: CheckerLoader,
): Promise<ExternalEnumExtractionResult | null> {
  const declarations = await checker.getDeclarationsOfSymbolOfKind(
    enumSymbol,
    SyntaxKind.EnumDeclaration,
  );
  if (!declarations || declarations.length === 0) {
    return null;
  }

  const enumDeclaration = declarations.find(isEnumDeclaration);
  if (!enumDeclaration) {
    return null;
  }

  const members: InlineEnumMemberInfo[] = [];

  for (const member of enumDeclaration.members) {
    const initializer = member.initializer;
    if (!initializer || !isStringLiteral(initializer)) {
      continue;
    }

    const value = initializer.text;
    const memberSymbol = await checker.getSymbolAtLocation(member.name);
    const tsdocInfo = memberSymbol
      ? await extractTsDocFromSymbol(memberSymbol, checker)
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
  const enumTsDoc = await extractTsDocFromSymbol(enumSymbol, checker);

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
async function isKnownSchemaType(
  name: string,
  typeSymbol: TsSymbol | undefined,
  ctx: FieldTypeResolverContext,
): Promise<boolean> {
  const { knownTypeNames, knownTypeSymbols, checker } = ctx;

  if (!knownTypeNames.has(name)) {
    return false;
  }

  const schemaSymbol = knownTypeSymbols.get(name);
  if (!schemaSymbol || !typeSymbol) {
    return false;
  }

  const resolvedTypeSymbol = await resolveOriginalSymbol(typeSymbol, checker);
  return getSymbolIdentityKey(resolvedTypeSymbol) === schemaSymbol;
}

/**
 * Checks if a type's symbol is declared within the schema source files.
 * Returns true if the type is a local definition (shadowing), false if from external files.
 */
async function isTypeFromSchemaFiles(
  symbol: TsSymbol,
  sourceFiles: ReadonlySet<string>,
  checker: CheckerLoader,
): Promise<boolean> {
  const declaration = await checker.getFirstDeclarationOfSymbol(symbol);
  if (!declaration) {
    return false;
  }

  const sourceFile = declaration.getSourceFile();
  return sourceFiles.has(sourceFile.fileName);
}
