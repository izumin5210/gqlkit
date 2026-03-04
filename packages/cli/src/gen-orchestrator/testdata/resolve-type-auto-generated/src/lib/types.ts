// External types (outside gqlkit schema directory)
// These types are NOT known to gqlkit as schema types.

export type PartA = {
  $typeName: "PartA";
  value: string;
};

export type PartB = {
  $typeName: "PartB";
  count: number;
};

export type ItemPart = PartA | PartB;
