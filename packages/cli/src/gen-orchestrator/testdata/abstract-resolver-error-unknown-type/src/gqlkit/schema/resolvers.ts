import { defineIsTypeOf, defineResolveType } from "../gqlkit.js";

interface NonExistentUnion {
  id: string;
}

interface NonExistentObject {
  id: string;
}

export const nonExistentResolveType = defineResolveType<NonExistentUnion>(
  () => "SomeType",
);

export const nonExistentIsTypeOf = defineIsTypeOf<NonExistentObject>(
  () => true,
);
