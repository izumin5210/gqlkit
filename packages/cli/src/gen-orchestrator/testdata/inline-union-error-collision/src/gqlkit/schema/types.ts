import { defineIsTypeOf } from "../gqlkit.js";

/**
 * User type
 */
export type User = {
  id: string;
  name: string;
};

/**
 * Post type
 */
export type Post = {
  id: string;
  title: string;
};

/**
 * Container with inline union that will generate ContainerItem union.
 */
export type Container = {
  id: string;
  /**
   * The item field generates ContainerItem union
   */
  item: User | Post;
};

/**
 * Explicit ContainerItem type that conflicts with auto-generated union.
 * This should cause a type name collision error.
 */
export type ContainerItem = {
  value: string;
  description: string;
};

export const userIsTypeOf = defineIsTypeOf<User>((value) => {
  return typeof value === "object" && value !== null && "name" in value;
});

export const postIsTypeOf = defineIsTypeOf<Post>((value) => {
  return typeof value === "object" && value !== null && "title" in value;
});
