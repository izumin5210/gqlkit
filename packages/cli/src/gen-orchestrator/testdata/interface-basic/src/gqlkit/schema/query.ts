import {
  createGqlkitApis,
  type NoArgs,
  type QueryResolver,
} from "@gqlkit-ts/runtime";
import type { User } from "./user.js";

const { defineQuery } = createGqlkitApis();

export const users = defineQuery<NoArgs, User[]>(() => []);
