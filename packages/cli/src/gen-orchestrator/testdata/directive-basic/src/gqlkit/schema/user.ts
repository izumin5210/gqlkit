import type { Directive, IDString, WithDirectives } from "@gqlkit-ts/runtime";

export interface User {
  id: IDString;
  name: string;
}

type AuthDirective = Directive<"auth", { roles: ["USER", "ADMIN"] }>;

export type ProtectedUser = WithDirectives<User, [AuthDirective]>;
