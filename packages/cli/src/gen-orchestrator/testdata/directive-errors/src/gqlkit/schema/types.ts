import { createGqlkitApis } from "@gqlkit-ts/runtime";
import type {
  Directive,
  IDString,
  WithDirectives,
  NoArgs,
} from "@gqlkit-ts/runtime";

type Context = unknown;

const { defineQuery } = createGqlkitApis<Context>();

type EmptyNameDirective = Directive<"", { value: "test" }>;
type UnresolvableArgDirective = Directive<"unresolvable", { value: unknown }>;

interface BaseItem {
  id: IDString;
  name: string;
}

export type TypeWithEmptyDirectiveName = WithDirectives<
  BaseItem,
  [EmptyNameDirective]
>;

export type TypeWithUnresolvableArg = WithDirectives<
  BaseItem,
  [UnresolvableArgDirective]
>;

interface User {
  id: IDString;
  name: string;
}

export const users = defineQuery<NoArgs, User[]>(() => []);
