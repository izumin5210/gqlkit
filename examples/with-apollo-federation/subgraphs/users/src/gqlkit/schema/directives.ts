import type { GqlDirective } from "@gqlkit-ts/runtime";

/**
 * Marks a value that must not appear in logs. Composition keeps it in the
 * supergraph, where the gateway reads it to mask the value.
 */
export type RedactDirective = GqlDirective<
  "redact",
  Record<string, never>,
  ["ARGUMENT_DEFINITION", "FIELD_DEFINITION"]
>;
