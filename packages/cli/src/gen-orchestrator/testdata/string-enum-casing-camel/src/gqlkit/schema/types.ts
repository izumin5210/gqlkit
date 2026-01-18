/**
 * User status enum with camelCase values.
 */
export type UserStatus = "active" | "inactive" | "pendingReview";

export interface User {
  id: string;
  name: string;
  status: UserStatus;
}
