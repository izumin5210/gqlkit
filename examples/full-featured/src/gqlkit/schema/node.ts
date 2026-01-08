import type { DefineInterface, IDString } from "@gqlkit-ts/runtime";
import { defineField, defineQuery, type NoArgs } from "./gqlkit.js";
import type { DateTime } from "./scalars.js";

/**
 * Node interface - represents any entity with a unique identifier.
 * This is a common pattern in GraphQL APIs (e.g., Relay specification).
 * Types implementing this interface can be fetched by their ID.
 */
export type Node = DefineInterface<{
  /** Global unique identifier for the entity */
  id: IDString;
}>;

/**
 * Timestamped interface - represents entities that track creation time.
 * Types implementing this interface have a createdAt field.
 */
export type Timestamped = DefineInterface<{
  /** When the entity was created */
  createdAt: DateTime;
}>;

/**
 * Entity interface - combines Node and Timestamped for a common base.
 * This interface inherits from both Node and Timestamped.
 */
export type Entity = DefineInterface<
  {
    /** Global unique identifier */
    id: IDString;
    /** When the entity was created */
    createdAt: DateTime;
  },
  { implements: [Node, Timestamped] }
>;

/**
 * Fetch any Node by its ID.
 * This is a common pattern for generic entity lookup.
 */
export const node = defineQuery<{ id: string }, Node | null>((_root, args) => {
  return {
    id: args.id,
  } as Node;
});

/**
 * Get the typename of a Node.
 * In a real implementation, this would resolve the actual type.
 */
export const __typename = defineField<Node, NoArgs, string>(() => "Node");
