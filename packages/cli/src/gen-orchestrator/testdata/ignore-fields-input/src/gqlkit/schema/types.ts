import type { GqlObject, IDString } from "@gqlkit-ts/runtime";

/**
 * Input for creating a user with internal fields excluded from GraphQL schema.
 */
export type CreateUserInput = GqlObject<
  {
    name: string;
    email: string;
    internalData: string;
    trackingId: string;
  },
  { ignoreFields: "internalData" | "trackingId" }
>;

/**
 * A user in the system.
 */
export type User = GqlObject<{
  id: IDString;
  name: string;
  email: string;
}>;
