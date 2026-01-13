import type { NoArgs, QueryResolver } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { User } from "./user.js";

export const users = defineQuery<NoArgs, User[]>(() => []);
