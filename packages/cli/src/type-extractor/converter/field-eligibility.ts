/**
 * Field and enum value eligibility checks for GraphQL schema generation.
 *
 * These functions determine whether a field or enum value can be included
 * in the generated GraphQL schema based on naming conventions and other rules.
 */

import { TYPENAME_FIELD_NAMES } from "../../auto-type-generator/typename-types.js";

const GRAPHQL_NAME_PATTERN = /^[_A-Za-z][_0-9A-Za-z]*$/;

export type SkipReason =
  | { readonly code: "INVALID_NAME"; readonly message: string }
  | { readonly code: "RESERVED_NAME"; readonly message: string }
  | { readonly code: "TYPENAME_FIELD"; readonly message: string };

export type EligibilityResult =
  | { readonly eligible: true; readonly skipReason: null }
  | { readonly eligible: false; readonly skipReason: SkipReason };

function isValidGraphQLName(name: string): boolean {
  if (name.length === 0) return false;
  return GRAPHQL_NAME_PATTERN.test(name);
}

function isReservedName(name: string): boolean {
  return name.startsWith("__");
}

export type FieldEligibilityKind = "object" | "input";

export interface IsEligibleFieldParams {
  readonly fieldName: string;
  readonly kind: FieldEligibilityKind;
}

/**
 * Check if a field name is eligible to be included as a GraphQL field.
 * Uses the kind parameter to determine the error message prefix.
 */
export function isEligibleField(
  params: IsEligibleFieldParams,
): EligibilityResult {
  const { fieldName, kind } = params;
  const prefix = kind === "input" ? "Input field" : "Field";

  // Typename discrimination fields are intentionally excluded from the schema
  if ((TYPENAME_FIELD_NAMES as readonly string[]).includes(fieldName)) {
    return {
      eligible: false,
      skipReason: {
        code: "TYPENAME_FIELD",
        message: `${prefix} '${fieldName}' is a typename discrimination field used by gqlkit for union type resolution`,
      },
    };
  }

  if (isReservedName(fieldName)) {
    return {
      eligible: false,
      skipReason: {
        code: "RESERVED_NAME",
        message: `${prefix} '${fieldName}' starts with '__' which is reserved for GraphQL introspection`,
      },
    };
  }

  if (!isValidGraphQLName(fieldName)) {
    return {
      eligible: false,
      skipReason: {
        code: "INVALID_NAME",
        message: `${prefix} '${fieldName}' is not a valid GraphQL identifier (must match /^[_A-Za-z][_0-9A-Za-z]*$/)`,
      },
    };
  }

  return { eligible: true, skipReason: null };
}

/**
 * Check if an enum value name is eligible to be included as a GraphQL enum value.
 * Note: The name should be the converted (SCREAMING_SNAKE_CASE) name, not the original.
 */
export function isEligibleAsEnumValue(
  convertedName: string,
  originalName: string,
): EligibilityResult {
  if (isReservedName(convertedName)) {
    return {
      eligible: false,
      skipReason: {
        code: "RESERVED_NAME",
        message: `Enum member '${originalName}' converts to '${convertedName}' which starts with '__' (reserved for GraphQL introspection)`,
      },
    };
  }

  if (!isValidGraphQLName(convertedName)) {
    return {
      eligible: false,
      skipReason: {
        code: "INVALID_NAME",
        message: `Enum member '${originalName}' converts to '${convertedName}' which is not a valid GraphQL identifier`,
      },
    };
  }

  return { eligible: true, skipReason: null };
}
