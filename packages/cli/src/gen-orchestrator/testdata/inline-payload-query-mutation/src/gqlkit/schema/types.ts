import { defineMutation, defineQuery, type NoArgs } from "../gqlkit.js";

export type User = {
  id: string;
  name: string;
};

export type Post = {
  id: string;
  title: string;
};

/**
 * Query returning inline object with Non-Null fields.
 * Generated type: GetUserPayload
 */
export const getUser = defineQuery<
  { id: string },
  {
    user: User;
    found: boolean;
  }
>((_root, _args) => ({
  user: { id: "1", name: "Test" },
  found: true,
}));

/**
 * Query returning inline object with nullable field.
 * Generated type: GetUserOrNullPayload
 */
export const getUserOrNull = defineQuery<
  { id: string },
  {
    user: User | null;
    message: string;
  }
>((_root, _args) => ({
  user: null,
  message: "Not found",
}));

/**
 * Mutation returning inline object with list fields.
 * Generated type: CreateUsersPayload
 */
export const createUsers = defineMutation<
  { names: string[] },
  {
    users: User[];
    count: number;
  }
>((_root, args) => ({
  users: args.names.map((name, i) => ({ id: `${i}`, name })),
  count: args.names.length,
}));

/**
 * Mutation returning inline object with nullable list and list of nullable items.
 * Generated type: UpdatePostsPayload
 */
export const updatePosts = defineMutation<
  { ids: string[] },
  {
    posts: (Post | null)[];
    failedIds: string[] | null;
  }
>((_root, _args) => ({
  posts: [],
  failedIds: null,
}));

/**
 * Query returning inline object without args (NoArgs).
 * Generated type: GetHealthPayload
 */
export const getHealth = defineQuery<
  NoArgs,
  {
    status: string;
    uptime: number;
  }
>(() => ({
  status: "ok",
  uptime: 12345,
}));
