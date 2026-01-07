import type { IDString, WithDirectives } from "@gqlkit-ts/runtime";
import type { CacheDirective } from "./directives.js";

export interface User {
  id: IDString;
  name: string;
}

export type CachedUser = WithDirectives<User, [CacheDirective<{ maxAge: 3600 }>]>;
