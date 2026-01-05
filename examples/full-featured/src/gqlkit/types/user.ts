import type { IDString, Int } from "@gqlkit-ts/runtime";
import type { DateTime } from "../scalars.js";
import type { Role } from "./role.js";
import type { UserStatus } from "./status.js";

/**
 * A user in the system
 */
export interface User {
  /** Unique identifier for the user */
  id: IDString;
  /** User's display name */
  name: string;
  /** User's email address (null if not verified) */
  email: string | null;
  /** User's age in years */
  age: Int;
  /** Current account status */
  status: UserStatus;
  /** User's role */
  role: Role;
  /** When the user was created */
  createdAt: DateTime;
  /**
   * User's legacy username
   * @deprecated Use `name` field instead
   */
  username: string | null;
}

/** Input for creating a new user */
export interface CreateUserInput {
  name: string;
  email: string | null;
  age: Int;
  role: Role | null;
}

/** Input for updating user profile */
export interface UpdateUserInput {
  name: string | null;
  email: string | null;
  age: Int | null;
}
