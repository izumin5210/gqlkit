/**
 * Inline union with nested inline object members.
 * Tests recursive inline type expansion.
 * This intentionally lacks type resolvers to verify MISSING_ABSTRACT_TYPE_RESOLVER errors are reported for auto-generated union types.
 */
export type Container = {
  id: string;
  /**
   * Content can be text with metadata or image with dimensions.
   * Each member is an inline object that needs auto-generation.
   */
  content:
    | {
        kind: "text";
        text: string;
        metadata: { lang: string; encoding: string };
      }
    | {
        kind: "image";
        url: string;
        dimensions: { width: number; height: number };
      };
};
