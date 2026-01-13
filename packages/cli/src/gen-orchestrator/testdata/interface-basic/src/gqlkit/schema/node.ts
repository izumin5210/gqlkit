import {
  createGqlkitApis,
  type GqlInterface,
  type IDString,
} from "@gqlkit-ts/runtime";

/**
 * The Node interface for Relay-style pagination.
 */
export type Node = GqlInterface<{
  id: IDString;
}>;

type Context = unknown;
const { defineResolveType } = createGqlkitApis<Context>();

export const nodeResolveType = defineResolveType<Node>(() => "User");
