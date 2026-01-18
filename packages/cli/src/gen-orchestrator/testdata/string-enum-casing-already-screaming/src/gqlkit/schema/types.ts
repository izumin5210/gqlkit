/**
 * User status enum already in SCREAMING_SNAKE_CASE.
 * No mapping should be generated.
 */
export type UserStatus = "ACTIVE" | "INACTIVE" | "PENDING_REVIEW";

export interface User {
  id: string;
  name: string;
  status: UserStatus;
}
