import { createGqlkitApis } from "@gqlkit-ts/runtime";
import type {
  Directive,
  IDString,
  WithDirectives,
  NoArgs,
} from "@gqlkit-ts/runtime";

type Context = unknown;

const { defineQuery } = createGqlkitApis<Context>();

export type FirstDirective = Directive<"first", { order: 1 }, "OBJECT">;
export type SecondDirective = Directive<"second", { order: 2 }, "OBJECT">;
export type ThirdDirective = Directive<"third", { order: 3 }, "OBJECT">;

interface BaseItem {
  id: IDString;
  name: string;
}

export type TypeWithMultipleDirectives = WithDirectives<
  BaseItem,
  [FirstDirective, SecondDirective, ThirdDirective]
>;

export type CacheDirective = Directive<"cache", { maxAge: 3600 }, "OBJECT" | "FIELD_DEFINITION">;
export type AuthDirective = Directive<"auth", { roles: ["USER", "ADMIN"] }, "OBJECT" | "FIELD_DEFINITION">;
export type RateLimitDirective = Directive<"rateLimit", { limit: 100; window: 60 }, "OBJECT">;

export type TypeWithRealisticDirectives = WithDirectives<
  BaseItem,
  [AuthDirective, CacheDirective, RateLimitDirective]
>;

export interface Post {
  id: IDString;
  title: string;
  fieldWithDirectives: WithDirectives<string, [AuthDirective, CacheDirective]>;
}

interface User {
  id: IDString;
  name: string;
}

export const users = defineQuery<NoArgs, User[]>(() => []);
export const posts = defineQuery<NoArgs, Post[]>(() => []);
