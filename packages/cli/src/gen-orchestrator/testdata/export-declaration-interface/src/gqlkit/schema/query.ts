import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery, defineResolveType } from "../gqlkit.js";
import type { Article } from "./article.js";
import type { Entity } from "./types.js";

export const articles = defineQuery<NoArgs, Article[]>(() => []);

export const entityResolveType = defineResolveType<Entity>(() => "Article");
