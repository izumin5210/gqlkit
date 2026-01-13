/**
 * Numeric enum with duplicate values.
 * This should produce an error.
 */
export enum Status {
  ACTIVE = 0,
  INACTIVE = 1,
  PENDING = 0,
}

export interface User {
  id: string;
  name: string;
  status: Status;
}
