// Intersection types that are NOT branded types
// These should be expanded as inline objects

// Object intersection - has real properties, not just brand markers
interface BasePerson {
  name: string;
  age: number;
}

interface ContactInfo {
  email: string;
  phone: string | null;
}

// This is NOT a branded type - it's a real object intersection
// Should be expanded as inline object with all properties
type PersonWithContact = BasePerson & ContactInfo;

// Mixed with brand-like property but also has real properties
// Should NOT be treated as branded (has non-brand properties)
type NotBranded = { name: string; value: number } & { __brand: "x" };

// Container using non-branded intersection types
export interface Container {
  // PersonWithContact should be expanded to inline object
  person: PersonWithContact;
  // NotBranded should be expanded to inline object (has real properties)
  mixed: NotBranded;
}
