import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";
import type { Event } from "./event.js";

export const events = defineQuery<NoArgs, Event[]>(
  async (_root, _args, _ctx, _info) => {
    return [];
  },
);
