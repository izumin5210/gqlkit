import {
  defineField,
  defineMutation,
  defineQuery,
  type NoArgs,
} from "../gqlkit.js";

/**
 * Base user profile type with all fields.
 * This is NOT exported, so it's not in knownTypeNames.
 * Utility types wrapping this should be expanded.
 */
type UserProfile = {
  /** User's display name */
  name: string;
  /** User's email address */
  email: string;
  /** User's phone number */
  phone: string;
  /** User's age */
  age: number;
  /** User's biography */
  bio: string | null;
};

/**
 * User type - exported and in knownTypeNames.
 * When used directly, should be preserved as reference.
 */
export type User = {
  id: string;
  name: string;
};

/**
 * Post type for field resolver testing.
 */
export type Post = {
  id: string;
  title: string;
};

/**
 * Query to list posts.
 */
export const posts = defineQuery<NoArgs, Post[]>(() => []);

/**
 * Query returning Omit utility type.
 * Omit<UserProfile, "phone" | "age"> should be expanded to inline object.
 * Generates GetUserProfilePayload with name, email, bio fields.
 * Tests Requirement 6.2 (Omit expansion).
 */
export const getUserProfile = defineQuery<
  { id: string },
  Omit<UserProfile, "phone" | "age">
>((_root, _args) => ({
  name: "Test User",
  email: "test@example.com",
  bio: null,
}));

/**
 * Mutation returning Pick utility type.
 * Pick<UserProfile, "name" | "email"> should be expanded to inline object.
 * Generates UpdateUserEmailPayload with name, email fields.
 * Tests Requirement 6.2 (Pick expansion).
 */
export const updateUserEmail = defineMutation<
  { id: string; email: string },
  Pick<UserProfile, "name" | "email">
>((_root, args) => ({
  name: "Updated User",
  email: args.email,
}));

/**
 * Additional metadata fields for intersection test.
 */
type MetadataFields = {
  /** Last updated timestamp */
  updatedAt: string;
  /** Whether the entity is active */
  isActive: boolean;
};

/**
 * Query returning intersection of Pick and additional fields.
 * Pick<UserProfile, "name" | "bio"> & MetadataFields should be expanded.
 * Generates GetUserSummaryPayload with name, bio, updatedAt, isActive fields.
 * Tests Requirement 6.2 (intersection with utility type expansion).
 */
export const getUserSummary = defineQuery<
  { id: string },
  Pick<UserProfile, "name" | "bio"> & MetadataFields
>((_root, _args) => ({
  name: "Summary User",
  bio: "A user bio",
  updatedAt: new Date().toISOString(),
  isActive: true,
}));

/**
 * Mutation returning Omit with intersection.
 * Omit<UserProfile, "age" | "phone"> & { verified: boolean } should be expanded.
 * Tests complex utility type combinations.
 */
export const createVerifiedProfile = defineMutation<
  { name: string; email: string },
  Omit<UserProfile, "age" | "phone"> & { verified: boolean }
>((_root, args) => ({
  name: args.name,
  email: args.email,
  bio: null,
  verified: true,
}));

/**
 * Field resolver returning Omit utility type.
 * Omit<UserProfile, "age"> should be expanded to inline object.
 * Generates PostAuthorProfilePayload with name, email, phone, bio fields.
 * Tests Requirement 6.2 for field resolver.
 */
export const authorProfile = defineField<
  Post,
  NoArgs,
  Omit<UserProfile, "age">
>(() => ({
  name: "Author Name",
  email: "author@example.com",
  phone: "123-456-7890",
  bio: "Author bio",
}));

/**
 * Field resolver returning Pick utility type.
 * Pick<UserProfile, "email" | "phone"> should be expanded.
 * Generates PostContactInfoPayload with email, phone fields.
 */
export const contactInfo = defineField<
  Post,
  NoArgs,
  Pick<UserProfile, "email" | "phone">
>(() => ({
  email: "contact@example.com",
  phone: "987-654-3210",
}));

/**
 * Query returning nullable utility type.
 * Tests that nullable wrapper is preserved with utility type expansion.
 */
export const findUserProfile = defineQuery<
  { email: string },
  Omit<UserProfile, "phone" | "age"> | null
>((_root, _args) => null);
