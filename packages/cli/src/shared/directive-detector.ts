/**
 * Directive metadata detector.
 *
 * This module provides functions to detect directive metadata embedded
 * in TypeScript intersection types using the $gqlkitFieldMeta or $gqlkitTypeMeta properties.
 */

import {
  type Symbol as TsSymbol,
  type Type,
  TypeFlags,
  type TypeReference,
} from "typescript/async";
import {
  type DirectiveArgument,
  type DirectiveArgumentValue,
  type DirectiveInfo,
  type FederationDirectiveKind,
  isFederationDirectiveKind,
  METADATA_PROPERTIES,
} from "../core/index.js";
import type { CheckerLoader } from "./checker-loader.js";
import { getActualMetadataType } from "./metadata-detector.js";
import { findMetadataProperty, isNullOrUndefined } from "./typescript-utils.js";

const FIELD_META_PROPERTY = METADATA_PROPERTIES.FIELD_META;
const TYPE_META_PROPERTY = METADATA_PROPERTIES.TYPE_META;
const DIRECTIVE_NAME_PROPERTY = METADATA_PROPERTIES.DIRECTIVE_NAME;
const DIRECTIVE_ARGS_PROPERTY = METADATA_PROPERTIES.DIRECTIVE_ARGS;
const ORIGINAL_TYPE_PROPERTY = METADATA_PROPERTIES.ORIGINAL_TYPE;
const FEDERATION_DIRECTIVE_PROPERTY = METADATA_PROPERTIES.FEDERATION_DIRECTIVE;

/**
 * Reads which federation directive a directive type stands for, from the
 * marker that `@gqlkit-ts/runtime/federation` puts on its directive types.
 */
export async function detectFederationDirectiveKind(
  type: Type,
  checker: CheckerLoader,
): Promise<FederationDirectiveKind | null> {
  const markerProp = await checker.getPropertyOfType(
    type,
    FEDERATION_DIRECTIVE_PROPERTY,
  );
  if (!markerProp) {
    return null;
  }
  const markerType = await checker.getTypeOfSymbol(markerProp);
  if (
    markerType.isStringLiteralType() &&
    isFederationDirectiveKind(markerType.value)
  ) {
    return markerType.value;
  }
  return null;
}

/**
 * Gets the metadata property from a type, checking both field and type meta properties.
 */
async function getMetaProperty(
  type: Type,
  checker: CheckerLoader,
): Promise<TsSymbol | undefined> {
  return (
    (await checker.getPropertyOfType(type, FIELD_META_PROPERTY)) ??
    (await checker.getPropertyOfType(type, TYPE_META_PROPERTY))
  );
}

/**
 * Error codes for directive detection.
 */
export type DirectiveDetectionErrorCode =
  | "EMPTY_DIRECTIVE_NAME"
  | "UNRESOLVABLE_ARGUMENT";

/**
 * Error information for directive detection.
 */
export interface DirectiveDetectionError {
  readonly code: DirectiveDetectionErrorCode;
  readonly message: string;
}

/**
 * Result of directive detection.
 */
export interface DirectiveDetectionResult {
  readonly directives: ReadonlyArray<DirectiveInfo>;
  readonly errors: ReadonlyArray<DirectiveDetectionError>;
}

function createEmptyResult(): DirectiveDetectionResult {
  return {
    directives: [],
    errors: [],
  };
}

/**
 * Resolves a directive argument value from a TypeScript type.
 */
