import {
  createGqlkitApis,
  type GqlField,
  type NoArgs,
} from "@gqlkit-ts/runtime";

type Context = unknown;

const { defineQuery, defineMutation } = createGqlkitApis<Context>();

/**
 * User type for testing
 */
export type User = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

/**
 * Base input type with all fields
 */
type UserInput = {
  /** User's name */
  name: string;
  /** User's email address */
  email: string;
  /** User's age */
  age: number;
  /** User's bio (optional) */
  bio?: string;
};

/**
 * Input type with required and optional fields for Partial/Required testing
 */
export type ProfileInput = {
  /** Display name (required) */
  displayName: string;
  /** Avatar URL (required) */
  avatarUrl: string;
  /** Website URL (optional) */
  website?: string;
  /** Location (optional) */
  location?: string;
};

/**
 * Input type with deprecated fields for @deprecated tag testing
 */
export type SettingsInput = {
  /** Theme preference */
  theme: string;
  /**
   * Legacy notification setting
   * @deprecated Use notificationPreferences instead
   */
  notifications: boolean;
  /**
   * @deprecated
   */
  legacyFlag: boolean;
  /** New notification preferences */
  notificationPreferences: string | null;
};

/**
 * Simple query to get all users
 */
export const allUsers = defineQuery<NoArgs, User[]>(() => []);

/**
 * Create user using Omit to exclude some fields
 */
export const createUserWithOmit = defineMutation<
  {
    /** User data without age field */
    input: Omit<UserInput, "age">;
  },
  User
>((_root, args) => ({
  id: "1",
  name: args.input.name,
  email: args.input.email,
  createdAt: new Date().toISOString(),
}));

/**
 * Create user using Pick to select specific fields
 */
export const createUserWithPick = defineMutation<
  {
    /** Only name and email from UserInput */
    input: Pick<UserInput, "name" | "email">;
  },
  User
>((_root, args) => ({
  id: "1",
  name: args.input.name,
  email: args.input.email,
  createdAt: new Date().toISOString(),
}));

/**
 * Additional fields for intersection test
 */
type AdditionalFields = {
  /** Additional notes */
  notes: string | null;
};

/**
 * Create user using intersection type for arguments
 */
export const createUserWithIntersection = defineMutation<
  {
    /** User data merged with additional fields */
    input: Pick<UserInput, "name" | "email"> & AdditionalFields;
  },
  User
>((_root, args) => ({
  id: "1",
  name: args.input.name,
  email: args.input.email,
  createdAt: new Date().toISOString(),
}));

/**
 * Test with argument-level defaultValue on utility type
 */
export const createUserWithDefault = defineMutation<
  {
    /** User name */
    name: string;
    /** Pagination with default */
    limit: GqlField<number, { defaultValue: 10 }>;
  },
  User
>((_root, args) => ({
  id: "1",
  name: args.name,
  email: "test@example.com",
  createdAt: new Date().toISOString(),
}));

/**
 * Create user with direct Omit type as args (not wrapped in object).
 * This tests extractArgsFromType directly with utility type.
 */
export const createUserDirectOmit = defineMutation<
  Omit<UserInput, "age">,
  User
>((_root, args) => ({
  id: "1",
  name: args.name,
  email: args.email,
  createdAt: new Date().toISOString(),
}));

/**
 * Create user with direct Pick type as args.
 */
export const createUserDirectPick = defineMutation<
  Pick<UserInput, "name" | "email">,
  User
>((_root, args) => ({
  id: "1",
  name: args.name,
  email: args.email,
  createdAt: new Date().toISOString(),
}));

/**
 * Create user with direct intersection type as args.
 */
export const createUserDirectIntersection = defineMutation<
  Pick<UserInput, "name"> & { email: string },
  User
>((_root, args) => ({
  id: "1",
  name: args.name,
  email: args.email,
  createdAt: new Date().toISOString(),
}));

/**
 * Update profile using Partial to make all fields optional.
 * Tests Requirement 2.3: Partial<T> makes all properties optional.
 */
export const updateProfileWithPartial = defineMutation<
  {
    /** Profile data with all fields optional */
    input: Partial<ProfileInput>;
  },
  User
>((_root, _args) => ({
  id: "1",
  name: "Updated User",
  email: "updated@example.com",
  createdAt: new Date().toISOString(),
}));

/**
 * Update profile using Partial directly as args.
 */
export const updateProfileDirectPartial = defineMutation<
  Partial<ProfileInput>,
  User
>((_root, _args) => ({
  id: "1",
  name: "Updated User",
  email: "updated@example.com",
  createdAt: new Date().toISOString(),
}));

/**
 * Create profile using Required to make all fields required.
 * Tests Requirement 2.4: Required<T> makes all properties required.
 */
export const createProfileWithRequired = defineMutation<
  {
    /** Profile data with all fields required */
    input: Required<ProfileInput>;
  },
  User
>((_root, _args) => ({
  id: "1",
  name: "New User",
  email: "new@example.com",
  createdAt: new Date().toISOString(),
}));

/**
 * Create profile using Required directly as args.
 */
export const createProfileDirectRequired = defineMutation<
  Required<ProfileInput>,
  User
>((_root, _args) => ({
  id: "1",
  name: "New User",
  email: "new@example.com",
  createdAt: new Date().toISOString(),
}));

/**
 * Update settings using Omit to test deprecated fields inheritance.
 */
export const updateSettingsWithDeprecated = defineMutation<
  {
    /** Settings data including deprecated fields */
    input: Omit<SettingsInput, "theme">;
  },
  User
>((_root, _args) => ({
  id: "1",
  name: "User",
  email: "user@example.com",
  createdAt: new Date().toISOString(),
}));

/**
 * Update settings with deprecated fields directly as args.
 */
export const updateSettingsDirectDeprecated = defineMutation<
  Pick<SettingsInput, "notifications" | "legacyFlag">,
  User
>((_root, _args) => ({
  id: "1",
  name: "User",
  email: "user@example.com",
  createdAt: new Date().toISOString(),
}));
