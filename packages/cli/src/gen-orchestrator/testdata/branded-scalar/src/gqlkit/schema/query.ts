import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { User } from "../types/user.js";

export const users = defineQuery<NoArgs, User[]>(() => []);
