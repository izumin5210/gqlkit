/**
 * Post type with inline status enum that will generate PostStatus type.
 */
export type Post = {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
};

/**
 * Explicit PostStatus type that conflicts with auto-generated PostStatus enum.
 */
export type PostStatus = {
  code: string;
  label: string;
};
