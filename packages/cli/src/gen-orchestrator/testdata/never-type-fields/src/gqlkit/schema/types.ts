export type PartBase = {
  type: string;
  text: string;
  output?: never; // optional never — should be skipped
  result: never; // required never — should be skipped
  label: string;
};
