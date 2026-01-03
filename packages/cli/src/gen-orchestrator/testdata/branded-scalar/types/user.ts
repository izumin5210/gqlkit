import type { IDString, Int } from "@gqlkit-ts/runtime";

export type User = {
  id: IDString;
  name: string;
  age: Int;
};
