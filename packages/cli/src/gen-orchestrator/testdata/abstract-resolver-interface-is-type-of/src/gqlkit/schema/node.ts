import type { GqlInterface, IDString } from "@gqlkit-ts/runtime";

export type Node = GqlInterface<{
  id: IDString;
}>;
