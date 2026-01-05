import type { DateTimeOutput } from "./scalars.js";

export interface Event {
  id: string;
  name: string;
  createdAt: DateTimeOutput;
}

export interface CreateEventInput {
  name: string;
}
