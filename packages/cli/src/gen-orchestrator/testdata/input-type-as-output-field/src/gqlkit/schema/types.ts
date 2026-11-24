import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

export interface ActionInput {
  approve: string;
}

export interface Task {
  id: string;
  action: ActionInput;
}

/**
 * Object field whose type is an input type.
 * Input types can only be used in input positions, so generation
 * must fail with a diagnostic.
 */
export const tasks = defineQuery<NoArgs, Task[]>(() => []);

/**
 * Resolver whose return type is an input type.
 * Generation must fail with a diagnostic as well.
 */
export const action = defineQuery<NoArgs, ActionInput>(() => ({
  approve: "yes",
}));
