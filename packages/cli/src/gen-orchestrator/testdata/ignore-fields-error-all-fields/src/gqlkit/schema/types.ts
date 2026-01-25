import type { GqlObject, IDString } from "@gqlkit-ts/runtime";

export type User = GqlObject<
  {
    id: IDString;
    name: string;
  },
  { ignoreFields: "id" | "name" }
>;
