/**
 * Test case: DISCRIMINATOR_UNKNOWN_UNION warning for non-existent union name
 *
 * ContentPart: valid union with discriminatorFields config ("type").
 *   Should work normally.
 *
 * "NonExistentUnion" is configured in discriminatorFields but does not exist as a type.
 *   Should produce a DISCRIMINATOR_UNKNOWN_UNION warning.
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
