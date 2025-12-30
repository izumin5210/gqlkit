import { createUser, deleteUser, updateUser, users } from "../../gql/resolvers/user.js";

export const resolvers = {
    Mutation: {
      createUser: createUser,
      deleteUser: deleteUser,
      updateUser: updateUser,
    },
    Query: {
      users: users,
    },
} as const;
