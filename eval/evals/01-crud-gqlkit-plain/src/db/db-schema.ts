/**
 * Source-of-truth backing schema used across every eval.
 *
 * Modeled after a Drizzle ORM schema so agents see a familiar shape.
 * Each eval's `src/db/schema.ts` is generated from this file via
 * `pnpm sync` — never edit the copies directly.
 */

export type DbUser = {
  id: string;
  name: string;
  /** Sensitive: must NEVER appear in the GraphQL schema. */
  email: string;
  createdAt: Date;
};

export type DbPost = {
  id: string;
  title: string;
  body: string;
  authorId: string;
  /** Internal moderation notes — must NEVER appear in the GraphQL schema. */
  internalNotes: string;
  /** Persisted as a string literal union; expose as a GraphQL enum. */
  priority: "low" | "medium" | "high";
  createdAt: Date;
};

// Approximate Drizzle table objects. They are intentionally untyped against
// `drizzle-orm` so this fixture installs in the sandbox without pulling drizzle.
// Treat them as opaque values whose only purpose is to type-check `DbUser` /
// `DbPost` derivations via the exported types above.
export const usersTable = {
  _: "users_table_marker" as const,
  columns: ["id", "name", "email", "createdAt"] as const,
};

export const postsTable = {
  _: "posts_table_marker" as const,
  columns: [
    "id",
    "title",
    "body",
    "authorId",
    "internalNotes",
    "priority",
    "createdAt",
  ] as const,
};
