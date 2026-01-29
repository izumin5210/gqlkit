// Custom scalars using GqlScalar type helper with embedded metadata
// Import GqlScalar-based types that have scalar metadata embedded
import type { ProductPrice, UserId } from "../../../scalars.js";

// Boolean-based branded type - no custom scalar metadata, uses default Boolean
type IsActive = boolean & { __nominal: true };

// Product type using custom scalars:
// - id: UserId → UserID! (custom scalar via GqlScalar metadata)
// - price: ProductPrice → Price! (custom scalar via GqlScalar metadata)
// - active: IsActive → Boolean! (default scalar for branded boolean)
export interface Product {
  id: UserId;
  price: ProductPrice;
  active: IsActive;
  name: string;
}