export async function resolveArgumentValue(
  type: Type,
  checker: CheckerLoader,
): Promise<DirectiveArgumentValue | null> {
  if (type.flags & TypeFlags.Null) {
    return { kind: "null", value: null };
  }

  if (type.isStringLiteralType()) {
    // Check enum pattern: starts with uppercase and contains only uppercase letters, digits, and underscores
    if (/^[A-Z][A-Z0-9_]*$/.test(type.value)) {
      return { kind: "enum", value: type.value };
    }
    return { kind: "string", value: type.value };
  }

  if (type.isNumberLiteralType()) {
    return { kind: "number", value: type.value };
  }

  if (type.isBooleanLiteralType()) {
    return { kind: "boolean", value: type.value };
  }

  if (await checker.isTupleType(type)) {
    const typeArgs = await checker.getTypeArguments(type as TypeReference);
    const values: DirectiveArgumentValue[] = [];
    for (const arg of typeArgs) {
      const resolved = await resolveArgumentValue(arg, checker);
      if (resolved) {
        values.push(resolved);
      }
    }
    return { kind: "list", values };
  }

  if (await checker.isArrayType(type)) {
    const typeArgs = await checker.getTypeArguments(type as TypeReference);
    if (typeArgs.length > 0 && typeArgs[0]) {
      const elemType = typeArgs[0];
      if (elemType.isUnionType()) {
        const values: DirectiveArgumentValue[] = [];
        for (const member of await checker.getTypesOfType(elemType)) {
          const resolved = await resolveArgumentValue(member, checker);
          if (resolved) {
            values.push(resolved);
          }
        }
        return { kind: "list", values };
      }
    }
  }

  const properties = await checker.getPropertiesOfType(type);
  if (properties.length > 0) {
    const isMetadataProperty = properties.some(
      (p) =>
        p.name.startsWith(" $") ||
        p.name === DIRECTIVE_NAME_PROPERTY ||
        p.name === DIRECTIVE_ARGS_PROPERTY,
    );

    if (!isMetadataProperty) {
      const fields: DirectiveArgument[] = [];
      for (const prop of properties) {
        const propType = await checker.getTypeOfSymbol(prop);
        const resolved = await resolveArgumentValue(propType, checker);
        if (resolved) {
          fields.push({ name: prop.name, value: resolved });
        }
      }
      if (fields.length > 0) {
        return { kind: "object", fields };
      }
    }
  }

  const symbol = await checker.getSymbolOfType(type);
  if (symbol) {
    const name = symbol.name;
    if (
      name !== "__type" &&
      name !== "Array" &&
      !name.includes("<") &&
      /^[A-Z][A-Z0-9_]*$/.test(name)
    ) {
      return { kind: "enum", value: name };
    }
  }

  return null;
}

interface ExtractDirectiveArgsResult {
  readonly args: DirectiveArgument[];
  readonly errors: DirectiveDetectionError[];
}

/**
 * Extracts directive arguments from a type.
 */
async function extractDirectiveArgs(
  argsType: Type,
  checker: CheckerLoader,
  directiveName: string,
): Promise<ExtractDirectiveArgsResult> {
  const args: DirectiveArgument[] = [];
  const errors: DirectiveDetectionError[] = [];
  const properties = await checker.getPropertiesOfType(argsType);

  for (const prop of properties) {
    const propName = prop.name;
    const propType = await checker.getTypeOfSymbol(prop);
    const resolved = await resolveArgumentValue(propType, checker);
    if (resolved) {
      args.push({ name: propName, value: resolved });
    } else {
      errors.push({
        code: "UNRESOLVABLE_ARGUMENT",
        message: `Cannot resolve argument '${propName}' for directive '@${directiveName}'`,
      });
    }
  }

  return { args, errors };
}

/**
 * Extracts a single directive from a type.
 */
async function extractDirectiveFromType(
  type: Type,
  checker: CheckerLoader,
): Promise<{
  directive: DirectiveInfo | null;
  errors: DirectiveDetectionError[];
}> {
  const nameProp = await checker.getPropertyOfType(
    type,
    DIRECTIVE_NAME_PROPERTY,
  );
  if (!nameProp) {
    return { directive: null, errors: [] };
  }

  const rawNameType = await checker.getTypeOfSymbol(nameProp);
  const nameType = await getActualMetadataType(rawNameType, checker);
  if (!nameType?.isStringLiteralType()) {
    return { directive: null, errors: [] };
  }

  const directiveName = nameType.value;

  if (directiveName === "") {
    return {
      directive: null,
      errors: [
        {
          code: "EMPTY_DIRECTIVE_NAME",
          message: "Directive name cannot be empty",
        },
      ],
    };
  }

  const argsProp = await checker.getPropertyOfType(
    type,
    DIRECTIVE_ARGS_PROPERTY,
  );
  let args: DirectiveArgument[] = [];
  let argErrors: DirectiveDetectionError[] = [];

  if (argsProp) {
    const rawArgsType = await checker.getTypeOfSymbol(argsProp);
    const argsType = await getActualMetadataType(rawArgsType, checker);
    if (argsType) {
      const argsResult = await extractDirectiveArgs(
        argsType,
        checker,
        directiveName,
      );
      args = argsResult.args;
      argErrors = argsResult.errors;
    }
  }

  const federation = await detectFederationDirectiveKind(type, checker);

  return {
    directive: { name: directiveName, args, federation },
    errors: argErrors,
  };
}

async function detectDirectiveMetadataOn(
  type: Type,
  checker: CheckerLoader,
  propertyNames: ReadonlyArray<string>,
): Promise<DirectiveDetectionResult> {
  // Own + intersection tiers: stop at the first metadata property found,
  // regardless of what it extracts to (matches the pre-unification behavior
  // of the inlined own/intersection checks this replaces).
  const metaProp = await findMetadataProperty({
    checker,
    type,
    propertyNames,
    recurseUnion: false,
  });
  if (metaProp) {
    return detectDirectiveMetadataFromProperty(metaProp, checker);
  }

  // Handle union types: (T & Directive) | null
  // Unlike the tiers above, a union member's metadata property can
  // legitimately extract to zero directives; we keep trying subsequent
  // members in that case instead of stopping at the first property found,
  // so this tier is intentionally not delegated to findMetadataProperty.
  if (type.isUnionType()) {
    for (const member of await checker.getTypesOfType(type)) {
      if (isNullOrUndefined(member)) {
        continue;
      }
      const result = await detectDirectiveMetadataOn(
        member,
        checker,
        propertyNames,
      );
      if (result.directives.length > 0) {
        return result;
      }
    }
  }
  return createEmptyResult();
}

