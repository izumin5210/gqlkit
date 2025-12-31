import { user, users } from "../../gql/resolvers/user.js";

export const resolvers = {
  Query: {
    user: user,
    users: users,
  },
} as const;
