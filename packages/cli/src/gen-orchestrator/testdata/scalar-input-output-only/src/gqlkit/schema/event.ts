/**
 * Event type using base type Date directly in output context.
 * Since DateTimeOutput is the only output scalar for Date,
 * Date should be automatically mapped to DateTimeOutput.
 */
export interface Event {
  id: string;
  name: string;
  /** Uses Date directly - should map to DateTimeOutput in output context */
  createdAt: Date;
  /** Nullable Date - should map to DateTimeOutput */
  updatedAt: Date | null;
}

/**
 * Input type using base type Date directly in input context.
 * Since DateTimeInput is the only input scalar for Date,
 * Date should be automatically mapped to DateTimeInput.
 */
export interface CreateEventInput {
  name: string;
  /** Uses Date directly in input - should map to DateTimeInput in input context */
  scheduledAt: Date;
}
