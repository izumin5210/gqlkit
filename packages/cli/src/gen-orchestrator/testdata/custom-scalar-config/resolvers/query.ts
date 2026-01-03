import { createGqlkitApis, type NoArgs } from "@gqlkit-ts/runtime";

type Context = unknown;
type DateTime = string;
interface Event {
  id: string;
  name: string;
  createdAt: DateTime;
}

const { defineQuery } = createGqlkitApis<Context>();

export const events = defineQuery<NoArgs, Event[]>(() => []);
