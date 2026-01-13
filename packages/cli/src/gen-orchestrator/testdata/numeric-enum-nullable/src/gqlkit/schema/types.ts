/**
 * User status enum with numeric values.
 */
export enum UserStatus {
  ACTIVE = 0,
  INACTIVE = 1,
  PENDING = 2,
}

export interface User {
  id: string;
  name: string;
  /** Status can be null */
  status: UserStatus | null;
}
