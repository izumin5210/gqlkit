/**
 * Test case: single discriminator field basic usage
 *
 * ContentPart uses "type" as discriminator field (configured in config.json).
 * No __typename or $typeName is present on members.
 * The "type" field should remain in the GraphQL schema since it is a valid field name.
 */

export interface TextPart {
  type: "text";
  text: string;
}

export interface ImagePart {
  type: "image";
  url: string;
  alt: string;
}

export type ContentPart = TextPart | ImagePart;
