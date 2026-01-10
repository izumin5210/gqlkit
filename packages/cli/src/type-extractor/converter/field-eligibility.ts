/**
 * Field and enum value eligibility checks for GraphQL schema generation.
 *
 * These functions determine whether a field or enum value can be included
 * in the generated GraphQL schema based on naming conventions and other rules.
 */

const GRAPHQL_NAME_PATTERN = /^[_A-Za-z][_0-9A-Za-z]*$/;

export type SkipReason =
  | { readonly code: "INVALID_NAME"; readonly message: string }
  | { readonly code: "RESERVED_NAME"; readonly message: string };

export interface EligibilityResult {
  readonly eligible: boolean;
  readonly skipReason: SkipReason | null;
}

function isValidGraphQLName(name: string): boolean {
  if (name.length === 0) return false;
  return GRAPHQL_NAME_PATTERN.test(name);
}

function isReservedName(name: string): boolean {
  return name.startsWith("__");
}

/**
 * Check if a field name is eligible to be included as a GraphQL object field.
 */
export function isEligibleAsObjectField(fieldName: string): EligibilityResult {
  if (isReservedName(fieldName)) {
    return {
      eligible: false,
      skipReason: {
        code: "RESERVED_NAME",
        message: `Field '${fieldName}' starts with '__' which is reserved for GraphQL introspection`,
      },
    };
  }

  if (!isValidGraphQLName(fieldName)) {
    return {
      eligible: false,
      skipReason: {
        code: "INVALID_NAME",
        message: `Field '${fieldName}' is not a valid GraphQL identifier (must match /^[_A-Za-z][_0-9A-Za-z]*$/)`,
      },
    };
  }

  return { eligible: true, skipReason: null };
}

/**
 * Check if a field name is eligible to be included as a GraphQL input object field.
 */
export function isEligibleAsInputObjectField(
  fieldName: string,
): EligibilityResult {
  if (isReservedName(fieldName)) {
    return {
      eligible: false,
      skipReason: {
        code: "RESERVED_NAME",
        message: `Input field '${fieldName}' starts with '__' which is reserved for GraphQL introspection`,
      },
    };
  }

  if (!isValidGraphQLName(fieldName)) {
    return {
      eligible: false,
      skipReason: {
        code: "INVALID_NAME",
        message: `Input field '${fieldName}' is not a valid GraphQL identifier (must match /^[_A-Za-z][_0-9A-Za-z]*$/)`,
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
