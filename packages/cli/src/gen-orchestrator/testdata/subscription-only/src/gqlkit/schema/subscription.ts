import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineSubscription } from "../gqlkit.js";

interface Event {
  id: string;
  type: string;
  payload: string;
}

export const eventOccurred = defineSubscription<{ topic: string }, Event>(
  async function* () {
    yield { id: "1", type: "INFO", payload: "data" };
  },
);

export const heartbeat = defineSubscription<NoArgs, boolean>(
  async function* () {
    yield true;
  },
);
