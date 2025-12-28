export const queryResolver = {
    user: (args) => ({ id: args.id, name: "User" }),
    users: (args) => {
        const users = [
            { id: "1", name: "Alice" },
            { id: "2", name: "Bob" },
            { id: "3", name: "Charlie" },
        ];
        const offset = args.offset ?? 0;
        return users.slice(offset, offset + args.limit);
    },
    search: (args) => {
        const users = [
            { id: "1", name: "Alice" },
            { id: "2", name: "Bob" },
        ];
        return users.filter((u) => u.name.toLowerCase().includes(args.query.toLowerCase()));
    },
};
//# sourceMappingURL=user.js.map