import type { DateTime } from "../../scalars.js";

export interface Event {
  id: string;
  name: string;
  createdAt: DateTime;
}
