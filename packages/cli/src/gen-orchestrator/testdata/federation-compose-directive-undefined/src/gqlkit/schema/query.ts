import type { IDString } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

export type User = {
  id: IDString;
};

/**
 * composeDirectives imports `@redact`, but no GqlDirective defines it, so
 * the subgraph would link a directive it cannot apply.
 */
export const user = defineQuery<{ id: IDString }, User | null>(() => null);
