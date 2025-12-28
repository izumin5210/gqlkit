import { Status } from "../types/status.js";
export const queryResolver = {
    user: () => ({
        id: "1",
        name: "Alice",
        status: Status.Active,
        role: "admin",
    }),
    users: () => [
        { id: "1", name: "Alice", status: Status.Active, role: "admin" },
        { id: "2", name: "Bob", status: Status.Pending, role: "user" },
        { id: "3", name: "Charlie", status: Status.Inactive, role: "guest" },
    ],
};
//# sourceMappingURL=user.js.map