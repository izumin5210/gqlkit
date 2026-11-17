import type { GqlField, IDString } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { RedactDirective } from "./directives.js";

export type Post = {
  id: IDString;
  title: string;
  authorId: IDString;
};

const allPosts: Post[] = [
  { id: "p1" as IDString, title: "Hello", authorId: "u1" as IDString },
  { id: "p2" as IDString, title: "World", authorId: "u2" as IDString },
];

export const posts = defineQuery<
  {
    /** A free-text query that may contain personal data. */
    search: GqlField<string | null, { directives: [RedactDirective] }>;
  },
  Post[]
>((_root, args) =>
  allPosts.filter((p) => args.search === null || p.title.includes(args.search)),
);
