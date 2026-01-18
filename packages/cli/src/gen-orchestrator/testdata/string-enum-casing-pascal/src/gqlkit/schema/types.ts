/**
 * User status enum with PascalCase values.
 */
export type UserStatus = "Active" | "Inactive" | "PendingReview";

export interface User {
  id: string;
  name: string;
  status: UserStatus;
}
