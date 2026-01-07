import type {
  Directive,
  IDString,
  WithDirectives,
  createGqlkitApis,
  NoArgs,
} from "@gqlkit-ts/runtime";

type Context = unknown;

const { defineQuery } = createGqlkitApis<Context>();

export type SchemaDirective = Directive<
  "schemaOnly",
  { version: "1.0" },
  "SCHEMA"
>;

export type ScalarDirective = Directive<
  "scalarSpec",
  { format: "date" },
  "SCALAR"
>;

export type InterfaceDirective = Directive<
  "interfaceMarker",
  { key: "test" },
  "INTERFACE"
>;

interface BaseUser {
  id: IDString;
  name: string;
}

export type User = WithDirectives<BaseUser, [SchemaDirective]>;

export type Product = WithDirectives<
  {
    id: IDString;
    title: string;
  },
  [ScalarDirective]
>;

export type Order = WithDirectives<
  {
    id: IDString;
    total: number;
  },
  [InterfaceDirective]
>;

export const users = defineQuery<NoArgs, User[]>(() => []);
