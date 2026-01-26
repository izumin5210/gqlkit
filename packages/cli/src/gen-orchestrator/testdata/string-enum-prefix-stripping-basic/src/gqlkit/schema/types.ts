/**
 * User status enum with prefix matching enum name.
 */
export type UserStatus =
  | "USER_STATUS_ACTIVE"
  | "USER_STATUS_INACTIVE"
  | "USER_STATUS_PENDING";

export interface User {
  id: string;
  name: string;
  status: UserStatus;
}
