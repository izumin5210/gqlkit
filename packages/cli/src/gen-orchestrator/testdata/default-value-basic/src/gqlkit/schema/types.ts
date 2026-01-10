import {
  createGqlkitApis,
  type GqlField,
  type Int,
  type NoArgs,
} from "@gqlkit-ts/runtime";

export type PaginationInput = {
  limit: GqlField<Int, { defaultValue: 10 }>;
  offset: GqlField<Int, { defaultValue: 0 }>;
  includeArchived: GqlField<boolean, { defaultValue: false }>;
};

export type SearchInput = {
  query: string;
  caseSensitive: GqlField<boolean, { defaultValue: true }>;
  maxResults: GqlField<Int | null, { defaultValue: null }>;
};

export type GreetingInput = {
  name: GqlField<string, { defaultValue: "World" }>;
  prefix: GqlField<string, { defaultValue: "Hello" }>;
};

export type FloatInput = {
  value: GqlField<number, { defaultValue: 3.14 }>;
};

export type User = {
  id: string;
  name: string;
};

const { defineQuery } = createGqlkitApis();

export const users = defineQuery<PaginationInput, User[]>(() => []);

export const search = defineQuery<SearchInput, User[]>(() => []);

export const greet = defineQuery<GreetingInput, string>(
  (_, args) => `${args.prefix}, ${args.name}!`,
);
