import type { ExternalDate, ExternalTimestamp } from "../../external/types.js";

/**
 * Event type demonstrating external module type mapping.
 * ExternalDate and ExternalTimestamp are type aliases for Date,
 * so they should be mapped to DateTime scalar.
 */
export interface Event {
  id: string;
  name: string;
  /**
   * Uses ExternalDate from external module.
   * Since ExternalDate is a type alias for Date, and DateTime maps to Date,
   * this should be automatically mapped to DateTime.
   */
  createdAt: ExternalDate;
  /**
   * Uses ExternalTimestamp from external module.
   * Also a type alias for Date.
   */
  updatedAt: ExternalTimestamp | null;
  /**
   * Uses Date directly for comparison.
   */
  publishedAt: Date;
}
