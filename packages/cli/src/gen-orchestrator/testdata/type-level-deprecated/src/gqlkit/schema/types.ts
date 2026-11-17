import type {
  GqlInterface,
  GqlObject,
  IDString,
  NoArgs,
} from "@gqlkit-ts/runtime";
import { defineField, defineQuery, defineResolveType } from "../gqlkit.js";

/**
 * @deprecated
 */
export type Node = GqlInterface<{
  id: IDString;
}>;

export const nodeResolveType = defineResolveType<Node>(() => "User");

/**
 * A user in the system.
 *
 * @deprecated Use Account instead.
 */
export type User = GqlObject<
  {
    id: IDString;
    name: string;
    /**
     * @deprecated Use name instead.
     */
    displayName: string | null;
    status: UserStatus;
    role: Role;
  },
  { implements: [Node] }
>;

export type Post = {
  id: string;
  title: string;
};

export const posts = defineField<User, NoArgs, Post[]>(() => []);

/**
 * @deprecated Use AccountStatus instead.
 */
export type UserStatus = "ACTIVE" | "INACTIVE";

/**
 * @deprecated Use AccountRole instead.
 */
export enum Role {
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
}

/**
 * @deprecated Use AccountSearchResult instead.
 */
export type SearchResult = User | Post;

export const searchResultResolveType = defineResolveType<SearchResult>(
  () => "Post",
);

/**
 * @deprecated Use AccountInput instead.
 */
export type UserInput = {
  id: string;
  name: string | null;
};

export const user = defineQuery<{ input: UserInput }, User | null>(() => null);

export const search = defineQuery<NoArgs, SearchResult[]>(() => []);

export const node = defineQuery<NoArgs, Node | null>(() => null);
