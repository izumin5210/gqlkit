/**
 * User status enum with snake_case values.
 */
export type UserStatus = "active" | "inactive" | "pending_review";

export interface User {
  id: string;
  name: string;
  status: UserStatus;
}
