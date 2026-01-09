import {
  createGqlkitApis,
  type GqlFieldDef,
  type Int,
  type NoArgs,
} from "@gqlkit-ts/runtime";

export type PaginationInput = {
  limit: GqlFieldDef<Int, { defaultValue: 10 }>;
  offset: GqlFieldDef<Int, { defaultValue: 0 }>;
  includeArchived: GqlFieldDef<boolean, { defaultValue: false }>;
};

export type SearchInput = {
  query: string;
  caseSensitive: GqlFieldDef<boolean, { defaultValue: true }>;
  maxResults: GqlFieldDef<Int | null, { defaultValue: null }>;
};

export type GreetingInput = {
  name: GqlFieldDef<string, { defaultValue: "World" }>;
  prefix: GqlFieldDef<string, { defaultValue: "Hello" }>;
};

export type FloatInput = {
  value: GqlFieldDef<number, { defaultValue: 3.14 }>;
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
