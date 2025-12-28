export const queryResolver = {
    users: () => [
        { id: "1", name: "Alice", email: "alice@example.com" },
        { id: "2", name: "Bob", email: "bob@example.com" },
    ],
};
export const mutationResolver = {
    createUser: (args) => ({
        id: crypto.randomUUID(),
        name: args.name,
        email: args.email,
    }),
    updateUser: (args) => ({
        id: args.id,
        name: args.name ?? "Unknown",
        email: "updated@example.com",
    }),
    deleteUser: () => true,
};
//# sourceMappingURL=user.js.map