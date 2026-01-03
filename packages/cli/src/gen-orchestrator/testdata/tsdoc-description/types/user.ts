/**
 * A user in the system.
 */
export interface User {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Email address */
  email: string | null;
}
