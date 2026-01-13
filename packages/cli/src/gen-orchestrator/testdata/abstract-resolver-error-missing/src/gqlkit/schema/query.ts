import type { IDString } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { Node, SearchResult } from "./types.js";

export const search = defineQuery<{ query: string }, SearchResult[]>(
  (_root, _args) => [],
);

export const node = defineQuery<{ id: IDString }, Node | null>(
  (_root, _args) => null,
);
