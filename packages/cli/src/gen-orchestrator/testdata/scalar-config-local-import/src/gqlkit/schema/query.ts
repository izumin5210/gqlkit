import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

type DateTime = string;
interface Event {
  id: string;
  name: string;
  createdAt: DateTime;
}

export const events = defineQuery<NoArgs, Event[]>(() => []);
