/**
 * Directive metadata detector.
 *
 * This module provides functions to detect directive metadata embedded
 * in TypeScript intersection types using the $gqlkitFieldMeta or $gqlkitTypeMeta properties.
 */

import {
  type DirectiveArgument,
  type DirectiveArgumentValue,
  type DirectiveInfo,
  METADATA_PROPERTIES,
} from "../core/index.js";
import * as ts from "../core/typescript.js";
import type { CheckerLoader } from "./checker-loader.js";
import { getActualMetadataType } from "./metadata-detector.js";
import { findMetadataProperty, isNullOrUndefined } from "./typescript-utils.js";

const FIELD_META_PROPERTY = METADATA_PROPERTIES.FIELD_META;
const TYPE_META_PROPERTY = METADATA_PROPERTIES.TYPE_META;
const DIRECTIVE_NAME_PROPERTY = METADATA_PROPERTIES.DIRECTIVE_NAME;
const DIRECTIVE_ARGS_PROPERTY = METADATA_PROPERTIES.DIRECTIVE_ARGS;
const ORIGINAL_TYPE_PROPERTY = METADATA_PROPERTIES.ORIGINAL_TYPE;

/**
 * Gets the metadata property from a type, checking both field and type meta properties.
 */
async function getMetaProperty(
  type: ts.Type,
  checker: CheckerLoader,
): Promise<ts.Symbol | undefined> {
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
  type: ts.Type,
  checker: CheckerLoader,
): Promise<DirectiveArgumentValue | null> {
  if (type.flags & ts.TypeFlags.Null) {
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
    const typeArgs = await checker.getTypeArguments(type as ts.TypeReference);
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
    const typeArgs = await checker.getTypeArguments(type as ts.TypeReference);
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
  argsType: ts.Type,
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
  type: ts.Type,
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

  return {
    directive: { name: directiveName, args },
    errors: argErrors,
  };
}

/**
 * Detects directive metadata from a TypeScript type.
 *
 * This function analyzes TypeScript types to detect directive metadata:
 * - Intersection types with " $gqlkitFieldMeta" or " $gqlkitTypeMeta" property indicate directives
 * - Each directive has a name and optional arguments
 * - Arguments are resolved from TypeScript literal types
 *
 * @param type - The TypeScript type to analyze
 * @param checker - The TypeScript type checker
 * @returns Detection result with directives and any errors
 */
export async function detectDirectiveMetadata(
  type: ts.Type,
  checker: CheckerLoader,
): Promise<DirectiveDetectionResult> {
  // Own + intersection tiers: stop at the first metadata property found,
  // regardless of what it extracts to (matches the pre-unification behavior
  // of the inlined own/intersection checks this replaces).
  const metaProp = await findMetadataProperty({
    checker,
    type,
    propertyNames: [FIELD_META_PROPERTY, TYPE_META_PROPERTY],
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
      const result = await detectDirectiveMetadata(member, checker);
      if (result.directives.length > 0) {
        return result;
      }
    }
  }
  return createEmptyResult();
}

async function detectDirectiveMetadataFromProperty(
  directivesProp: ts.Symbol,
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
  directivesType: ts.Type,
  checker: CheckerLoader,
): Promise<DirectiveDetectionResult> {
  const directives: DirectiveInfo[] = [];
  const errors: DirectiveDetectionError[] = [];

  if (await checker.isTupleType(directivesType)) {
    const typeArgs = await checker.getTypeArguments(
      directivesType as ts.TypeReference,
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
      directivesType as ts.TypeReference,
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
  type: ts.Type,
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
 * Unwraps a GqlField or GqlObject type and returns the base type.
 * For GqlField<T, Meta> which is T & { " $gqlkitFieldMeta"?: ...; " $gqlkitOriginalType"?: T },
 * this extracts and returns T from the $gqlkitOriginalType property.
 *
 * The $gqlkitOriginalType property preserves nullability information that would otherwise
 * be lost due to TypeScript's union type normalization.
 *
 * If the type is not wrapped with GqlField or GqlObject, returns the original type.
 */
export async function unwrapDirectiveType(
  type: ts.Type,
  checker: CheckerLoader,
): Promise<ts.Type> {
  // 1. Check aliasTypeArguments first (most reliable)
  //    Get T directly from GqlField<T, Meta> or GqlObject<T, Meta>
  //    This works when the type alias hasn't been expanded by TypeScript
  //    We detect GqlField/GqlObject by checking for metadata properties, not by type name.
  if (
    (await checker.getAliasTypeArgumentsOfType(type)) &&
    (await checker.getAliasTypeArgumentsOfType(type)).length > 0
  ) {
    const metaProp = await getMetaProperty(type, checker);
    const originalTypeProp = await checker.getPropertyOfType(
      type,
      ORIGINAL_TYPE_PROPERTY,
    );
    if (metaProp || originalTypeProp) {
      return (await checker.getAliasTypeArgumentsOfType(type))[0]!;
    }
  }

  // 2. Check intersection members' aliasTypeArguments
  //    When TypeScript expands the type alias to an intersection,
  //    one of the intersection members might still have aliasTypeArguments
  if (type.isIntersectionType()) {
    for (const member of await checker.getTypesOfType(type)) {
      if (
        (await checker.getAliasTypeArgumentsOfType(member)) &&
        (await checker.getAliasTypeArgumentsOfType(member)).length > 0
      ) {
        const memberMetaProp = await getMetaProperty(member, checker);
        const memberOriginalTypeProp = await checker.getPropertyOfType(
          member,
          ORIGINAL_TYPE_PROPERTY,
        );
        if (memberMetaProp || memberOriginalTypeProp) {
          return (await checker.getAliasTypeArgumentsOfType(member))[0]!;
        }
      }
    }
  }

  // 3. Fall back to $gqlkitOriginalType property
  // This property preserves the original type information including array types.
  // The type's symbol name may be __type (internal TypeScript symbol), but that's
  // handled by the caller using checker.typeToString() for correct type name resolution.
  const originalTypeProp = await checker.getPropertyOfType(
    type,
    ORIGINAL_TYPE_PROPERTY,
  );
  if (originalTypeProp) {
    const rawOriginalType = await checker.getTypeOfSymbol(originalTypeProp);
    const originalType = await getActualMetadataType(rawOriginalType, checker);
    if (originalType) {
      return originalType;
    }
  }

  // Check intersection members for $gqlkitOriginalType
  if (type.isIntersectionType()) {
    for (const member of await checker.getTypesOfType(type)) {
      const originalProp = await checker.getPropertyOfType(
        member,
        ORIGINAL_TYPE_PROPERTY,
      );
      if (originalProp) {
        const rawOriginalType = await checker.getTypeOfSymbol(originalProp);
        const originalType = await getActualMetadataType(
          rawOriginalType,
          checker,
        );
        if (originalType) {
          return originalType;
        }
      }
    }

    // Fallback: filter out metadata members
    const nonDirectiveMembers: ts.Type[] = [];
    for (const member of await checker.getTypesOfType(type)) {
      const metaProp = await getMetaProperty(member, checker);
      const originalTypeProp = await checker.getPropertyOfType(
        member,
        ORIGINAL_TYPE_PROPERTY,
      );
      if (!metaProp && !originalTypeProp) {
        nonDirectiveMembers.push(member);
      }
    }
    if (nonDirectiveMembers.length === 1 && nonDirectiveMembers[0]) {
      return nonDirectiveMembers[0];
    }
  }

  // Handle union types: (T & Meta) | null
  // We extract the base type from the non-null member and return it.
  // Nullability is handled separately in the type-extractor.
  if (type.isUnionType()) {
    for (const member of await checker.getTypesOfType(type)) {
      // Skip null/undefined members
      if (isNullOrUndefined(member)) {
        continue;
      }
      // Recursively unwrap if this member has metadata
      const unwrapped = await unwrapDirectiveType(member, checker);
      if (unwrapped !== member) {
        return unwrapped;
      }
    }
  }

  return type;
}
