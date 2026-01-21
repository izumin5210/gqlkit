/**
 * Type to test union member ordering.
 * Members are defined in specific order: Zebra, Apple, Mango.
 * Output should preserve this order based on source code position.
 * This intentionally lacks type resolvers to verify MISSING_ABSTRACT_TYPE_RESOLVER errors are reported for auto-generated union types.
 */
export type OrderTest = {
  id: string;
  /**
   * Items defined in non-alphabetical order to verify source order preservation
   */
  item: { zebra: string } | { apple: string } | { mango: string };
};
