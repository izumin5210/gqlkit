// Simulate external library types (not exported as schema types)
// Named type aliases resolve to object types but are NOT anonymous __type symbols,
// so isInlineObjectType returns false and they bypass inline object extraction.
interface ExternalPartA {
  value: string;
}

interface ExternalPartB {
  count: number;
}

// This union's members are not in knownTypeNames
export type Container = {
  items: (ExternalPartA | ExternalPartB)[];
};
