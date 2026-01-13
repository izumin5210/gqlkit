import { defineIsTypeOf } from "../gqlkit.js";

export interface Dog {
  kind: string;
  name: string;
  breed: string;
}

export interface Cat {
  kind: string;
  name: string;
  indoor: boolean;
}

export type Animal = Dog | Cat;

export const dogIsTypeOf = defineIsTypeOf<Dog>((value) => {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "dog"
  );
});

export const catIsTypeOf = defineIsTypeOf<Cat>((value) => {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "cat"
  );
});
