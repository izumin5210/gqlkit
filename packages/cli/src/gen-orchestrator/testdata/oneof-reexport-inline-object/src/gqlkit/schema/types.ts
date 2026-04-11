import type { PendingActionInput } from "../../external/types.js";

export interface Task {
  id: string;
  action: PendingActionInput | null;
}

export type { PendingActionInput };
