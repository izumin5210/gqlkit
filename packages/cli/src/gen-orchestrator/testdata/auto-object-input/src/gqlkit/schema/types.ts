import type { GqlFieldDef, Int } from "@gqlkit-ts/runtime";

/**
 * Input for creating a new user
 */
export type CreateUserInput = {
  name: string;
  email: string;
  /** Profile information */
  profile: {
    /** User biography */
    bio: string | null;
    /** User's age with default value */
    age: GqlFieldDef<Int | null, { defaultValue: 18 }>;
  };
};
