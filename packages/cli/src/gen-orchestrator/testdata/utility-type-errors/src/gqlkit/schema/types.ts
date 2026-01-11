import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";

type Context = unknown;

interface User {
  id: string;
  name: string;
}

const { defineQuery } = createGqlkitApis<Context>();

/**
 * Test case for index signature only type (6.2).
 * This type has only an index signature with no regular properties.
 */
type StringDictInput = {
  [key: string]: string;
};

export const dictQuery = defineQuery<StringDictInput, User | null>(() => null);

/**
 * Test case for empty object properties (6.1).
 * Omit all properties from User results in an empty object.
 */
type EmptyFromOmit = Omit<User, keyof User>;

export const emptyQuery = defineQuery<EmptyFromOmit, User | null>(() => null);

/**
 * Test case for index signature with numbered keys.
 */
type NumberDictInput = {
  [key: number]: string;
};

export const numDictQuery = defineQuery<NumberDictInput, User | null>(
  () => null,
);

/**
 * A valid query for minimal schema generation.
 */
export const validQuery = defineQuery<NoArgs, User | null>(() => null);
