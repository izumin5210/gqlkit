import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";

const { defineField } = createGqlkitApis<{}>();

/**
 * User status enum with numeric values.
 */
export enum UserStatus {
  ACTIVE = 0,
  INACTIVE = 1,
  PENDING = 2,
}

export interface User {
  id: string;
  name: string;
  /** Status with auto resolver */
  status: UserStatus;
}

export const customStatus = defineField<User, NoArgs, UserStatus>(
  (parent) => parent.status,
);
