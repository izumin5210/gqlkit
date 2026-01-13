import type { GqlInterface, GqlObject } from "@gqlkit-ts/runtime";
import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";

const { defineResolveType } = createGqlkitApis<{}>();

/**
 * User status enum with numeric values.
 */
export enum UserStatus {
  ACTIVE = 0,
  INACTIVE = 1,
  PENDING = 2,
}

/**
 * Node interface with status field.
 */
export type Node = GqlInterface<{
  id: string;
  status: UserStatus;
}>;

/**
 * User implementing Node.
 */
export type User = GqlObject<
  {
    id: string;
    name: string;
    status: UserStatus;
  },
  { implements: [Node] }
>;

export const resolveNodeType = defineResolveType<Node>((obj) => "User");
