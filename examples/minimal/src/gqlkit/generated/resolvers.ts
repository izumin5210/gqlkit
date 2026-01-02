import { allUsers, user } from "../../gql/resolvers/user.js";

export const resolvers = {
    Query: {
      allUsers: allUsers,
      user: user,
    },
} as const;
