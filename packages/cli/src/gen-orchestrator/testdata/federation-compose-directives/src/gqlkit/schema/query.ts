import type { GqlDirective, GqlField, IDString } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

/** Marks a value that must not appear in logs. */
export type RedactDirective = GqlDirective<
  "redact",
  Record<string, never>,
  ["ARGUMENT_DEFINITION", "FIELD_DEFINITION"]
>;

/**
 * Not listed in composeDirectives, so composition drops it from the
 * supergraph; it still gets a definition in the subgraph schema.
 */
export type TraceDirective = GqlDirective<
  "trace",
  Record<string, never>,
  "FIELD_DEFINITION"
>;

export type User = {
  id: IDString;
  email: GqlField<string, { directives: [RedactDirective] }>;
};

export const user = defineQuery<
  {
    id: IDString;
    token: GqlField<string | null, { directives: [RedactDirective] }>;
  },
  User | null,
  [TraceDirective]
>(() => null);
