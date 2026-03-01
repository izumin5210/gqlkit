import type { GqlInterface, IDString } from "@gqlkit-ts/runtime";
import { defineQuery, defineResolveType } from "../gqlkit.js";
import type { DateTime } from "./scalars.js";

/**
 * Node interface - represents any entity with a unique identifier.
 * This is a common pattern in GraphQL APIs (e.g., Relay specification).
 * Types implementing this interface can be fetched by their ID.
 */
export type Node = GqlInterface<{
  /** Global unique identifier for the entity */
  id: IDString;
}>;

/**
 * Timestamped interface - represents entities that track creation time.
 * Types implementing this interface have a createdAt field.
 */
export type Timestamped = GqlInterface<{
  /** When the entity was created */
  createdAt: DateTime;
}>;

/**
 * Entity interface - combines Node and Timestamped for a common base.
 * This interface inherits from both Node and Timestamped.
 */
export type Entity = GqlInterface<
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

export const nodeResolveType = defineResolveType<Node>((value) => {
  if ("title" in value) {
    return "Post";
  }
  if ("postId" in value) {
    return "Comment";
  }
  return "User";
});

export const timestampedResolveType = defineResolveType<Timestamped>(
  (value) => {
    if ("title" in value) {
      return "Post";
    }
    if ("postId" in value) {
      return "Comment";
    }
    return "User";
  },
);
