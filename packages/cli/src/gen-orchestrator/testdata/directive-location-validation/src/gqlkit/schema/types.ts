import type {
  Directive,
  IDString,
  WithDirectives,
  createGqlkitApis,
  NoArgs,
} from "@gqlkit-ts/runtime";

type Context = unknown;

const { defineQuery } = createGqlkitApis<Context>();

export type FieldOnlyDirective = Directive<
  "fieldOnly",
  { reason: "test" },
  "FIELD_DEFINITION"
>;

interface BaseUser {
  id: IDString;
  name: string;
}

export type User = WithDirectives<BaseUser, [FieldOnlyDirective]>;

export const users = defineQuery<NoArgs, User[]>(() => []);
