import type { GqlField, GqlObject, IDString } from "@gqlkit-ts/runtime";
import type { Key } from "@gqlkit-ts/runtime/federation";
import { defineQuery, defineResolveReference } from "../gqlkit.js";
import type { RedactDirective } from "./directives.js";

/** Users subgraph owns User and resolves it for other subgraphs. */
export type User = GqlObject<
  {
    id: IDString;
    name: string;
    email: GqlField<string, { directives: [RedactDirective] }>;
  },
  { directives: [Key<"id">] }
>;

const allUsers: User[] = [
  { id: "u1" as IDString, name: "Alice", email: "alice@example.com" },
  { id: "u2" as IDString, name: "Bob", email: "bob@example.com" },
];

export const userReference = defineResolveReference<User>((ref, ctx) => {
  ctx.onResolveReference?.(ref);
  return allUsers.find((u) => u.id === ref.id) ?? null;
});

export const user = defineQuery<
  {
    id: IDString;
    /** An access token that the gateway must not log. */
    token: GqlField<string | null, { directives: [RedactDirective] }>;
  },
  User | null
>((_root, args) => allUsers.find((u) => u.id === args.id) ?? null);
