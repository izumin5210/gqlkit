import type { Container } from "./types.js";
import { defineQuery } from "../gqlkit.js";

export const container = defineQuery<{ id: string }, Container>(() => ({
  id: "1",
  items: [],
}));
