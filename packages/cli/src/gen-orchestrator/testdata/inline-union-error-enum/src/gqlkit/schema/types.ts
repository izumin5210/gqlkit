/**
 * Status enum
 */
export type Status = "active" | "inactive" | "pending";

/**
 * User type
 */
export type User = {
  id: string;
  name: string;
};

/**
 * Container with invalid inline union containing enum type.
 * GraphQL unions cannot contain enums.
 */
export type Container = {
  id: string;
  /**
   * Invalid union with enum - should error
   */
  item: User | Status;
};

/**
 * TypeScript enum for testing
 */
export enum Priority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

/**
 * Another container with TypeScript enum in union.
 */
export type PriorityContainer = {
  id: string;
  /**
   * Invalid union with TypeScript enum - should error
   */
  priority: User | Priority;
};
