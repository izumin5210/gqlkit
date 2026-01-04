export interface FooInput {
  foo: string;
}

export interface fooInput {
  bar: string;
}

export type ConflictingFieldsInput = FooInput | fooInput;

export type InlineObjectsInput = { a: string } | { b: string };
