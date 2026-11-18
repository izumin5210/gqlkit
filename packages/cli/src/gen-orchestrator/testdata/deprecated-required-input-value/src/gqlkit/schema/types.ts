import { defineQuery } from "../gqlkit.js";

/**
 * Input type with a deprecated required field.
 * GraphQL forbids deprecating a required input field, so generation
 * must fail with a diagnostic.
 */
export interface SearchInput {
  /** @deprecated Use keyword instead. */
  query: string;
  keyword: string | null;
}

/**
 * Query with a deprecated required argument.
 * GraphQL forbids deprecating a required argument, so generation
 * must fail with a diagnostic.
 */
export const search = defineQuery<
  {
    input: SearchInput;
    /** @deprecated Use input instead. */
    legacy: string;
  },
  boolean
>(() => true);
