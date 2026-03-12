/**
 * Non-exported recursive intersection type.
 * When resolving `children`, the cycle cannot be resolved because
 * RecursiveNode is not a known schema type, so the field is skipped
 * with a CYCLE_DETECTED warning.
 */
type RecursiveNode = { value: string } & { children: RecursiveNode[] };

export type Forest = {
  name: string;
  root: RecursiveNode;
};
