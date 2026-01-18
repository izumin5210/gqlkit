/**
 * Status enum with values that will collide after SCREAMING_SNAKE_CASE conversion.
 */
export type Status = "activeUser" | "active_user" | "pending";

export interface User {
  id: string;
  name: string;
  status: Status;
}
