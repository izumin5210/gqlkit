import type { AppDate, MyDate, Timestamp } from "../../common/types.js";

/**
 * Event type demonstrating type alias chain resolution.
 * All date-like type aliases should resolve to DateTime scalar.
 */
export interface Event {
  id: string;
  name: string;
  /**
   * Uses Timestamp (1 level: Timestamp -> Date).
   * Should be mapped to DateTime.
   */
  createdAt: Timestamp;
  /**
   * Uses MyDate (2 levels: MyDate -> Timestamp -> Date).
   * Should be mapped to DateTime.
   */
  updatedAt: MyDate | null;
  /**
   * Uses AppDate (3 levels: AppDate -> MyDate -> Timestamp -> Date).
   * Should be mapped to DateTime.
   */
  publishedAt: AppDate;
  /**
   * Uses Date directly for comparison.
   * Should be mapped to DateTime.
   */
  archivedAt: Date | null;
}
