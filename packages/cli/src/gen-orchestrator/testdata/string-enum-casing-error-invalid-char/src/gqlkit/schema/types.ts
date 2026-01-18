/**
 * Status enum with invalid characters that cannot be converted to GraphQL identifiers.
 */
export type Status = "active" | "@invalid" | "pending";

export interface User {
  id: string;
  name: string;
  status: Status;
}
