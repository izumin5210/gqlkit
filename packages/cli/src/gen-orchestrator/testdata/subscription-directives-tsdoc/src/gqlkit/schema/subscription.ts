import type { GqlDirective, NoArgs } from "@gqlkit-ts/runtime";
import { defineSubscription } from "../gqlkit.js";

// Directive type for authentication
export type Role = "USER" | "ADMIN";
export type AuthDirective<TArgs extends { role: Role[] }> = GqlDirective<
  "auth",
  TArgs,
  "FIELD_DEFINITION"
>;

interface Message {
  id: string;
  content: string;
  authorId: string;
}

interface Alert {
  id: string;
  title: string;
  severity: string;
}

// Subscription with directive via TDirectives type argument
export const messageAdded = defineSubscription<
  { channelId: string },
  Message,
  [AuthDirective<{ role: ["USER"] }>]
>(async function* () {
  yield { id: "1", content: "hello", authorId: "user1" };
});

/**
 * Subscribe to system alerts.
 */
export const alertReceived = defineSubscription<NoArgs, Alert>(
  async function* () {
    yield { id: "1", title: "Warning", severity: "high" };
  },
);

/**
 * @deprecated Use alertReceived instead
 */
export const notificationReceived = defineSubscription<
  { userId: string },
  Alert
>(async function* () {
  yield { id: "1", title: "Notice", severity: "low" };
});
