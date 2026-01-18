/**
 * User status enum with kebab-case values.
 */
export type UserStatus = "active" | "inactive" | "pending-review";

export interface User {
  id: string;
  name: string;
  status: UserStatus;
}
