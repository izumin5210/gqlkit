import type {
  Directive,
  IDString,
  WithDirectives,
  createGqlkitApis,
  NoArgs,
} from "@gqlkit-ts/runtime";

type Context = unknown;

const { defineQuery } = createGqlkitApis<Context>();

type ExternalDirective = Directive<"external", { source: "api" }>;

interface BaseUser {
  id: IDString;
  name: string;
}

export type User = WithDirectives<BaseUser, [ExternalDirective]>;

export const users = defineQuery<NoArgs, User[]>(() => []);
