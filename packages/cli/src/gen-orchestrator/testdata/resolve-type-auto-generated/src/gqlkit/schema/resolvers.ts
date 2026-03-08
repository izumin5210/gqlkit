import type { ItemPart } from "../../lib/types.js";
import { defineResolveType } from "../gqlkit.js";

export const resolveItemPartType = defineResolveType<ItemPart>(
  (obj) => obj.$typeName,
);
