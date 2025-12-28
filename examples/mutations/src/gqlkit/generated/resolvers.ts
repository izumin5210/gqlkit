import { mutationResolver, queryResolver } from "../../gql/resolvers/user.js";

export const resolvers = {
    Mutation: {
      createUser: mutationResolver.createUser,
      deleteUser: mutationResolver.deleteUser,
      updateUser: mutationResolver.updateUser,
    },
    Query: {
      users: queryResolver.users,
    },
} as const;
