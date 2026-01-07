/**
 * Directive metadata detector.
 *
 * This module provides functions to detect directive metadata embedded
 * in TypeScript intersection types using the $gqlkitDirectives property.
 */

import ts from "typescript";
import { getActualMetadataType } from "./metadata-detector.js";

const DIRECTIVE_METADATA_PROPERTY = " $gqlkitDirectives";
const DIRECTIVE_NAME_PROPERTY = " $directiveName";
const DIRECTIVE_ARGS_PROPERTY = " $directiveArgs";

/**
 * Represents a single directive argument value.
 */
export type DirectiveArgumentValue =
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "boolean"; readonly value: boolean }
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
function resolveArgumentValue(
  type: ts.Type,
  checker: ts.TypeChecker,
): DirectiveArgumentValue | null {
  if (type.isStringLiteral()) {
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
 * - Intersection types with " $gqlkitDirectives" property indicate directives
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
  const directivesProp = type.getProperty(DIRECTIVE_METADATA_PROPERTY);
  if (!directivesProp) {
    if (type.isIntersection()) {
      for (const member of type.types) {
        const memberProp = member.getProperty(DIRECTIVE_METADATA_PROPERTY);
        if (memberProp) {
          return detectDirectiveMetadataFromProperty(memberProp, checker);
        }
      }
    }
    return createEmptyResult();
  }

  return detectDirectiveMetadataFromProperty(directivesProp, checker);
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
 * Unwraps a WithDirectives type and returns the inner type.
 * If the type is not wrapped with WithDirectives, returns the original type.
 *
 * For WithDirectives<T, Ds>, this extracts T from the intersection T & { " $gqlkitDirectives"?: Ds }.
 * Since the original type preserves all properties, we return the original type itself
 * but mark that directives should be filtered during property enumeration.
 */
export function unwrapWithDirectivesType(
  type: ts.Type,
  _checker: ts.TypeChecker,
): ts.Type {
  return type;
}

/**
 * Checks if a type is wrapped with WithDirectives.
 */
export function hasDirectiveMetadata(type: ts.Type): boolean {
  const directivesProp = type.getProperty(DIRECTIVE_METADATA_PROPERTY);
  if (directivesProp) {
    return true;
  }

  if (type.isIntersection()) {
    for (const member of type.types) {
      const prop = member.getProperty(DIRECTIVE_METADATA_PROPERTY);
      if (prop) {
        return true;
      }
    }
  }

  return false;
}
