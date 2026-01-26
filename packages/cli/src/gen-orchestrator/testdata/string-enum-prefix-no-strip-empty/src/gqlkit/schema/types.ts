/**
 * User status enum where one value would become empty after prefix removal.
 * Prefix stripping should NOT be applied since removing the prefix from
 * "USER_STATUS_" would result in an empty string.
 */
export type UserStatus =
  | "USER_STATUS_ACTIVE"
  | "USER_STATUS_INACTIVE"
  | "USER_STATUS_";

export interface User {
  id: string;
  name: string;
  status: UserStatus;
}
