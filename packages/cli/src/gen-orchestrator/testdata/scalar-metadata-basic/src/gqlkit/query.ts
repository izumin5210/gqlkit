import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import type { Event } from "./event.js";

const { defineQuery } = createGqlkitApis();

export const events = defineQuery<NoArgs, Event[]>(
  async (_root, _args, _ctx, _info) => {
    return [];
  },
);
