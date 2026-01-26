/**
 * Simple status enum with single word name.
 */
export type Status =
  | "STATUS_ACTIVE"
  | "STATUS_INACTIVE"
  | "STATUS_PENDING";

export interface Task {
  id: string;
  title: string;
  status: Status;
}
