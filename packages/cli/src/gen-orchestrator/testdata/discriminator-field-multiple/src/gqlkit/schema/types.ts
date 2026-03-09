/**
 * Test case: multiple discriminator fields with value tuple uniqueness and naming
 *
 * Content union uses ["type", "mediaType"] as discriminator fields.
 * - TextPlain: type="text", mediaType="plain" -> ContentTextPlain
 * - TextHtml: type="text", mediaType="html" -> ContentTextHtml
 * - Image: type="image", no mediaType -> ContentImage (mediaType skipped in naming)
 *
 * All value tuples are unique: ["text","plain"], ["text","html"], ["image",null]
 */

export type Content =
  | { type: "text"; mediaType: "plain"; body: string }
  | { type: "text"; mediaType: "html"; html: string }
  | { type: "image"; url: string; alt: string };
