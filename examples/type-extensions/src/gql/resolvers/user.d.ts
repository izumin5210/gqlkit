import type { User } from "../types/user.js";
import type { Post } from "../types/post.js";
export type QueryResolver = {
    user: () => User;
};
export declare const queryResolver: QueryResolver;
export type UserResolver = {
    fullName: (parent: User) => string;
    posts: (parent: User) => Post[];
};
export declare const userResolver: UserResolver;
//# sourceMappingURL=user.d.ts.map