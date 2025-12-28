export const queryResolver = {
    user: () => ({ id: "1", name: "Alice", age: 30, isActive: true }),
    users: () => [
        { id: "1", name: "Alice", age: 30, isActive: true },
        { id: "2", name: "Bob", age: 25, isActive: false },
    ],
};
//# sourceMappingURL=user.js.map