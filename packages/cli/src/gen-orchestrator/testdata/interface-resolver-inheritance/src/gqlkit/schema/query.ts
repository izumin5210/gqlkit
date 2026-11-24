import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { Entity } from "./entity.js";
import type { Node } from "./node.js";
import type { Post } from "./post.js";
import type { User } from "./user.js";

export const node = defineQuery<{ id: string }, Node | null>(() => null);

export const entity = defineQuery<{ id: string }, Entity | null>(() => null);

export const users = defineQuery<NoArgs, User[]>(() => []);

export const posts = defineQuery<NoArgs, Post[]>(() => []);
