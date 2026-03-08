/**
 * @fileoverview Tests inline enums and inline unions inside inline union members.
 *
 * Verifies that inline types (enums, unions, arrays) nested within __typename-bearing
 * union members are properly resolved to auto-generated types (not left as sentinels).
 *
 * Scenarios:
 * - Direct inline enum field in union member
 * - Inline enum nested within a nested inline object in union member
 * - Array of inline enum in union member
 * - Inline union (reference types) in union member
 */
import { defineQuery, type NoArgs } from "../gqlkit.js";

export type User = {
  id: string;
  name: string;
};

export type Bot = {
  id: string;
  platform: string;
};

/**
 * Query returning a union where members contain various inline types.
 * Expected generated types:
 * - SuccessResult.status → SuccessResultStatus enum (ACTIVE, INACTIVE, PENDING)
 * - SuccessResult.metadata → SuccessResultMetadata object
 * - SuccessResultMetadata.priority → SuccessResultMetadataPriority enum (LOW, MEDIUM, HIGH)
 * - ErrorResult.severity → ErrorResultSeverity enum (WARNING, ERROR, CRITICAL)
 * - ErrorResult.tags → [ErrorResultTags!]! enum (BUG, REGRESSION, PERFORMANCE)
 * - InfoResult.creator → InfoResultCreator union (User | Bot)
 */
export const result = defineQuery<
  NoArgs,
  | {
      __typename: "SuccessResult";
      value: string;
      status: "active" | "inactive" | "pending";
      metadata: {
        score: number;
        priority: "low" | "medium" | "high";
      };
    }
  | {
      __typename: "ErrorResult";
      message: string;
      severity: "warning" | "error" | "critical";
      tags: ("bug" | "regression" | "performance")[];
    }
  | {
      __typename: "InfoResult";
      description: string;
      creator: User | Bot;
    }
>(() => ({
  __typename: "SuccessResult" as const,
  value: "ok",
  status: "active" as const,
  metadata: {
    score: 100,
    priority: "high" as const,
  },
}));
