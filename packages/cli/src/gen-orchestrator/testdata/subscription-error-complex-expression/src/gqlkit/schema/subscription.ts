import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineSubscription } from "../gqlkit.js";

interface Message {
  id: string;
  content: string;
}

declare const condition: boolean;

// Conditional expression with defineSubscription - should produce an error
export const messageAdded = condition
  ? defineSubscription<NoArgs, Message>(async function* () {
      yield { id: "1", content: "hello" };
    })
  : defineSubscription<NoArgs, Message>(async function* () {
      yield { id: "2", content: "world" };
    });
