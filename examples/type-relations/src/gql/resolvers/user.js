export const queryResolver = {
    user: () => ({
        id: "1",
        name: "Alice",
        email: null,
        posts: [
            { id: "1", title: "Hello World", content: "First post", author: null },
        ],
    }),
    users: () => [],
};
//# sourceMappingURL=user.js.map