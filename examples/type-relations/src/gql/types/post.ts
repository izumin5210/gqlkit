import type { User } from "./user.js";

export interface Post {
  id: string;
  title: string;
  content: string;
  author: User | null;
}
