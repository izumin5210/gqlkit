import { defineQuery } from "../gqlkit.js";
import type { Node } from "./node.js";

export const node = defineQuery<{ id: string }, Node | null>(() => null);
