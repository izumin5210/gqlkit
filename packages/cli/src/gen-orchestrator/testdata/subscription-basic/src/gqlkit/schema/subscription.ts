import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineSubscription } from "../gqlkit.js";

interface Message {
  id: string;
  content: string;
  authorId: string;
}

interface UserStatus {
  userId: string;
  online: boolean;
}

interface Notification {
  id: string;
  title: string;
  body: string;
}

// Basic subscription with arguments
export const messageAdded = defineSubscription<
  { channelId: string },
  Message
>(async function* () {
  yield { id: "1", content: "hello", authorId: "user1" };
});

// No-args subscription using NoArgs
export const userStatusChanged = defineSubscription<NoArgs, UserStatus>(
  async function* () {
    yield { userId: "user1", online: true };
  },
);

// Additional subscription to verify alphabetical sort order
export const notificationReceived = defineSubscription<
  { userId: string },
  Notification
>(async function* () {
  yield { id: "1", title: "New", body: "You have a notification" };
});
