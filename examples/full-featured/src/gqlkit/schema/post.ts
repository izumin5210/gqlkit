import type { GqlObject, IDString, NoArgs } from "@gqlkit-ts/runtime";
import type { Comment } from "./comment.js";
import { defineField, defineMutation, defineQuery } from "../gqlkit.js";
import type { Node, Timestamped } from "./node.js";
import type { DateTime } from "./scalars.js";
import type { PostStatus } from "./status.js";
import type { User } from "./user.js";

/**
 * A blog post.
 * Implements Node (identifiable) and Timestamped (has createdAt).
 */
export type Post = GqlObject<
  {
    /** Unique identifier for the post */
    id: IDString;
    /** Post title */
    title: string;
    /** Post content body */
    body: string;
    /** Publication status */
    status: PostStatus;
    /** Post author's ID */
    authorId: IDString;
    /** Tags associated with this post (may contain null for deleted tags) */
    tags: (string | null)[];
    /** When the post was published (null if draft) */
    publishedAt: DateTime | null;
    /** When the post was created */
    createdAt: DateTime;
  },
  { implements: [Node, Timestamped] }
>;

/** Input for creating a new post */
export interface CreatePostInput {
  title: string;
  body: string;
  tags: string[] | null;
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

/** Get all posts */
export const allPosts = defineQuery<NoArgs, Post[]>(() => posts);

/**
 * Get a post by ID
 */
export const post = defineQuery<{ id: string }, Post | null>(
  (_root, args) => posts.find((p) => p.id === args.id) ?? null,
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

/**
 * Get the author of this post
 */
export const author = defineField<Post, NoArgs, User | null>(
  (parent) => users.find((u) => u.id === parent.authorId) ?? null,
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
