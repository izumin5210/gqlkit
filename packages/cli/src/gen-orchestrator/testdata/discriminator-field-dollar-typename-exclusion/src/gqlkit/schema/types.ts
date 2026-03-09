/**
 * Test case: discriminatorFields overrides $typeName when both exist on same union
 *
 * ContentPart: has discriminatorFields config ("type") AND $typeName on members.
 *   discriminatorFields should take priority; typename pipeline should skip this union.
 *
 * SearchResult: has $typeName on members but NO discriminatorFields config.
 *   typename pipeline should process this union as before.
 */

export interface TextPart {
  $typeName: "TextPart";
  type: "text";
  text: string;
}

export interface ImagePart {
  $typeName: "ImagePart";
  type: "image";
  url: string;
  alt: string;
}

export type ContentPart = TextPart | ImagePart;

export interface User {
  $typeName: "User";
  id: string;
  name: string;
}

export interface Post {
  $typeName: "Post";
  id: string;
  title: string;
}

export type SearchResult = User | Post;
