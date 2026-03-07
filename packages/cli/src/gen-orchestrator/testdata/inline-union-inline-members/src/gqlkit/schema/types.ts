import { defineQuery, type NoArgs } from "../gqlkit.js";

/**
 * Query returning a union where all members are inline objects with __typename.
 * Tests auto-generated type naming and resolveType from __typename.
 */
export const content = defineQuery<
  NoArgs,
  | {
      __typename: "TextContent";
      text: string;
      format: string;
    }
  | {
      __typename: "ImageContent";
      url: string;
      width: number;
      height: number;
    }
>(() => ({
  __typename: "TextContent" as const,
  text: "hello",
  format: "plain",
}));
