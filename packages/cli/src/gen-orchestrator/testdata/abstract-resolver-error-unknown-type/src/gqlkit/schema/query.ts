import { defineQuery } from "../gqlkit.js";

export interface User {
  id: string;
  name: string;
}

export const user = defineQuery<{ id: string }, User>(() => ({
  id: "1",
  name: "Test",
}));
