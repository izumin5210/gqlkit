import type { PubSub } from "../pubsub.js";

export type Context = {
  currentUserId: string | null;
  pubsub: PubSub;
};
