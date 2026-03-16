import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { Container } from "./types.js";

export const container = defineQuery<NoArgs, Container>(() => ({
  people: [],
}));
