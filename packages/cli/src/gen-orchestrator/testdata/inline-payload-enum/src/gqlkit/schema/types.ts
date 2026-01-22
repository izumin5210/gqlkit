import { defineField, defineMutation, defineQuery, type NoArgs } from "../gqlkit.js";

/**
 * Task type for field resolver test
 */
export type Task = {
  id: string;
  title: string;
};

/**
 * Query to fetch tasks
 */
export const tasks = defineQuery<NoArgs, Task[]>(() => []);

/**
 * Query returning string literal union as enum payload.
 * Expected generated type: GetStatusPayload (GraphQL Enum)
 * Tests requirement 4.1 (enum detection) and 4.2 (query naming)
 */
export const getStatus = defineQuery<
  NoArgs,
  "active" | "inactive" | "pending"
>(() => "active");

/**
 * Mutation returning string literal union as enum payload.
 * Expected generated type: UpdateStatusPayload (GraphQL Enum)
 * Tests requirement 4.2 (mutation naming) and 4.4 (SCREAMING_SNAKE_CASE)
 */
export const updateStatus = defineMutation<
  { status: string },
  "success" | "failure" | "partialSuccess"
>((_root, _args) => "success");

/**
 * Field resolver on Task returning string literal union.
 * Expected generated type: TaskPriorityPayload (GraphQL Enum)
 * Tests requirement 4.3 (field resolver naming)
 */
export const priority = defineField<
  Task,
  NoArgs,
  "low" | "medium" | "high" | "critical"
>(() => "medium");

/**
 * Nullable enum payload test - Query returning nullable string literal union.
 * Expected generated type: GetLevelPayload (GraphQL Enum, nullable)
 */
export const getLevel = defineQuery<
  { id: string },
  "beginner" | "intermediate" | "advanced" | null
>((_root, _args) => null);

/**
 * Query with various naming formats to test SCREAMING_SNAKE_CASE conversion.
 * Expected generated type: GetFormatsPayload (GraphQL Enum)
 * Tests requirement 4.4 (SCREAMING_SNAKE_CASE conversion from various formats)
 */
export const getFormats = defineQuery<
  NoArgs,
  | "simpleWord"
  | "twoWords"
  | "THREE_WORDS"
  | "kebab-case-value"
  | "snake_case_value"
  | "MixedCASE"
>(() => "simpleWord");
