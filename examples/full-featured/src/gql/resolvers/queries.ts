import { defineQuery, type NoArgs } from "../gqlkit.js";
import type { SearchResult } from "../types/content.js";
import type { Post } from "../types/post.js";
import type { User } from "../types/user.js";

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

const posts: Post[] = [
  {
    id: "1" as Post["id"],
    title: "Hello World",
    body: "This is my first post",
    status: "PUBLISHED" as unknown as Post["status"],
    authorId: "1" as Post["authorId"],
    tags: ["intro", "hello"],
    publishedAt: "2024-01-15T10:00:00Z" as Post["publishedAt"],
    createdAt: "2024-01-15T09:00:00Z" as Post["createdAt"],
  },
  {
    id: "2" as Post["id"],
    title: "Draft Post",
    body: "Work in progress",
    status: "DRAFT" as unknown as Post["status"],
    authorId: "1" as Post["authorId"],
    tags: ["draft", null],
    publishedAt: null,
    createdAt: "2024-02-01T08:00:00Z" as Post["createdAt"],
  },
];

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

/** Get all posts */
export const allPosts = defineQuery<NoArgs, Post[]>(() => posts);

/**
 * Get a post by ID
 */
export const post = defineQuery<{ id: string }, Post | null>(
  (_root, args) => posts.find((p) => p.id === args.id) ?? null,
);

/**
 * Search for content (posts and comments)
 */
export const search = defineQuery<{ query: string }, SearchResult[]>(
  (_root, args) => {
    const q = args.query.toLowerCase();
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q),
    );
  },
);
