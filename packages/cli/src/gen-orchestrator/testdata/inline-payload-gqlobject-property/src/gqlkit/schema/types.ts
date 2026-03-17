import type { GqlObject, NoArgs } from "@gqlkit-ts/runtime";

import { defineMutation, defineQuery } from "../gqlkit.js";

/**
 * Underlying model type (e.g., database row).
 */
type UserRow = {
  id: string;
  name: string;
  role: "admin" | "member";
  internalNote: string;
};

/**
 * GqlObject wraps UserRow as an intersection type (UserRow & { $meta }).
 * When used as a property inside an inline payload, it should be
 * referenced by its schema name "User" — not expanded into an
 * auto-generated type like "CreateUserPayloadUser".
 */
export type User = GqlObject<UserRow, { ignoreFields: "internalNote" }>;

export const users = defineQuery<NoArgs, User[]>(() => []);

export const user = defineQuery<{ id: string }, User>(
  (_root, args) =>
    ({ id: args.id, name: "Alice", role: "admin", internalNote: "" }) as User,
);

/**
 * Inline payload whose property references a GqlObject-based type.
 */
export const createUser = defineMutation<
  { input: { name: string } },
  { user: User }
>((_root, { input }) => ({
  user: { id: "1", name: input.name, role: "member", internalNote: "" } as User,
}));

/**
 * Another mutation — verifies the fix works across multiple resolvers.
 */
export const updateUser = defineMutation<
  { id: string; input: { name: string | null } },
  { user: User }
>((_root, { id, input }) => ({
  user: {
    id,
    name: input.name ?? "",
    role: "member",
    internalNote: "",
  } as User,
}));
