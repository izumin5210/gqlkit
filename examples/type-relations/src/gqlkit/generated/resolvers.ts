import { queryResolver } from "../../gql/resolvers/post.js";

export const resolvers = {
    Query: {
      posts: queryResolver.posts,
      user: queryResolver.user,
      users: queryResolver.users,
    },
} as const;
