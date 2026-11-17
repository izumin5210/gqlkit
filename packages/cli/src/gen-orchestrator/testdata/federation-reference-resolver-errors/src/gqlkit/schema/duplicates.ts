import type { GqlObject, IDString } from "@gqlkit-ts/runtime";
import type { Key } from "@gqlkit-ts/runtime/federation";
import { defineResolveReference } from "../gqlkit.js";

export type Product = GqlObject<
  { id: IDString; name: string },
  { directives: [Key<"id">] }
>;

export const productReference = defineResolveReference<Product>((ref) => ({
  id: ref.id,
  name: "",
}));

export const productReferenceAgain = defineResolveReference<Product>((ref) => ({
  id: ref.id,
  name: "",
}));
