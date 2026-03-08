// External types (outside gqlkit schema directory)
// These types are NOT known to gqlkit as schema types.

export interface PartA {
  $typeName: "PartA";
  value: string;
}

export interface PartB {
  $typeName: "PartB";
  count: number;
}

export type ItemPart = PartA | PartB;
