import type {
  Directive,
  IDString,
  WithDirectives,
  createGqlkitApis,
  NoArgs,
} from "@gqlkit-ts/runtime";

type Context = unknown;

const { defineQuery } = createGqlkitApis<Context>();

interface BaseItem {
  id: IDString;
  name: string;
}

type StringArgDirective = Directive<"stringArg", { value: "hello" }>;
type NumberArgDirective = Directive<"numberArg", { intValue: 42; floatValue: 3.14 }>;
type BooleanArgDirective = Directive<"booleanArg", { enabled: true; disabled: false }>;
type EnumArgDirective = Directive<"enumArg", { level: "HIGH" }>;
type ArrayArgDirective = Directive<"arrayArg", { values: ["a", "b", "c"] }>;
type ObjectArgDirective = Directive<"objectArg", { config: { key: "name"; count: 10 } }>;

export type TypeWithStringArg = WithDirectives<BaseItem, [StringArgDirective]>;

export type TypeWithNumberArg = WithDirectives<BaseItem, [NumberArgDirective]>;

export type TypeWithBooleanArg = WithDirectives<BaseItem, [BooleanArgDirective]>;

export type TypeWithEnumArg = WithDirectives<BaseItem, [EnumArgDirective]>;

export type TypeWithArrayArg = WithDirectives<BaseItem, [ArrayArgDirective]>;

export type TypeWithObjectArg = WithDirectives<BaseItem, [ObjectArgDirective]>;

interface User {
  id: IDString;
  name: string;
}

export const users = defineQuery<NoArgs, User[]>(() => []);
