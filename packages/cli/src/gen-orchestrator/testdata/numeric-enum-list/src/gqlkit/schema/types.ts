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
  /** List of statuses */
  statuses: UserStatus[];
  /** Nullable list of statuses */
  nullableStatuses: UserStatus[] | null;
}
