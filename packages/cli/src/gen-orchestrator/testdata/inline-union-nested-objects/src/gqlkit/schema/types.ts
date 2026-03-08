/**
 * @fileoverview Tests nested inline objects inside inline union members.
 *
 * Verifies that inline objects nested within __typename-bearing union members
 * are properly resolved to auto-generated types (not left as __INLINE_OBJECT__).
 *
 * Scenarios:
 * - 1-level nesting: TextContent with metadata: { lang: string; encoding: string }
 * - 2-level nesting: Article with author: { name: string; address: { city: string; country: string } }
 */
import { defineQuery, type NoArgs } from "../gqlkit.js";

/**
 * Query returning a union where members contain nested inline objects.
 * Expected generated types:
 * - TextContent with field metadata: TextContentMetadata
 * - Article with field author: ArticleAuthor, author.address: ArticleAuthorAddress
 */
export const content = defineQuery<
  NoArgs,
  | {
      __typename: "TextContent";
      body: string;
      metadata: {
        lang: string;
        encoding: string;
      };
    }
  | {
      __typename: "Article";
      title: string;
      author: {
        name: string;
        address: {
          city: string;
          country: string;
        };
      };
    }
>(() => ({
  __typename: "TextContent" as const,
  body: "hello",
  metadata: {
    lang: "en",
    encoding: "utf-8",
  },
}));
