import { createPost, createUser, deleteUser, updateUser } from "../../gql/resolvers/mutations.js";
import { author, comments, excerpt, isPublished } from "../../gql/resolvers/post-fields.js";
import { allPosts, allUsers, me, post, search, user, users_ } from "../../gql/resolvers/queries.js";
import { displayName, isAdmin, postCount, posts } from "../../gql/resolvers/user-fields.js";

export const resolvers = {
    Mutation: {
      createPost: createPost,
      createUser: createUser,
      deleteUser: deleteUser,
      updateUser: updateUser,
    },
    Post: {
      author: author,
      comments: comments,
      excerpt: excerpt,
      isPublished: isPublished,
    },
    Query: {
      allPosts: allPosts,
      allUsers: allUsers,
      me: me,
      post: post,
      search: search,
      user: user,
      users_: users_,
    },
    User: {
      displayName: displayName,
      isAdmin: isAdmin,
      postCount: postCount,
      posts: posts,
    },
} as const;
