/**
 * DataLoader-shaped stubs the agent must wire through GraphQL context.
 *
 * The bodies throw so callers can't accidentally pass tests by bypassing
 * the loader plumbing. EVAL.ts checks the generated resolvers actually
 * invoke these loaders.
 */

import type { DbPost, DbUser } from "./db-schema.js";

export interface Loader<K, V> {
  load(key: K): Promise<V>;
  loadMany(keys: readonly K[]): Promise<V[]>;
}

export type UserByIdLoader = Loader<string, DbUser>;
export type PostsByUserIdLoader = Loader<string, DbPost[]>;

export function createUserByIdLoader(): UserByIdLoader {
  return {
    load() {
      throw new Error(
        "UserByIdLoader is a fixture stub — wire it via Context.",
      );
    },
    loadMany() {
      throw new Error(
        "UserByIdLoader is a fixture stub — wire it via Context.",
      );
    },
  };
}

export function createPostsByUserIdLoader(): PostsByUserIdLoader {
  return {
    load() {
      throw new Error(
        "PostsByUserIdLoader is a fixture stub — wire it via Context.",
      );
    },
    loadMany() {
      throw new Error(
        "PostsByUserIdLoader is a fixture stub — wire it via Context.",
      );
    },
  };
}

export interface Context {
  loaders: {
    userById: UserByIdLoader;
    postsByUserId: PostsByUserIdLoader;
  };
  viewerId: string | null;
}
