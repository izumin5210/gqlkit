import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineField, defineQuery } from "../gqlkit.js";

export interface Post {
  id: string;
}

// Not exported: the resolvers below are what make these schema types.
interface Author {
  name: string;
  // Reached only through Author's field.
  profile: Profile;
}

interface Profile {
  bio: string;
}

interface PostStats {
  views: number;
}

export const posts = defineQuery<NoArgs, Post[]>(() => []);

export const latestAuthor = defineQuery<NoArgs, Author | null>(() => null);

export const authors = defineQuery<NoArgs, Author[]>(() => []);

export const stats = defineField<Post, NoArgs, PostStats>(() => ({
  views: 0,
}));
