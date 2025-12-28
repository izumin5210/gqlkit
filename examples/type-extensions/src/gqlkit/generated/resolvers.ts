import { queryResolver } from "../../gql/resolvers/post.js";
import { userResolver } from "../../gql/resolvers/user.js";

export const resolvers = {
    Query: {
      posts: queryResolver.posts,
      user: queryResolver.user,
    },
    User: {
      fullName: userResolver.fullName,
      posts: userResolver.posts,
    },
} as const;