/**
 * Detects the directives of a type declaration: those of `GqlObject` (or of
 * `GqlField` when the declaration itself is one).
 *
 * @param type - The TypeScript type to analyze
 * @param checker - The TypeScript type checker
 * @returns Detection result with directives and any errors
 */
export async function detectDirectiveMetadata(
  type: Type,
  checker: CheckerLoader,
): Promise<DirectiveDetectionResult> {
  return detectDirectiveMetadataOn(type, checker, [
    FIELD_META_PROPERTY,
    TYPE_META_PROPERTY,
  ]);
}

/**
 * Detects the directives of a field from its own `GqlField`. A field whose
 * type is a `GqlObject` does not take that type's directives.
 */
export async function detectFieldDirectiveMetadata(
  type: Type,
  checker: CheckerLoader,
): Promise<DirectiveDetectionResult> {
  return detectDirectiveMetadataOn(type, checker, [FIELD_META_PROPERTY]);
}

/**
 * Checks whether a field type is wrapped with `GqlField`. A `GqlObject`
 * type carries metadata as well, but it is the field's type, not a wrapper
 * to unwrap.
 */
export async function hasFieldMetadata(
  type: Type,
  checker: CheckerLoader,
): Promise<boolean> {
  const metaProp = await findMetadataProperty({
    checker,
    type,
    propertyNames: [FIELD_META_PROPERTY],
    recurseUnion: true,
  });
  return metaProp !== undefined;
}

async function detectDirectiveMetadataFromProperty(
  directivesProp: TsSymbol,
  checker: CheckerLoader,
): Promise<DirectiveDetectionResult> {
  const rawDirectivesType = await checker.getTypeOfSymbol(directivesProp);
  const directivesType = await getActualMetadataType(
    rawDirectivesType,
    checker,
  );

  if (!directivesType) {
    return createEmptyResult();
  }

  // New structure: { directives: Ds }
  // Check if the type has a "directives" property
  const directivesArrayProp = await checker.getPropertyOfType(
    directivesType,
    "directives",
  );
  if (directivesArrayProp) {
    const rawDirectivesArrayType =
      await checker.getTypeOfSymbol(directivesArrayProp);
    const directivesArrayType = await getActualMetadataType(
      rawDirectivesArrayType,
      checker,
    );
    if (directivesArrayType) {
      return extractDirectivesFromType(directivesArrayType, checker);
    }
  }

  // Fallback: Old structure - direct array/tuple form (for backward compatibility)
  return extractDirectivesFromType(directivesType, checker);
}

/**
 * Extracts directives from a tuple or array type.
 * Use this to extract directives from a type like [AuthDirective, CacheDirective].
 */
export async function extractDirectivesFromType(
  directivesType: Type,
  checker: CheckerLoader,
): Promise<DirectiveDetectionResult> {
  const directives: DirectiveInfo[] = [];
  const errors: DirectiveDetectionError[] = [];

  if (await checker.isTupleType(directivesType)) {
    const typeArgs = await checker.getTypeArguments(
      directivesType as TypeReference,
    );
    for (const arg of typeArgs) {
      const result = await extractDirectiveFromType(arg, checker);
      if (result.directive) {
        directives.push(result.directive);
      }
      errors.push(...result.errors);
    }
  } else if (await checker.isArrayType(directivesType)) {
    const typeArgs = await checker.getTypeArguments(
      directivesType as TypeReference,
    );
    if (typeArgs.length > 0 && typeArgs[0]) {
      const elemType = typeArgs[0];
      if (elemType.isUnionType()) {
        for (const member of await checker.getTypesOfType(elemType)) {
          const result = await extractDirectiveFromType(member, checker);
          if (result.directive) {
            directives.push(result.directive);
          }
          errors.push(...result.errors);
        }
      } else {
        const result = await extractDirectiveFromType(elemType, checker);
        if (result.directive) {
          directives.push(result.directive);
        }
        errors.push(...result.errors);
      }
    }
  } else {
    const result = await extractDirectiveFromType(directivesType, checker);
    if (result.directive) {
      directives.push(result.directive);
    }
    errors.push(...result.errors);
  }

  return { directives, errors };
}

/**
 * Checks if a type is wrapped with GqlField or GqlObject.
 */
