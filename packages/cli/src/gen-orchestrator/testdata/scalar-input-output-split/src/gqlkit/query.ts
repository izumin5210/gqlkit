import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";
import type { CreateEventInput, Event } from "./event.js";

type DateTimeInput = number;

type Context = unknown;

const { defineQuery, defineMutation } = createGqlkitApis<Context>();

export const events = defineQuery<NoArgs, Event[]>(() => []);

export const eventsAfter = defineQuery<{ after: DateTimeInput }, Event[]>(
  () => [],
);

export const createEvent = defineMutation<CreateEventInput, Event>(() => ({
  id: "1",
  name: "test",
  createdAt: Date.now(),
  updatedAt: new Date().toISOString(),
}));
