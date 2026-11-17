import type { GqlDirective, GqlField, GqlObject } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

export type CacheDirective = GqlDirective<
  "cache",
  Record<string, never>,
  ["OBJECT", "FIELD_DEFINITION"]
>;

/** Its directives belong to the type, not to the fields that return it. */
export type Post = GqlObject<
  { title: string },
  { directives: [CacheDirective] }
>;

export type User = {
  post: Post;
  /** A nullable reference keeps the type name instead of inlining it. */
  maybePost: Post | null;
  posts: Post[];
  /** A field gets directives only from its own GqlField. */
  pinnedPost: GqlField<Post | null, { directives: [CacheDirective] }>;
};

export const user = defineQuery<Record<string, never>, User | null>(() => null);
