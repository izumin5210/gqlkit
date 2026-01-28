// Branded types - only used internally, not exported as schema types

// String-based branded type
type UserId = string & { __brand: "UserId" };

// Number-based branded type with unique symbol pattern
type Price = number & { readonly __brand: unique symbol };

// Boolean-based branded type
type IsActive = boolean & { __nominal: true };

// Product type using branded types (this is the exported schema type)
// Branded types should map to default GraphQL scalars:
// - id: UserId → String!
// - price: Price → Float!
// - active: IsActive → Boolean!
export interface Product {
  id: UserId;
  price: Price;
  active: IsActive;
  name: string;
}
