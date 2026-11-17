import type { GqlField, GqlObject, IDString, Int } from "@gqlkit-ts/runtime";
import type { Inaccessible, Shareable } from "@gqlkit-ts/runtime/federation";
import { defineField, defineQuery } from "../gqlkit.js";

/** Shareable on the type applies to all of its fields. */
export type Money = GqlObject<
  { amount: Int; currency: string },
  { directives: [Shareable] }
>;

export type Product = {
  id: IDString;
  name: GqlField<string, { directives: [Shareable] }>;
  price: Money;
  internalCode: GqlField<string, { directives: [Inaccessible] }>;
};

export type ProductFilterInput = {
  name: string | null;
  legacyCode: GqlField<string | null, { directives: [Inaccessible] }>;
};

export const products = defineQuery<
  {
    filter: ProductFilterInput | null;
    debug: GqlField<boolean | null, { directives: [Inaccessible] }>;
  },
  Product[]
>(() => []);

/** Federation directives also apply to resolver fields. */
export const displayName = defineField<
  Product,
  Record<string, never>,
  string,
  [Shareable]
>((parent) => parent.name);
