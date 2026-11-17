import type { GqlField, IDString } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { RedactDirective } from "./directives.js";

export type User = {
  id: IDString;
  name: string;
  email: GqlField<string, { directives: [RedactDirective] }>;
};

const allUsers: User[] = [
  { id: "u1" as IDString, name: "Alice", email: "alice@example.com" },
  { id: "u2" as IDString, name: "Bob", email: "bob@example.com" },
];

export const user = defineQuery<
  {
    id: IDString;
    /** An access token that the gateway must not log. */
    token: GqlField<string | null, { directives: [RedactDirective] }>;
  },
  User | null
>((_root, args) => allUsers.find((u) => u.id === args.id) ?? null);
