import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { Article } from "./article.js";

export const articles = defineQuery<NoArgs, Article[]>(() => []);
