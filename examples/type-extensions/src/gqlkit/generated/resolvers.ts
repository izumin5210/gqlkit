import { posts } from "../../gql/resolvers/post.js";
import { fullName, user, userPosts } from "../../gql/resolvers/user.js";

export const resolvers = {
    Query: {
      posts: posts,
      user: user,
    },
    User: {
      fullName: fullName,
      userPosts: userPosts,
    },
} as const;
