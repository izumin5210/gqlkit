import { createGqlkitApis } from "@gqlkit-ts/runtime";
import type { CreateEventInput, Event } from "./event.js";

const { defineMutation } = createGqlkitApis();

export const createEvent = defineMutation<{ input: CreateEventInput }, Event>(
  async (_root, args, _ctx, _info) => {
    return {
      id: "1",
      name: args.input.name,
      createdAt: new Date(),
    };
  },
);
