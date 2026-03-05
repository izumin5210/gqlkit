import { defineIsTypeOf } from "../gqlkit.js";

// Inner is referenced by Outer but is itself not exported or known.
// It should be transitively discovered when Outer is discovered.
interface Inner {
  detail: string;
}

// Outer references Inner - both should be discovered.
interface Outer {
  name: string;
  nested: Inner;
}

interface Simple {
  tag: string;
}

/**
 * Tests transitive type discovery chain.
 * Outer is discovered as a union member, and Inner is discovered
 * transitively because Outer references it.
 */
export type Wrapper = {
  content: Outer | Simple;
};

export const outerIsTypeOf = defineIsTypeOf<Outer>((value) => {
  return typeof value === "object" && value !== null && "name" in value;
});

export const simpleIsTypeOf = defineIsTypeOf<Simple>((value) => {
  return typeof value === "object" && value !== null && "tag" in value;
});
