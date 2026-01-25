import type { GqlObject, IDString } from "@gqlkit-ts/runtime";

/**
 * A user with a single internal field excluded from GraphQL schema.
 */
export type User = GqlObject<
  {
    id: IDString;
    name: string;
    email: string | null;
    internalId: string;
  },
  { ignoreFields: "internalId" }
>;
