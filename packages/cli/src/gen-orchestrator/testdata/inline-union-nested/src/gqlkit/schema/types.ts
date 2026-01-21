/**
 * Inline union with nested inline object members.
 * Tests recursive inline type expansion.
 * This intentionally lacks type resolvers to test the schema generation.
 */
export type Container = {
  id: string;
  /**
   * Content can be text with metadata or image with dimensions.
   * Each member is an inline object that needs auto-generation.
   */
  content:
    | { kind: "text"; text: string; metadata: { lang: string; encoding: string } }
    | { kind: "image"; url: string; dimensions: { width: number; height: number } };
};

/**
 * Type to test member ordering.
 * Members are defined in specific order: Zebra, Apple, Mango.
 * Output should preserve this order based on source code position.
 */
export type OrderTest = {
  id: string;
  /**
   * Items defined in non-alphabetical order to verify source order preservation
   */
  item:
    | { zebra: string }
    | { apple: string }
    | { mango: string };
};
