import { defineQuery } from "../gqlkit.js";
import type { Container } from "./types.js";

export const container = defineQuery<{ id: string }, Container>(() => ({
  id: "1",
  items: [],
}));
