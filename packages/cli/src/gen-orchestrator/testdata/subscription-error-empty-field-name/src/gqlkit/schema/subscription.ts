import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineSubscription } from "../gqlkit.js";

interface Message {
  id: string;
  content: string;
}

// Empty field name after '$' - should produce an error
export const subscription$ = defineSubscription<NoArgs, Message>(
  async function* () {
    yield { id: "1", content: "hello" };
  },
);
