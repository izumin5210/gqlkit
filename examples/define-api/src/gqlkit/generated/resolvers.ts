import { createUser } from "../../gql/resolvers/mutations.js";
import { allUsers, me, user } from "../../gql/resolvers/queries.js";
import { displayName, posts_ } from "../../gql/resolvers/user-fields.js";

export const resolvers = {
  Mutation: {
    createUser: createUser,
  },
  Query: {
    allUsers: allUsers,
    me: me,
    user: user,
  },
  User: {
    displayName: displayName,
    posts_: posts_,
  },
} as const;
