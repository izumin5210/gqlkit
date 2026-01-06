import { createGqlkitApis } from "@gqlkit-ts/runtime";
import type { TypeMismatchInput, Result } from "./types.js";

type Context = unknown;

const { defineMutation } = createGqlkitApis<Context>();

export const testTypeMismatch = defineMutation<{ input: TypeMismatchInput }, Result>(
  (_root, _args) => ({ id: "1" }),
);
