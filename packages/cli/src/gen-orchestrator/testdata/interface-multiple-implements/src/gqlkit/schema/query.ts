import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { Post } from "./post.js";

export const posts = defineQuery<NoArgs, Post[]>(() => []);
