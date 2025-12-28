export const queryResolver = {
    user: () => ({ id: "1", firstName: "Alice", lastName: "Smith" }),
};
export const userResolver = {
    fullName: (parent) => `${parent.firstName} ${parent.lastName}`,
    posts: (parent) => [
        { id: "1", title: "First Post", authorId: parent.id },
        { id: "2", title: "Second Post", authorId: parent.id },
    ],
};
//# sourceMappingURL=user.js.map