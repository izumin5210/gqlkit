import { createGqlkitApis } from "@gqlkit-ts/runtime";

const { defineMutation } = createGqlkitApis<Record<string, never>>();

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
  status: UserStatus;
}

/**
 * Input for creating a user.
 */
export interface CreateUserInput {
  name: string;
  status: UserStatus;
}

export const createUser = defineMutation<{ input: CreateUserInput }, User>(
  (_root, { input }) => {
    return {
      id: "1",
      name: input.name,
      status: input.status,
    };
  },
);
