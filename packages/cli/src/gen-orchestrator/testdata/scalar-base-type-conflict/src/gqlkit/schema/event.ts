/**
 * Event type using base type Date directly.
 * Since both DateTime and ISODate use Date as base type,
 * this should cause an ambiguous scalar base type error.
 */
export interface Event {
  id: string;
  name: string;
  /**
   * Uses Date directly - should cause AMBIGUOUS_SCALAR_BASE_TYPE error
   * because both DateTime and ISODate map to Date.
   */
  createdAt: Date;
}
