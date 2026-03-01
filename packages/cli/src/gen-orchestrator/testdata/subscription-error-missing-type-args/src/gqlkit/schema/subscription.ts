import { defineSubscription } from "../gqlkit.js";

// Missing type arguments - should produce an error
export const messageAdded = defineSubscription(async function* () {
  yield { id: "1", content: "hello" };
});
