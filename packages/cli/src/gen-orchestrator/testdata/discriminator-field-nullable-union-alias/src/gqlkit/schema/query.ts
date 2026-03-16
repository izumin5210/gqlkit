import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { Container } from "./types.js";

export const containerQuery = defineQuery<NoArgs, Container>(
  "container",
  (_args, _ctx) => {
    return { label: "test", item: { kind: "alpha", value: "hello" } };
  },
);
