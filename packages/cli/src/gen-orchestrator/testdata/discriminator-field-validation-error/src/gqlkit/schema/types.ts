/**
 * Test case: discriminator field validation errors
 *
 * ContentPart: "type" is specified as discriminator, but ImagePart is missing the field.
 * Media: "kind" is specified as discriminator, but Video has `kind: string` (not a string literal).
 */

export interface TextPart {
  type: "text";
  text: string;
}

export interface ImagePart {
  url: string;
  alt: string;
}

export type ContentPart = TextPart | ImagePart;

export interface Video {
  kind: string;
  url: string;
}

export interface Audio {
  kind: "audio";
  url: string;
}

export type Media = Video | Audio;
