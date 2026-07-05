import type { GqlDirective } from "@gqlkit-ts/runtime";

/**
 * Test case: a directive argument type that cannot be resolved to a
 * GraphQL type. `value: unknown` cannot be converted by
 * convertToGraphQLType (directive-definition-extractor.ts), so directive
 * definition extraction reports UNRESOLVABLE_ARG_TYPE (severity: error).
 * This should abort generation (bug #4), but the error was only printed
 * while typeDefs/schema/resolvers were still written.
 */
export type UnresolvableArgsDirective<TArgs extends { value: unknown }> =
  GqlDirective<"unresolvable", TArgs, "FIELD_DEFINITION">;
