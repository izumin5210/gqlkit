/**
 * Test case: discriminatorFields configured union should be excluded from typename pipeline
 *
 * ContentPart: has discriminatorFields config ("type") AND __typename on members.
 *   discriminatorFields should take priority; typename pipeline should skip this union.
 *
 * SearchResult: has __typename on members but NO discriminatorFields config.
 *   typename pipeline should process this union as before.
 */

// ContentPart uses "type" as discriminator (configured in config.json)
// Even though __typename is present, discriminatorFields should take priority
export interface TextPart {
  __typename: "TextPart";
  type: "text";
  text: string;
}

export interface ImagePart {
  __typename: "ImagePart";
  type: "image";
  url: string;
  alt: string;
}

export type ContentPart = TextPart | ImagePart;

// SearchResult uses __typename only (no discriminatorFields config)
export interface User {
  __typename: "User";
  id: string;
  name: string;
}

export interface Post {
  __typename: "Post";
  id: string;
  title: string;
}

export type SearchResult = User | Post;
