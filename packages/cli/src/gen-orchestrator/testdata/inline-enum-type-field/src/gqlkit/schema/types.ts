export type Post = {
  id: string;
  title: string;
  /** Visibility level */
  visibility: "public" | "private" | "unlisted";
  /** Tags for the post (array of string literal union) */
  tags: ("tech" | "lifestyle" | "news")[];
  /** Categories with nullable elements */
  categories: ("blog" | "tutorial" | "review" | null)[];
  /** Optional status that can be null */
  status: "draft" | "published" | "archived" | null;
};
