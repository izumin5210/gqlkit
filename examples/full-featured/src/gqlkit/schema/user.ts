import type { GqlObject, IDString, Int, NoArgs } from "@gqlkit-ts/runtime";
import { defineField, defineMutation, defineQuery } from "../gqlkit.js";
import type { Node, Timestamped } from "./node.js";
import type { Post } from "./post.js";
import type { Role } from "./role.js";
import type { DateTime } from "./scalars.js";
import type { UserStatus } from "./status.js";

/**
 * A user in the system.
 * Implements Node (identifiable) and Timestamped (has createdAt).
 */
export type User = GqlObject<
  {
    /** Unique identifier for the user */
    id: IDString;
    /** User's display name */
    name: string;
    /** User's email address (null if not verified) */
    email: string | null;
    /** User's age in years */
    age: Int;
    /** Current account status */
    status: UserStatus;
    /** User's role */
    role: Role;
    /** When the user was created */
    createdAt: DateTime;
    /**
     * User's legacy username
     * @deprecated Use `name` field instead
     */
    username: string | null;
  },
  { implements: [Node, Timestamped] }
>;

/** Input for creating a new user */
export interface CreateUserInput {
  name: string;
  email: string | null;
  age: Int;
  role: Role | null;
}

/** Input for updating user profile */
export interface UpdateUserInput {
  name: string | null;
  email: string | null;
  age: Int | null;
}

const users: User[] = [
  {
    id: "1" as User["id"],
    name: "Alice",
    email: "alice@example.com",
    age: 30 as User["age"],
    status: "ACTIVE" as unknown as User["status"],
    role: "ADMIN" as unknown as User["role"],
    createdAt: "2024-01-01T00:00:00Z" as User["createdAt"],
    username: null,
  },
  {
    id: "2" as User["id"],
    name: "Bob",
    email: null,
    age: 25 as User["age"],
    status: "INACTIVE" as unknown as User["status"],
    role: "VIEWER" as unknown as User["role"],
    createdAt: "2024-06-15T12:00:00Z" as User["createdAt"],
    username: "bob_legacy",
  },
];

const postsByAuthor: Record<string, Post[]> = {
  "1": [
    {
      id: "1" as Post["id"],
      title: "Hello World",
      body: "This is my first post",
      status: "PUBLISHED" as unknown as Post["status"],
      authorId: "1" as Post["authorId"],
      tags: ["intro"],
      publishedAt: "2024-01-15T10:00:00Z" as Post["publishedAt"],
      createdAt: "2024-01-15T09:00:00Z" as Post["createdAt"],
    },
  ],
  "2": [],
};

/** Get the currently authenticated user */
export const me = defineQuery<NoArgs, User | null>((_root, _args, ctx) => {
  if (!ctx.currentUserId) return null;
  return users.find((u) => u.id === ctx.currentUserId) ?? null;
});

/** Get all users */
export const allUsers = defineQuery<NoArgs, User[]>(() => users);

/**
 * Get a user by ID
 */
export const user = defineQuery<{ id: string }, User | null>(
  (_root, args) => users.find((u) => u.id === args.id) ?? null,
);

/**
 * List users with pagination
 */
export const users_ = defineQuery<
  { limit: number; offset: number | null; status: string | null },
  User[]
>((_root, args) => {
  let result = users;
  if (args.status) {
    result = result.filter(
      (u) => (u.status as unknown as string) === args.status,
    );
  }
  const offset = args.offset ?? 0;
  return result.slice(offset, offset + args.limit);
});

/**
 * Create a new user
 */
export const createUser = defineMutation<{ input: CreateUserInput }, User>(
  (_root, args) => ({
    id: crypto.randomUUID() as User["id"],
    name: args.input.name,
    email: args.input.email,
    age: args.input.age,
    status: "ACTIVE" as unknown as User["status"],
    role: args.input.role ?? ("VIEWER" as unknown as User["role"]),
    createdAt: new Date().toISOString() as User["createdAt"],
    username: null,
  }),
);

/**
 * Update an existing user
 */
export const updateUser = defineMutation<
  { id: string; input: UpdateUserInput },
  User | null
>((_root, args) => {
  const user: User = {
    id: args.id as User["id"],
    name: args.input.name ?? "Unknown",
    email: args.input.email ?? null,
    age: args.input.age ?? (0 as User["age"]),
    status: "ACTIVE" as unknown as User["status"],
    role: "VIEWER" as unknown as User["role"],
    createdAt: new Date().toISOString() as User["createdAt"],
    username: null,
  };
  return user;
});

/**
 * Delete a user by ID
 */
export const deleteUser = defineMutation<{ id: string }, boolean>(
  (_root, _args) => true,
);

/**
 * Get posts authored by this user
 */
export const posts = defineField<User, NoArgs, Post[]>(
  (parent) => postsByAuthor[parent.id] ?? [],
);

/**
 * Get the count of posts by this user
 */
export const postCount = defineField<User, NoArgs, number>(
  (parent) => (postsByAuthor[parent.id] ?? []).length,
);

/**
 * Get user's display name with role suffix
 */
export const displayName = defineField<User, NoArgs, string>(
  (parent) => `${parent.name} (${parent.role})`,
);

/**
 * Check if the user is an admin
 */
export const isAdmin = defineField<User, NoArgs, boolean>(
  (parent) => (parent.role as unknown as string) === "ADMIN",
);
