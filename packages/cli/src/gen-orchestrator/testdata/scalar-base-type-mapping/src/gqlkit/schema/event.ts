/**
 * Event type using base type Date directly instead of DateTime scalar.
 * The Date type should be automatically mapped to DateTime scalar.
 */
export interface Event {
  id: string;
  name: string;
  /** Uses Date directly - should map to DateTime */
  createdAt: Date;
  /** Nullable Date - should map to DateTime */
  updatedAt: Date | null;
}

/**
 * Input type using base type Date directly.
 */
export interface CreateEventInput {
  name: string;
  /** Uses Date directly in input - should map to DateTime */
  scheduledAt: Date;
}
