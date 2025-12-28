import type { User } from "../types/user.js";
export type QueryResolver = {
    users: () => User[];
};
export declare const queryResolver: QueryResolver;
export type MutationResolver = {
    createUser: (args: {
        name: string;
        email: string;
    }) => User;
    updateUser: (args: {
        id: string;
        name: string | null;
    }) => User | null;
    deleteUser: (args: {
        id: string;
    }) => boolean;
};
export declare const mutationResolver: MutationResolver;
//# sourceMappingURL=user.d.ts.map