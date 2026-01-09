import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import type { Article } from "./article.js";

const { defineQuery } = createGqlkitApis();

export const articles = defineQuery<NoArgs, Article[]>(() => []);
