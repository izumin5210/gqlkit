import type {
  Directive,
  IDString,
  WithDirectives,
  createGqlkitApis,
  NoArgs,
} from "@gqlkit-ts/runtime";

type Context = unknown;

const { defineQuery } = createGqlkitApis<Context>();

type FirstDirective = Directive<"first", { order: 1 }>;
type SecondDirective = Directive<"second", { order: 2 }>;
type ThirdDirective = Directive<"third", { order: 3 }>;

interface BaseItem {
  id: IDString;
  name: string;
}

export type TypeWithMultipleDirectives = WithDirectives<
  BaseItem,
  [FirstDirective, SecondDirective, ThirdDirective]
>;

type CacheDirective = Directive<"cache", { maxAge: 3600 }>;
type AuthDirective = Directive<"auth", { roles: ["USER", "ADMIN"] }>;
type RateLimitDirective = Directive<"rateLimit", { limit: 100; window: 60 }>;

export type TypeWithRealisticDirectives = WithDirectives<
  BaseItem,
  [AuthDirective, CacheDirective, RateLimitDirective]
>;

interface Post {
  id: IDString;
  title: string;
  fieldWithDirectives: WithDirectives<string, [AuthDirective, CacheDirective]>;
}

export type { Post };

interface User {
  id: IDString;
  name: string;
}

export const users = defineQuery<NoArgs, User[]>(() => []);
