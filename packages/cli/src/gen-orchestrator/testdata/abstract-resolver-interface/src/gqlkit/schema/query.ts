import type { IDString, NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { Node } from "./node.js";
import type { User } from "./user.js";

export const node = defineQuery<{ id: IDString }, Node | null>(
  (_root, _args) => null,
);

export const users = defineQuery<NoArgs, User[]>(() => []);
