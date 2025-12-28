import type { User } from "../types/user.js";
export type QueryResolver = {
    user: () => User | null;
    users: () => User[];
};
export declare const queryResolver: QueryResolver;
//# sourceMappingURL=user.d.ts.map