import { defineField, type NoArgs } from "../gqlkit.js";
import type { Post } from "../types/post.js";
import type { User } from "../types/user.js";

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

/**
 * Get posts authored by this user
 */
export const posts = defineField<User, NoArgs, Post[]>((parent) =>
  postsByAuthor[parent.id] ?? [],
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
