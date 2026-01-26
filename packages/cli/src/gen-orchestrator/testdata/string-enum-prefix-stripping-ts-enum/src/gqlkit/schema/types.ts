/**
 * User status enum using TypeScript string enum with prefix values.
 */
export enum UserStatus {
  Active = "USER_STATUS_ACTIVE",
  Inactive = "USER_STATUS_INACTIVE",
  Pending = "USER_STATUS_PENDING",
}

export interface User {
  id: string;
  name: string;
  status: UserStatus;
}
