import { defineIsTypeOf } from "../gqlkit.js";

// Discovered named type — keeps its original name "NamedVariant"
interface NamedVariant {
  title: string;
}

/**
 * Union mixing a discovered named type and an anonymous inline object.
 * NamedVariant keeps its original name via transitive discovery.
 * The anonymous inline object gets an auto-generated name with prefix.
 * Expected: MISSING_ABSTRACT_TYPE_RESOLVER error because anonymous
 * inline objects cannot have isTypeOf defined.
 */
export type Container = {
  content: NamedVariant | { tag: string; value: number };
};

export const namedVariantIsTypeOf = defineIsTypeOf<NamedVariant>((value) => {
  return typeof value === "object" && value !== null && "title" in value;
});
