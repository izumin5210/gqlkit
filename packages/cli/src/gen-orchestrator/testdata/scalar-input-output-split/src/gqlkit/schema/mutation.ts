import { defineMutation } from "../gqlkit.js";
import type { CreateEventInput, Event } from "./event.js";

export const createEvent = defineMutation<{ input: CreateEventInput }, Event>(
  async (_root, args, _ctx, _info) => {
    return {
      id: "1",
      name: args.input.name,
      createdAt: new Date(),
    };
  },
);
