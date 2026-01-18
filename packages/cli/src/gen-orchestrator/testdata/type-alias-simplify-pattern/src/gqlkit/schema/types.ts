import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

type Simplify<T> = { [K in keyof T]: T[K] } & {};

interface InternalUser {
  id: number;
  name: string;
}

export type User = Simplify<InternalUser>;

export const allUsers = defineQuery<NoArgs, User[]>(() => {
  return [];
});
