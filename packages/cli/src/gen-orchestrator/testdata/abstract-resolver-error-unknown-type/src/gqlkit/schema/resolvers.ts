import { createGqlkitApis } from "@gqlkit-ts/runtime";

type Context = unknown;

interface NonExistentUnion {
  id: string;
}

interface NonExistentObject {
  id: string;
}

const { defineResolveType, defineIsTypeOf } = createGqlkitApis<Context>();

export const nonExistentResolveType = defineResolveType<NonExistentUnion>(
  () => "SomeType",
);

export const nonExistentIsTypeOf = defineIsTypeOf<NonExistentObject>(
  () => true,
);
