import type { GqlDirective, GqlObject, IDString } from "@gqlkit-ts/runtime";

/**
 * Directive for caching with specific args.
 */
export type CacheDirective = GqlDirective<"cache", { maxAge: 300 }, "OBJECT">;

/**
 * A cached entity with some internal fields excluded.
 */
export type Product = GqlObject<
  {
    id: IDString;
    name: string;
    price: number;
    internalCost: number;
    supplierCode: string;
  },
  {
    directives: [CacheDirective];
    ignoreFields: "internalCost" | "supplierCode";
  }
>;
