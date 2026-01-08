/**
 * Directive metadata detector.
 *
 * This module provides functions to detect directive metadata embedded
 * in TypeScript intersection types using the $gqlkitFieldMeta or $gqlkitTypeMeta properties.
 */

import ts from "typescript";
import { getActualMetadataType } from "./metadata-detector.js";

const FIELD_META_PROPERTY = " $gqlkitFieldMeta";
const TYPE_META_PROPERTY = " $gqlkitTypeMeta";
const DIRECTIVE_NAME_PROPERTY = " $directiveName";
const DIRECTIVE_ARGS_PROPERTY = " $directiveArgs";
const ORIGINAL_TYPE_PROPERTY = " $gqlkitOriginalType";

/**
 * Gets the metadata property from a type, checking both field and type meta properties.
 */
function getMetaProperty(type: ts.Type): ts.Symbol | undefined {
  return (
    type.getProperty(FIELD_META_PROPERTY) ??
    type.getProperty(TYPE_META_PROPERTY)
  );
}

/**
 * Represents a single directive argument value.
 */
export type DirectiveArgumentValue =
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "null"; readonly value: null }
  | { readonly kind: "enum"; readonly value: string }
  | {
      readonly kind: "list";
      readonly values: ReadonlyArray<DirectiveArgumentValue>;
    }
  | {
      readonly kind: "object";
      readonly fields: ReadonlyArray<DirectiveArgument>;
    };

/**
 * Represents a directive argument (name-value pair).
 */
export interface DirectiveArgument {
  readonly name: string;
  readonly value: DirectiveArgumentValue;
}

/**
 * Represents a detected directive with its name and arguments.
 */
