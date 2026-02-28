import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineSubscription } from "../gqlkit.js";

interface Message {
  id: string;
  content: string;
}

export const messageAdded = defineSubscription<{ channelId: string }, Message>(
  async function* () {
    yield { id: "1", content: "hello" };
  },
);

export const onlineUserCountChanged = defineSubscription<NoArgs, number>(
  async function* () {
    yield 42;
  },
);
