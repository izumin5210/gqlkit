import type { GqlField, GqlObject, IDString, NoArgs } from "@gqlkit-ts/runtime";
import { defineField, defineQuery } from "../gqlkit.js";
import type { RedactDirective } from "./directives.js";
import type { User } from "./user.js";

export type Post = GqlObject<
  {
    id: IDString;
    title: string;
    authorId: IDString;
  },
  { ignoreFields: "authorId" }
>;

const allPosts: Post[] = [
  { id: "p1" as IDString, title: "Hello", authorId: "u1" as IDString },
  { id: "p2" as IDString, title: "World", authorId: "u2" as IDString },
];

export const author = defineField<Post, NoArgs, User>((post) => ({
  id: post.authorId,
}));

export const posts = defineQuery<
  {
    /** A free-text query that may contain personal data. */
    search: GqlField<string | null, { directives: [RedactDirective] }>;
  },
  Post[]
>((_root, args) =>
  allPosts.filter((p) => args.search === null || p.title.includes(args.search)),
);
