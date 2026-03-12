/**
 * Non-exported recursive intersection type.
 * RecursiveNode is automatically discovered and registered as a schema type,
 * allowing the recursive `children` field to resolve correctly.
 */
type RecursiveNode = { value: string } & { children: RecursiveNode[] };

export type Forest = {
  name: string;
  root: RecursiveNode;
};
