import type { GqlObject, IDString } from "@gqlkit-ts/runtime";

/**
 * A user with some internal fields excluded from GraphQL schema.
 */
export type User = GqlObject<
  {
    id: IDString;
    name: string;
    email: string | null;
    internalId: string;
    cacheKey: string;
  },
  { ignoreFields: "internalId" | "cacheKey" }
>;
