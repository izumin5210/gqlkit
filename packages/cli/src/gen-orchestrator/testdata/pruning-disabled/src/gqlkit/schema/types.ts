export interface User {
  id: string;
  name: string;
}

/**
 * Exported but never reachable from any root operation type.
 */
export interface AuditLog {
  id: string;
  message: string;
}
