/**
 * User status enum using TypeScript string enum.
 */
export enum UserStatus {
  /** The user is currently active */
  Active = "active",
  /** The user is inactive */
  Inactive = "inactive",
  /** @deprecated Use Active instead */
  PendingReview = "pendingReview",
}

export interface User {
  id: string;
  name: string;
  status: UserStatus;
}
