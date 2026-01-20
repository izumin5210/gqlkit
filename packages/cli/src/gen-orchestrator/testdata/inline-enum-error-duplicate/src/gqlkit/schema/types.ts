/**
 * Post type with inline enum that has duplicate values after SCREAMING_SNAKE_CASE conversion.
 */
export type Post = {
  id: string;
  title: string;
  status: "activeUser" | "active_user" | "pending";
};
