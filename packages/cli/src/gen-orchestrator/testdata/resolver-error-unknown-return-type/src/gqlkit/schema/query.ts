import type { NoArgs } from "@gqlkit-ts/runtime";
import { defineQuery } from "../gqlkit.js";

// `NonExistentUser` has no declaration anywhere in this project (a typo for
// a type the author forgot to define, or forgot to import). Characterizes
// what happens when a resolver's return type references a name that is
// genuinely unresolvable, as opposed to a real local type that simply isn't
// registered as a schema type (see refactor-plan.md Decision D6 / issue #343).
export const user = defineQuery<NoArgs, NonExistentUser | null>(() => null);
