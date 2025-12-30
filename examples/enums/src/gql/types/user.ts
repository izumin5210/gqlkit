import type { Role } from "./role.js";
import type { Status } from "./status.js";

export interface User {
  id: string;
  name: string;
  status: Status;
  role: Role;
}
