/**
 * User status enum with only some values having the prefix.
 * Prefix stripping should NOT be applied since not all values have the prefix.
 */
export type UserStatus =
  | "USER_STATUS_ACTIVE"
  | "USER_STATUS_INACTIVE"
  | "PENDING";

export interface User {
  id: string;
  name: string;
  status: UserStatus;
}
