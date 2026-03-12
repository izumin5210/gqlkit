import type { NoArgs } from "@gqlkit-ts/runtime";
import type { ToolPart } from "../../external-lib.js";
import { defineQuery } from "../gqlkit.js";

/**
 * Test case: inline object properties shared across union members
 *
 * When TypeScript resolves types from .d.ts files, it may share the same
 * type object for structurally identical anonymous inline types across
 * multiple intersection members of a union (e.g., `input: { query: string }`
 * appears in all three states).
 *
 * This sharing causes false-positive cycle detection in the visitedTypes
 * WeakSet: the first union member adds the type, and subsequent members
 * see it as "already visited" and skip it — dropping the field entirely.
 *
 * Expected: all ToolSearch* members should have an `input` field.
 */

export type Container = {
  id: string;
  parts: ToolPart[];
};

export const container = defineQuery<NoArgs, Container>(() => ({
  id: "1",
  parts: [{ type: "text", content: "hello" }],
}));
