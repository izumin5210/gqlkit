import { defineQuery, type NoArgs } from "../gqlkit.js";

// Empty marker interfaces cannot be represented as GraphQL types.
// Using them as union members in an inline union member property
// should produce an INLINE_UNION_UNRESOLVABLE_MEMBER diagnostic.
//
// biome-ignore lint/suspicious/noEmptyInterface: these are intentionally empty marker interfaces for testing purposes.
interface MarkerA {}
// biome-ignore lint/suspicious/noEmptyInterface: these are intentionally empty marker interfaces for testing purposes.
interface MarkerB {}

export const result = defineQuery<
  NoArgs,
  | {
      __typename: "Success";
      value: string;
      marker: MarkerA | MarkerB;
    }
  | {
      __typename: "Failure";
      reason: string;
    }
>(() => ({
  __typename: "Success" as const,
  value: "ok",
  marker: {} as MarkerA,
}));
