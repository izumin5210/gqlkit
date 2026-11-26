import { defineQuery } from "../gqlkit.js";

export type Status =
  | /** Active status */ "ACTIVE"
  | /** @deprecated Use ACTIVE instead */ "PENDING"
  | /**
     * Archived status
     * @deprecated Archive is going away
     */ "ARCHIVED"
  | "CLOSED"
  | /* Block comments are not descriptions */ "DRAFT";

export type Task = {
  status: Status;
  inline: /** Low priority */ "LOW" | /** @deprecated Use LOW */ "OLD";
  nullableInline: /** Small size */ "SMALL" | "LARGE" | null;
};

export const tasks = defineQuery<
  {
    /** Inline enum in an input position with a deprecated value */
    order: /** Ascending */ "ASC" | /** @deprecated Use ASC */ "DESC";
  },
  Task[]
>(() => []);
