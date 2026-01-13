import {
  createGqlkitApis,
  type GqlInterface,
  type IDString,
} from "@gqlkit-ts/runtime";

/**
 * Node interface for global identification.
 */
export type Node = GqlInterface<{
  id: IDString;
}>;

type Context = unknown;
const { defineResolveType } = createGqlkitApis<Context>();

export const nodeResolveType = defineResolveType<Node>(() => "User");
