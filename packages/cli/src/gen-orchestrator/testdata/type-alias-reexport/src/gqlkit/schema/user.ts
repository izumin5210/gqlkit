// Re-export ExternalUser as User for schema
import type { ExternalUser } from "../../external/types.js";

/**
 * Schema User - re-exported from external package.
 * The underlying type is the same as ExternalUser.
 */
export type User = ExternalUser;
