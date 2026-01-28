// Branded types with custom scalar configuration

// String-based branded type - configured as UserID scalar
type UserId = string & { __brand: "UserId" };

// Number-based branded type - configured as Price scalar
type ProductPrice = number & { readonly __brand: unique symbol };

// Boolean-based branded type - no custom scalar, should use Boolean
type IsActive = boolean & { __nominal: true };

// Product type using branded types:
// - id: UserId → UserID! (custom scalar)
// - price: ProductPrice → Price! (custom scalar)
// - active: IsActive → Boolean! (default scalar)
export interface Product {
  id: UserId;
  price: ProductPrice;
  active: IsActive;
  name: string;
}
