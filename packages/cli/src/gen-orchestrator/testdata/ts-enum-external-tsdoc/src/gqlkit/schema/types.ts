import type { PostVisibility, UserStatus } from "../../external/enums.js";
import { defineQuery } from "../gqlkit.js";

export type Post = {
  id: string;
  title: string;
  visibility: PostVisibility;
};

export type User = {
  id: string;
  name: string;
  status: UserStatus;
};

export type Comment = {
  id: string;
  content: string;
  visibility: PostVisibility;
};

export const getPost = defineQuery<{ id: string }, Post | null>(
  (_root, _args) => null,
);

export const getUser = defineQuery<{ id: string }, User | null>(
  (_root, _args) => null,
);

export const getComment = defineQuery<{ id: string }, Comment | null>(
  (_root, _args) => null,
);
