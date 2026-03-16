/**
 * Container with singular and plural sibling inline object fields.
 * The array-backed field should avoid singularizing to the same auto type
 * name as the singular sibling field.
 */
export type Container = {
  part: {
    id: string;
  };
  parts: Array<{
    id: string;
  }>;
};
