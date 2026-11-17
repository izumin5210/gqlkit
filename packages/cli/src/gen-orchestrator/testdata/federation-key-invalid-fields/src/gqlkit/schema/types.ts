import type { GqlObject, IDString } from "@gqlkit-ts/runtime";
import type { Key } from "@gqlkit-ts/runtime/federation";
import { defineField, defineQuery } from "../gqlkit.js";

export type Cat = { __typename: "Cat"; name: string };
export type Dog = { __typename: "Dog"; name: string };
export type Pet = Cat | Dog;

export type Address = { city: string };

export type User = GqlObject<
  { id: IDString; address: Address; pet: Pet },
  {
    directives: [
      Key<"uuid">,
      Key<"id { value }">,
      Key<"address">,
      Key<"address { zip }">,
      Key<"pet { name }">,
      Key<"avatarUrl">,
      Key<"alias: id">,
      Key<"">,
      Key<"id {">,
    ];
  }
>;

export const avatarUrl = defineField<User, { size: number }, string>(() => "");

export const user = defineQuery<{ id: IDString }, User | null>(() => null);
