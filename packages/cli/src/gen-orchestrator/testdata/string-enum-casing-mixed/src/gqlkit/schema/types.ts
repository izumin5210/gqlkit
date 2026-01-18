/**
 * User status enum with mixed casing values.
 */
export type UserStatus = "active" | "InActive" | "pending_review" | "on-hold";

export interface User {
  id: string;
  name: string;
  status: UserStatus;
}
