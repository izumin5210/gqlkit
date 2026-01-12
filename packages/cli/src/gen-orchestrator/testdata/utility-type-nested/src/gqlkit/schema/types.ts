import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";

type Context = unknown;

const { defineQuery, defineMutation } = createGqlkitApis<Context>();

/**
 * Base user type for testing
 */
export type User = {
  id: string;
  name: string;
  email: string;
  age: number;
};

/**
 * Full input type with all fields
 */
type UserInput = {
  /** User's name */
  name: string;
  /** User's email address */
  email: string;
  /** User's age */
  age: number;
  /** User's bio */
  bio: string;
  /** User's phone number */
  phone: string;
};

/**
 * Profile type with required and optional fields
 */
type ProfileInput = {
  /** Display name */
  displayName: string;
  /** Avatar URL */
  avatarUrl: string;
  /** Website URL */
  website?: string;
  /** Location */
  location?: string;
};

/**
 * User-defined generic type: Makes all properties optional and excludes specified keys.
 * This tests Requirement 2.6: user-defined generic types.
 */
type OptionalExcept<T, K extends keyof T> = Partial<Omit<T, K>>;

/**
 * User-defined generic type: Picks specified keys and makes them optional.
 */
type PartialPick<T, K extends keyof T> = Partial<Pick<T, K>>;

/**
 * Simple query to get all users
 */
export const allUsers = defineQuery<NoArgs, User[]>(() => []);

/**
 * Test nested utility types: Partial<Omit<T, K>>
 * Makes all remaining fields optional after omitting specified keys.
 * Tests Requirement 2.5: nested utility types.
 */
export const updateUserWithNestedUtility = defineMutation<
  {
    /** User data with id omitted and all remaining fields optional */
    input: Partial<Omit<UserInput, "phone">>;
  },
  User
>((_root, _args) => ({
  id: "1",
  name: "Updated",
  email: "updated@example.com",
  age: 30,
}));

/**
 * Test nested utility types directly as args: Partial<Omit<T, K>>
 */
export const updateUserDirectNestedUtility = defineMutation<
  Partial<Omit<UserInput, "phone" | "bio">>,
  User
>((_root, _args) => ({
  id: "1",
  name: "Updated",
  email: "updated@example.com",
  age: 30,
}));

/**
 * Test deeper nesting: Required<Partial<Pick<T, K>>>
 * This tests that deeply nested utility types are correctly resolved.
 */
export const createUserWithDeeplyNested = defineMutation<
  {
    /** User data with deeply nested utility types */
    input: Required<Partial<Pick<UserInput, "name" | "email" | "age">>>;
  },
  User
>((_root, _args) => ({
  id: "1",
  name: "New",
  email: "new@example.com",
  age: 25,
}));

/**
 * Test user-defined generic type: OptionalExcept<T, K>
 * Tests Requirement 2.6: user-defined generic types are resolved.
 */
export const updateProfileWithOptionalExcept = defineMutation<
  {
    /** Profile data using OptionalExcept generic */
    input: OptionalExcept<ProfileInput, "displayName">;
  },
  User
>((_root, _args) => ({
  id: "1",
  name: "Profile Updated",
  email: "profile@example.com",
  age: 28,
}));

/**
 * Test user-defined generic type directly as args.
 */
export const updateProfileDirectOptionalExcept = defineMutation<
  OptionalExcept<ProfileInput, "avatarUrl">,
  User
>((_root, _args) => ({
  id: "1",
  name: "Profile Updated",
  email: "profile@example.com",
  age: 28,
}));

/**
 * Test user-defined generic type: PartialPick<T, K>
 */
export const searchUsersWithPartialPick = defineQuery<
  {
    /** Search criteria using PartialPick */
    criteria: PartialPick<UserInput, "name" | "email">;
  },
  User[]
>((_root, _args) => []);

/**
 * Test user-defined generic type directly: PartialPick<T, K>
 */
export const searchUsersDirectPartialPick = defineQuery<
  PartialPick<UserInput, "name" | "email" | "age">,
  User[]
>((_root, _args) => []);

/**
 * Test combined nested utility with intersection.
 * Partial<Pick<T, K>> & { additionalField: type }
 */
export const updateUserWithNestedAndIntersection = defineMutation<
  Partial<Pick<UserInput, "name" | "email">> & { id: string },
  User
>((_root, args) => ({
  id: args.id,
  name: "Combined",
  email: "combined@example.com",
  age: 40,
}));

/**
 * Test nested utility on inline object within args.
 */
export const createComplexUser = defineMutation<
  {
    /** Basic user info */
    basic: Pick<UserInput, "name" | "email">;
    /** Optional profile info with nested utility */
    profile: Partial<Omit<ProfileInput, "displayName">>;
  },
  User
>((_root, _args) => ({
  id: "1",
  name: "Complex",
  email: "complex@example.com",
  age: 45,
}));
