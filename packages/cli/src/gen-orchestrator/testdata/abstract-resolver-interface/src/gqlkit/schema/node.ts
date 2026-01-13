import {
  createGqlkitApis,
  type GqlInterface,
  type IDString,
} from "@gqlkit-ts/runtime";

type Context = unknown;

export type Node = GqlInterface<{
  id: IDString;
}>;

const { defineResolveType } = createGqlkitApis<Context>();

export const nodeResolveType = defineResolveType<Node>((value) => {
  if ("name" in value) {
    return "User";
  }
  if ("title" in value) {
    return "Post";
  }
  return "User";
});
