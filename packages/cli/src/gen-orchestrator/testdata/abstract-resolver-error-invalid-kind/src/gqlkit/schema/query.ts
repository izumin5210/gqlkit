import { defineQuery } from "../gqlkit.js";
import type { SearchResult, User } from "./types.js";

export const users = defineQuery<Record<string, never>, User[]>(() => []);

export const search = defineQuery<{ query: string }, SearchResult[]>(() => []);
