import { defineMutation } from "../gqlkit.js";
import type { CreatePostInput, Post } from "../types/post.js";
import type { CreateUserInput, UpdateUserInput, User } from "../types/user.js";

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
 * Create a new post
 */
export const createPost = defineMutation<{ input: CreatePostInput }, Post>(
  (_root, args, ctx) => ({
    id: crypto.randomUUID() as Post["id"],
    title: args.input.title,
    body: args.input.body,
    status: "DRAFT" as unknown as Post["status"],
    authorId: (ctx.currentUserId ?? "anonymous") as Post["authorId"],
    tags: args.input.tags ?? [],
    publishedAt: null,
    createdAt: new Date().toISOString() as Post["createdAt"],
  }),
);
