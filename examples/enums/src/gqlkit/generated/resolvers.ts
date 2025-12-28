import { queryResolver } from "../../gql/resolvers/user.js";

export const resolvers = {
    Query: {
      user: queryResolver.user,
      users: queryResolver.users,
    },
} as const;
