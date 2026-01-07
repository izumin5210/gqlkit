import type { Directive, IDString, WithDirectives } from "@gqlkit-ts/runtime";

export interface User {
  id: IDString;
  name: string;
}

export type AuthDirective = Directive<"auth", { roles: ["USER", "ADMIN"] }, "OBJECT">;

export type ProtectedUser = WithDirectives<User, [AuthDirective]>;
