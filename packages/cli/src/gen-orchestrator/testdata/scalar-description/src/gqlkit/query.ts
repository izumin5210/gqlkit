import type { Event } from "./event.js";

type Context = object;

function createApis<T>() {
  return {
    defineQuery: <Args, Return>(
      fn: (root: unknown, args: Args, ctx: T) => Return,
    ) => fn,
  };
}

const { defineQuery } = createApis<Context>();

export const events = defineQuery<Record<string, never>, Event[]>(() => {
  return [];
});
