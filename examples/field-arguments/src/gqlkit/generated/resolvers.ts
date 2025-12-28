import { queryResolver } from "../../gql/resolvers/user.js";

export const resolvers = {
    Query: {
      search: queryResolver.search,
      user: queryResolver.user,
      users: queryResolver.users,
    },
} as const;
