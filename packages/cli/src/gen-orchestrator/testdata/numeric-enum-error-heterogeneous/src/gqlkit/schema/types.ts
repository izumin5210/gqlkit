/**
 * Heterogeneous enum mixing numeric and string values.
 * This should produce an error.
 */
export enum MixedStatus {
  ACTIVE = 0,
  INACTIVE = "inactive",
  PENDING = 2,
}

export interface User {
  id: string;
  name: string;
  status: MixedStatus;
}