export async function hasDirectiveMetadata(
  type: Type,
  checker: CheckerLoader,
): Promise<boolean> {
  const metaProp = await getMetaProperty(type, checker);
  if (metaProp) {
    return true;
  }

  // Also check for the original type property (GqlField marker)
  const originalTypeProp = await checker.getPropertyOfType(
    type,
    ORIGINAL_TYPE_PROPERTY,
  );
  if (originalTypeProp) {
    return true;
  }

  if (type.isIntersectionType()) {
    for (const member of await checker.getTypesOfType(type)) {
      const prop = await getMetaProperty(member, checker);
      if (prop) {
        return true;
      }
      // Also check for original type property in intersection members
      const origProp = await checker.getPropertyOfType(
        member,
        ORIGINAL_TYPE_PROPERTY,
      );
      if (origProp) {
        return true;
      }
    }
  }

  // Handle union types: (T & Meta) | null is normalized by TypeScript
  // to (T & Meta) | null, so we need to check each member recursively
  if (type.isUnionType()) {
    for (const member of await checker.getTypesOfType(type)) {
      if (await hasDirectiveMetadata(member, checker)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Reads `T` from the `$gqlkitOriginalType` of a `GqlField` marker, which
 * keeps the nullability that TypeScript drops when it normalizes
 * `(T | null) & Marker` to `(T & Marker) | null`.
 */
async function readFieldOriginalType(
  marker: Type,
  checker: CheckerLoader,
): Promise<Type | null> {
  const originalTypeProp = await checker.getPropertyOfType(
    marker,
    ORIGINAL_TYPE_PROPERTY,
  );
  if (!originalTypeProp) {
    return null;
  }
  const rawOriginalType = await checker.getTypeOfSymbol(originalTypeProp);
  return (await getActualMetadataType(rawOriginalType, checker)) ?? null;
}

async function hasOwnFieldMeta(
  type: Type,
  checker: CheckerLoader,
): Promise<boolean> {
  return (
    (await checker.getPropertyOfType(type, FIELD_META_PROPERTY)) !== undefined
  );
}

/**
 * Unwraps a `GqlField<T, Meta>` field type and returns `T`.
 *
 * Only the `GqlField` wrapper is removed. A `GqlObject` type carries an
 * original type as well, but there it is the field's type and must keep its
 * name, so its markers are never mistaken for the `GqlField` ones.
 *
 * If the type is not wrapped with GqlField, returns the original type.
 */
export async function unwrapDirectiveType(
  type: Type,
  checker: CheckerLoader,
): Promise<Type> {
  // 1. The GqlField alias itself: its first type argument is T.
  const aliasArgs = await checker.getAliasTypeArgumentsOfType(type);
  if (
    aliasArgs &&
    aliasArgs.length > 0 &&
    (await hasOwnFieldMeta(type, checker))
  ) {
    return aliasArgs[0]!;
  }

  if (type.isIntersectionType()) {
    const members = await checker.getTypesOfType(type);

    // 2. A member that is still the GqlField alias.
    for (const member of members) {
      const memberAliasArgs = await checker.getAliasTypeArgumentsOfType(member);
      if (
        memberAliasArgs &&
        memberAliasArgs.length > 0 &&
        (await hasOwnFieldMeta(member, checker))
      ) {
        return memberAliasArgs[0]!;
      }
    }

    // 3. The GqlField marker member, whose original type is T. Other
    //    members may be the markers of a GqlObject T, whose original type
    //    is T's unnamed object shape instead.
    for (const member of members) {
      if (await hasOwnFieldMeta(member, checker)) {
        const originalType = await readFieldOriginalType(member, checker);
        if (originalType) {
          return originalType;
        }
      }
    }

    // 4. Fallback: the only member that is not the GqlField marker.
    const nonMarkerMembers: Type[] = [];
    for (const member of members) {
      if (!(await hasOwnFieldMeta(member, checker))) {
        nonMarkerMembers.push(member);
      }
    }
    if (nonMarkerMembers.length === 1 && nonMarkerMembers[0]) {
      return nonMarkerMembers[0];
    }
  } else if (await hasOwnFieldMeta(type, checker)) {
    const originalType = await readFieldOriginalType(type, checker);
    if (originalType) {
      return originalType;
    }
  }

  // Handle union types: (T & Meta) | null
  // We extract the base type from the non-null member and return it.
  // Nullability is handled separately in the type-extractor.
  if (type.isUnionType()) {
    for (const member of await checker.getTypesOfType(type)) {
      if (isNullOrUndefined(member)) {
        continue;
      }
      const unwrapped = await unwrapDirectiveType(member, checker);
      if (unwrapped !== member) {
        return unwrapped;
      }
    }
  }

  return type;
}
