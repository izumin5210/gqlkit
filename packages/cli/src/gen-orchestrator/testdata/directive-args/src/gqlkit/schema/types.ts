import { createGqlkitApis } from "@gqlkit-ts/runtime";
import type {
  Directive,
  IDString,
  WithDirectives,
  NoArgs,
} from "@gqlkit-ts/runtime";

type Context = unknown;

const { defineQuery } = createGqlkitApis<Context>();

interface BaseItem {
  id: IDString;
  name: string;
}

export enum Priority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

export type StringArgDirective = Directive<"stringArg", { value: "hello" }, "OBJECT">;
export type NumberArgDirective = Directive<"numberArg", { intValue: 42; floatValue: 3.14 }, "OBJECT">;
export type BooleanArgDirective = Directive<"booleanArg", { enabled: true; disabled: false }, "OBJECT">;
export type EnumArgDirective = Directive<"enumArg", { level: "HIGH" }, "OBJECT">;
export type RealEnumArgDirective = Directive<"realEnumArg", { priority: Priority.HIGH }, "OBJECT">;
export type ArrayArgDirective = Directive<"arrayArg", { values: ["a", "b", "c"] }, "OBJECT">;
export type ObjectArgDirective = Directive<"objectArg", { config: { key: "name"; count: 10 } }, "OBJECT">;

export type TypeWithStringArg = WithDirectives<BaseItem, [StringArgDirective]>;

export type TypeWithNumberArg = WithDirectives<BaseItem, [NumberArgDirective]>;

export type TypeWithBooleanArg = WithDirectives<BaseItem, [BooleanArgDirective]>;

export type TypeWithEnumArg = WithDirectives<BaseItem, [EnumArgDirective]>;

export type TypeWithRealEnumArg = WithDirectives<BaseItem, [RealEnumArgDirective]>;

export type TypeWithArrayArg = WithDirectives<BaseItem, [ArrayArgDirective]>;

export type TypeWithObjectArg = WithDirectives<BaseItem, [ObjectArgDirective]>;

interface User {
  id: IDString;
  name: string;
}

export const users = defineQuery<NoArgs, User[]>(() => []);
