import { defineMutation, defineQuery } from "../gqlkit.js";

/**
 * Named success type with __typename field.
 * Used to test CX pattern: mixed union where all members have typename.
 */
export interface NamedSuccess {
  __typename: "NamedSuccess";
  data: string;
}

/**
 * Named error type with $typeName field.
 * Tests that named types with $typeName are also recognized.
 */
export interface NamedError {
  $typeName: "NamedError";
  message: string;
}

/**
 * CX pattern test case 1: mixed union with all members having typename.
 * - NamedSuccess: named type with __typename
 * - Inline error: inline type with __typename
 * Expected: resolveType should be auto-generated as `obj.__typename`.
 */
export const getDataWithInlineError = defineQuery<
  { id: string },
  NamedSuccess | { __typename: "InlineNotFoundError"; requestedId: string }
>((_root, args) => ({
  __typename: "NamedSuccess" as const,
  data: `Data for ${args.id}`,
}));

/**
 * CX pattern test case 2: mixed union with __typename and $typeName mixed.
 * - NamedSuccess: named type with __typename
 * - NamedError: named type with $typeName
 * - Inline type: inline type with $typeName
 * Expected: resolveType should be auto-generated as `obj.__typename ?? obj.$typeName`.
 */
export const processDataMixed = defineMutation<
  { input: string },
  | NamedSuccess
  | NamedError
  | { $typeName: "InlineValidationError"; field: string; message: string }
>((_root, args) => ({
  __typename: "NamedSuccess" as const,
  data: `Processed: ${args.input}`,
}));

/**
 * CX pattern test case 3: all members use $typeName (inline + named).
 * - NamedError: named type with $typeName
 * - Inline type: inline type with $typeName
 * Expected: resolveType should be auto-generated as `obj.$typeName`.
 */
export const validateInput = defineQuery<
  { value: string },
  NamedError | { $typeName: "InlineOkResult"; valid: boolean }
>((_root, _args) => ({
  $typeName: "InlineOkResult" as const,
  valid: true,
}));
