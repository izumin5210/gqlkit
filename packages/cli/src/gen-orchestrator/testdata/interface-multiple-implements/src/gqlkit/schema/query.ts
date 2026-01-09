import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import type { Post } from "./post.js";

const { defineQuery } = createGqlkitApis();

export const posts = defineQuery<NoArgs, Post[]>(() => []);
