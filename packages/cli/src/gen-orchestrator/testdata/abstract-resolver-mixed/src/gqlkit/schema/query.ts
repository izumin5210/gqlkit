import {
  createGqlkitApis,
  type IDString,
  type NoArgs,
} from "@gqlkit-ts/runtime";
import type { Node } from "./node.js";
import type { SearchResult } from "./search.js";
import type { User } from "./user.js";

type Context = unknown;

const { defineQuery } = createGqlkitApis<Context>();

export const search = defineQuery<{ query: string }, SearchResult[]>(
  (_root, _args) => [],
);

export const node = defineQuery<{ id: IDString }, Node | null>(
  (_root, _args) => null,
);

export const users = defineQuery<NoArgs, User[]>(() => []);
