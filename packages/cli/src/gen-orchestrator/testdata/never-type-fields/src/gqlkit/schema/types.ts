export type PartBase = {
  type: string;
  text: string;
  output?: never; // optional never — should be skipped
  result: never; // required never — should be skipped
  label: string;
  /** Inline object with never property — never should be excluded from generated type */
  metadata: {
    name: string;
    internal?: never;
    description: string;
  };
};
