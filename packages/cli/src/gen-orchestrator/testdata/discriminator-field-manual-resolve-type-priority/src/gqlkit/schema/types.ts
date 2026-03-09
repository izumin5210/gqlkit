/**
 * Test case: manual defineResolveType takes priority over discriminatorFields
 *
 * ContentPart: has discriminatorFields config ("type") AND manual defineResolveType.
 *   Manual defineResolveType should take priority; discriminator pipeline should skip this union.
 *
 * Media: has discriminatorFields config ("kind") but NO manual defineResolveType.
 *   Discriminator pipeline should process this union and generate resolveType automatically.
 */

import { defineResolveType } from "../gqlkit.js";

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

// Manual defineResolveType should take priority over discriminatorFields config
export const contentPartResolveType = defineResolveType<ContentPart>(
  (value) => {
    if ("text" in value) {
      return "TextPart";
    }
    return "ImagePart";
  },
);

export interface Audio {
  kind: "audio";
  url: string;
}

export interface Video {
  kind: "video";
  url: string;
}

export type Media = Audio | Video;
