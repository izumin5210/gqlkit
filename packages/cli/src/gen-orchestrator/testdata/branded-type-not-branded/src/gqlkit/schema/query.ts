import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { Container } from "./types.js";

export const container = defineQuery<NoArgs, Container>(() => ({
  person: {
    name: "Test",
    age: 30,
    email: "test@example.com",
    phone: null,
  },
  mixed: {
    name: "Mixed",
    value: 42,
  } as never,
}));
