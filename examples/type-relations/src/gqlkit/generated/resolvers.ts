import { posts } from "../../gql/resolvers/post.js";
import { user, users } from "../../gql/resolvers/user.js";

export const resolvers = {
    Query: {
      posts: posts,
      user: user,
      users: users,
    },
} as const;
