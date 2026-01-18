/**
 * Type alias chain demonstration.
 * These types form a chain of aliases all resolving to Date:
 * MyDate -> Timestamp -> Date
 */

/** First level alias: Timestamp = Date */
export type Timestamp = Date;

/** Second level alias: MyDate = Timestamp = Date */
export type MyDate = Timestamp;

/** Third level alias: AppDate = MyDate = Timestamp = Date */
export type AppDate = MyDate;
