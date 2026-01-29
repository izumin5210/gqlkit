// Various branded type patterns for comprehensive testing

// Pattern 1: Simple brand with __brand
type SimpleBrand = string & { __brand: "simple" };

// Pattern 2: Unique symbol brand
type UniqueSymbolBrand = string & { readonly __brand: unique symbol };

// Pattern 3: Multiple markers
type MultiMarker = string & { __brand: "x" } & { __tag: "y" };

// Pattern 4: Number brand
type NumberBrand = number & { __brand: "price" };

// Pattern 5: Boolean nominal type
type BoolNominal = boolean & { __nominal: true };

// Pattern 6: Using _brand (single underscore)
type SingleUnderscoreBrand = string & { _brand: "single" };

// Pattern 7: Using brand (no underscore)
type NoBrandPrefix = string & { brand: "none" };

// Test object using all patterns - all should map to default scalars
export interface BrandedPatterns {
  simple: SimpleBrand; // → String!
  uniqueSymbol: UniqueSymbolBrand; // → String!
  multiMarker: MultiMarker; // → String!
  numBrand: NumberBrand; // → Float!
  boolNominal: BoolNominal; // → Boolean!
  singleUnderscore: SingleUnderscoreBrand; // → String!
  noPrefix: NoBrandPrefix; // → String!
}
