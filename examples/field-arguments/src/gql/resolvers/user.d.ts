import type { User } from "../types/user.js";
export type QueryResolver = {
    user: (args: {
        id: string;
    }) => User | null;
    users: (args: {
        limit: number;
        offset: number | null;
    }) => User[];
    search: (args: {
        query: string;
        includeInactive: boolean | null;
    }) => User[];
};
export declare const queryResolver: QueryResolver;
//# sourceMappingURL=user.d.ts.map