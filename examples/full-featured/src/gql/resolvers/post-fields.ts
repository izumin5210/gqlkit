import { defineField, type NoArgs } from "../gqlkit.js";
import type { Comment } from "../types/comment.js";
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
];

const commentsByPost: Record<string, Comment[]> = {
  "1": [
    {
      id: "c1" as Comment["id"],
      body: "Great post!",
      postId: "1" as Comment["postId"],
      authorId: "2" as Comment["authorId"],
      createdAt: "2024-01-16T10:00:00Z" as Comment["createdAt"],
      replies: [
        {
          id: "c2" as Comment["id"],
          body: "Thanks!",
          postId: "1" as Comment["postId"],
          authorId: "1" as Comment["authorId"],
          createdAt: "2024-01-16T11:00:00Z" as Comment["createdAt"],
          replies: [],
        },
      ],
    },
  ],
};

/**
 * Get the author of this post
 */
export const author = defineField<Post, NoArgs, User | null>((parent) =>
  users.find((u) => u.id === parent.authorId) ?? null,
);

/**
 * Get comments on this post with optional pagination
 */
export const comments = defineField<
  Post,
  { limit: number | null; includeReplies: boolean | null },
  Comment[]
>((parent, args) => {
  let result = commentsByPost[parent.id] ?? [];
  if (!args.includeReplies) {
    result = result.map((c) => ({ ...c, replies: [] }));
  }
  if (args.limit) {
    result = result.slice(0, args.limit);
  }
  return result;
});

/**
 * Get the excerpt of the post body
 */
export const excerpt = defineField<Post, { length: number | null }, string>(
  (parent, args) => {
    const len = args.length ?? 100;
    if (parent.body.length <= len) return parent.body;
    return `${parent.body.slice(0, len)}...`;
  },
);

/**
 * Check if the post is published
 */
export const isPublished = defineField<Post, NoArgs, boolean>(
  (parent) => (parent.status as unknown as string) === "PUBLISHED",
);
