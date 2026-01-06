import { createGqlkitApis } from "@gqlkit-ts/runtime";

type Context = unknown;

interface Result {
  id: string;
}

interface InvalidDefaultInput {
  field1: string;
  field2: string;
}

const { defineMutation } = createGqlkitApis<Context>();

export const doSomething = defineMutation<{ input: InvalidDefaultInput }, Result>(
  (_root, _args) => ({ id: "1" }),
);