export interface DirectiveInfo {
  readonly name: string;
  readonly args: ReadonlyArray<DirectiveArgument>;
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
export function resolveArgumentValue(
  type: ts.Type,
  checker: ts.TypeChecker,
): DirectiveArgumentValue | null {
  if (type.flags & ts.TypeFlags.Null) {
    return { kind: "null", value: null };
  }

  if (type.isStringLiteral()) {
    // Check enum pattern: starts with uppercase and contains only uppercase letters, digits, and underscores
    if (/^[A-Z][A-Z0-9_]*$/.test(type.value)) {
      return { kind: "enum", value: type.value };
    }
    return { kind: "string", value: type.value };
  }

  if (type.isNumberLiteral()) {
    return { kind: "number", value: type.value };
  }

  if (type.flags & ts.TypeFlags.BooleanLiteral) {
    const intrinsicName = (type as unknown as { intrinsicName?: string })
      .intrinsicName;
    if (intrinsicName === "true") {
      return { kind: "boolean", value: true };
    }
    if (intrinsicName === "false") {
      return { kind: "boolean", value: false };
    }
  }

  if (checker.isTupleType(type)) {
    const typeArgs = checker.getTypeArguments(type as ts.TypeReference);
    const values: DirectiveArgumentValue[] = [];
    for (const arg of typeArgs) {
      const resolved = resolveArgumentValue(arg, checker);
      if (resolved) {
        values.push(resolved);
      }
    }
    return { kind: "list", values };
  }

  if (checker.isArrayType(type)) {
    const typeArgs = checker.getTypeArguments(type as ts.TypeReference);
    if (typeArgs.length > 0 && typeArgs[0]) {
      const elemType = typeArgs[0];
      if (elemType.isUnion()) {
        const values: DirectiveArgumentValue[] = [];
        for (const member of elemType.types) {
          const resolved = resolveArgumentValue(member, checker);
          if (resolved) {
            values.push(resolved);
          }
        }
        return { kind: "list", values };
      }
    }
  }

  const properties = type.getProperties();
  if (properties.length > 0) {
    const isMetadataProperty = properties.some(
      (p) =>
        p.getName().startsWith(" $") ||
        p.getName() === DIRECTIVE_NAME_PROPERTY ||
        p.getName() === DIRECTIVE_ARGS_PROPERTY,
    );

    if (!isMetadataProperty) {
      const fields: DirectiveArgument[] = [];
      for (const prop of properties) {
        const propType = checker.getTypeOfSymbol(prop);
        const resolved = resolveArgumentValue(propType, checker);
        if (resolved) {
          fields.push({ name: prop.getName(), value: resolved });
        }
      }
      if (fields.length > 0) {
        return { kind: "object", fields };
      }
    }
  }

  const symbol = type.getSymbol();
  if (symbol) {
    const name = symbol.getName();
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
function extractDirectiveArgs(
  argsType: ts.Type,
  checker: ts.TypeChecker,
  directiveName: string,
): ExtractDirectiveArgsResult {
  const args: DirectiveArgument[] = [];
  const errors: DirectiveDetectionError[] = [];
  const properties = argsType.getProperties();

  for (const prop of properties) {
    const propName = prop.getName();
    const propType = checker.getTypeOfSymbol(prop);
    const resolved = resolveArgumentValue(propType, checker);
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
function extractDirectiveFromType(
  type: ts.Type,
  checker: ts.TypeChecker,
): { directive: DirectiveInfo | null; errors: DirectiveDetectionError[] } {
  const nameProp = type.getProperty(DIRECTIVE_NAME_PROPERTY);
  if (!nameProp) {
    return { directive: null, errors: [] };
  }

  const rawNameType = checker.getTypeOfSymbol(nameProp);
  const nameType = getActualMetadataType(rawNameType);
  if (!nameType || !nameType.isStringLiteral()) {
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

  const argsProp = type.getProperty(DIRECTIVE_ARGS_PROPERTY);
  let args: DirectiveArgument[] = [];
  let argErrors: DirectiveDetectionError[] = [];

  if (argsProp) {
    const rawArgsType = checker.getTypeOfSymbol(argsProp);
    const argsType = getActualMetadataType(rawArgsType);
    if (argsType) {
      const argsResult = extractDirectiveArgs(argsType, checker, directiveName);
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
export function detectDirectiveMetadata(
  type: ts.Type,
  checker: ts.TypeChecker,
): DirectiveDetectionResult {
  const metaProp = getMetaProperty(type);
  if (!metaProp) {
    if (type.isIntersection()) {
      for (const member of type.types) {
        const memberProp = getMetaProperty(member);
        if (memberProp) {
          return detectDirectiveMetadataFromProperty(memberProp, checker);
        }
      }
    }
    // Handle union types: (T & Directive) | null
    if (type.isUnion()) {
      for (const member of type.types) {
        // Skip null/undefined members
        if (
          member.flags & ts.TypeFlags.Null ||
          member.flags & ts.TypeFlags.Undefined
        ) {
          continue;
        }
        const result = detectDirectiveMetadata(member, checker);
        if (result.directives.length > 0) {
          return result;
        }
      }
    }
    return createEmptyResult();
  }

  return detectDirectiveMetadataFromProperty(metaProp, checker);
}

function detectDirectiveMetadataFromProperty(
  directivesProp: ts.Symbol,
  checker: ts.TypeChecker,
): DirectiveDetectionResult {
  const rawDirectivesType = checker.getTypeOfSymbol(directivesProp);
  const directivesType = getActualMetadataType(rawDirectivesType);

  if (!directivesType) {
    return createEmptyResult();
  }

  // New structure: { directives: Ds }
  // Check if the type has a "directives" property
  const directivesArrayProp = directivesType.getProperty("directives");
  if (directivesArrayProp) {
    const rawDirectivesArrayType = checker.getTypeOfSymbol(directivesArrayProp);
    const directivesArrayType = getActualMetadataType(rawDirectivesArrayType);
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
export function extractDirectivesFromType(
  directivesType: ts.Type,
  checker: ts.TypeChecker,
): DirectiveDetectionResult {
  const directives: DirectiveInfo[] = [];
  const errors: DirectiveDetectionError[] = [];

  if (checker.isTupleType(directivesType)) {
    const typeArgs = checker.getTypeArguments(
      directivesType as ts.TypeReference,
    );
    for (const arg of typeArgs) {
      const result = extractDirectiveFromType(arg, checker);
      if (result.directive) {
        directives.push(result.directive);
      }
      errors.push(...result.errors);
    }
  } else if (checker.isArrayType(directivesType)) {
    const typeArgs = checker.getTypeArguments(
      directivesType as ts.TypeReference,
    );
    if (typeArgs.length > 0 && typeArgs[0]) {
      const elemType = typeArgs[0];
      if (elemType.isUnion()) {
        for (const member of elemType.types) {
          const result = extractDirectiveFromType(member, checker);
          if (result.directive) {
            directives.push(result.directive);
          }
          errors.push(...result.errors);
        }
      } else {
        const result = extractDirectiveFromType(elemType, checker);
        if (result.directive) {
          directives.push(result.directive);
        }
        errors.push(...result.errors);
      }
    }
  } else {
    const result = extractDirectiveFromType(directivesType, checker);
    if (result.directive) {
      directives.push(result.directive);
    }
    errors.push(...result.errors);
  }

  return { directives, errors };
}

/**
 * Checks if a type is wrapped with GqlFieldDef or GqlTypeDef.
 */
export function hasDirectiveMetadata(type: ts.Type): boolean {
  const metaProp = getMetaProperty(type);
  if (metaProp) {
    return true;
  }

  // Also check for the original type property (GqlFieldDef marker)
  const originalTypeProp = type.getProperty(ORIGINAL_TYPE_PROPERTY);
  if (originalTypeProp) {
    return true;
  }

  if (type.isIntersection()) {
    for (const member of type.types) {
      const prop = getMetaProperty(member);
      if (prop) {
        return true;
      }
      // Also check for original type property in intersection members
      const origProp = member.getProperty(ORIGINAL_TYPE_PROPERTY);
      if (origProp) {
        return true;
      }
    }
  }

  // Handle union types: (T & Meta) | null is normalized by TypeScript
  // to (T & Meta) | null, so we need to check each member recursively
  if (type.isUnion()) {
    for (const member of type.types) {
      if (hasDirectiveMetadata(member)) {
        return true;
      }
    }
  }

  // Check for GqlFieldDef type alias by examining the alias symbol
  if (type.aliasSymbol) {
    const aliasName = type.aliasSymbol.getName();
    if (aliasName === "GqlFieldDef" || aliasName === "GqlTypeDef") {
      return true;
    }
  }

  return false;
}

/**
 * Unwraps a GqlFieldDef or GqlTypeDef type and returns the base type.
 * For GqlFieldDef<T, Meta> which is T & { " $gqlkitFieldMeta"?: ...; " $gqlkitOriginalType"?: T },
 * this extracts and returns T from the $gqlkitOriginalType property.
 *
 * The $gqlkitOriginalType property preserves nullability information that would otherwise
 * be lost due to TypeScript's union type normalization.
 *
 * If the type is not wrapped with GqlFieldDef or GqlTypeDef, returns the original type.
 */
export function unwrapDirectiveType(
  type: ts.Type,
  checker: ts.TypeChecker,
): ts.Type {
  // First, try to get the original type from $gqlkitOriginalType property
  const originalTypeProp = type.getProperty(ORIGINAL_TYPE_PROPERTY);
  if (originalTypeProp) {
    const rawOriginalType = checker.getTypeOfSymbol(originalTypeProp);
    const originalType = getActualMetadataType(rawOriginalType);
    if (originalType) {
      return originalType;
    }
  }

  // Check intersection members for $gqlkitOriginalType
  if (type.isIntersection()) {
    for (const member of type.types) {
      const originalProp = member.getProperty(ORIGINAL_TYPE_PROPERTY);
      if (originalProp) {
        const rawOriginalType = checker.getTypeOfSymbol(originalProp);
        const originalType = getActualMetadataType(rawOriginalType);
        if (originalType) {
          return originalType;
        }
      }
    }

    // Fallback: filter out metadata members
    const nonDirectiveMembers: ts.Type[] = [];
    for (const member of type.types) {
      const metaProp = getMetaProperty(member);
      const originalTypeProp = member.getProperty(ORIGINAL_TYPE_PROPERTY);
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
  if (type.isUnion()) {
    for (const member of type.types) {
      // Skip null/undefined members
      if (
        member.flags & ts.TypeFlags.Null ||
        member.flags & ts.TypeFlags.Undefined
      ) {
        continue;
      }
      // Recursively unwrap if this member has metadata
      const unwrapped = unwrapDirectiveType(member, checker);
      if (unwrapped !== member) {
        return unwrapped;
      }
    }
  }

  // Handle GqlFieldDef type alias detected via type string
  // This handles cases where TypeScript doesn't expose the intersection structure
  // but the type string shows it's a GqlFieldDef type
  const typeString = checker.typeToString(type);
  if (typeString.startsWith("GqlFieldDef<")) {
    // Try to extract the first type argument (the base type)
    // Pattern: GqlFieldDef<T, Meta> where T is the base type
    if (type.aliasTypeArguments && type.aliasTypeArguments.length > 0) {
      return type.aliasTypeArguments[0]!;
    }
  }

  return type;
}
