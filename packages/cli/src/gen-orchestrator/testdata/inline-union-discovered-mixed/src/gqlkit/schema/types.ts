import { defineIsTypeOf } from "../gqlkit.js";

// Named type — should be discovered and registered as "NamedVariant"
interface NamedVariant {
  title: string;
}

/**
 * Union mixing a discovered named type and an anonymous inline object.
 * NamedVariant keeps its original name via transitive discovery.
 * The anonymous inline object gets an auto-generated name with prefix.
 */
export type Container = {
  content: NamedVariant | { tag: string; value: number };
};

export const namedVariantIsTypeOf = defineIsTypeOf<NamedVariant>((value) => {
  return typeof value === "object" && value !== null && "title" in value;
});
