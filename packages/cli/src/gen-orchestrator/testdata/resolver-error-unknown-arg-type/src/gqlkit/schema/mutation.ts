import { defineMutation } from "../gqlkit.js";

interface UpdateUserArgs {
  id: string;
  // `NonExistentRole` has no declaration anywhere in this project. Characterizes
  // what happens when a resolver argument field references a name that is
  // genuinely unresolvable (refactor-plan.md Decision D6).
  role: NonExistentRole;
}

export const updateUser = defineMutation<UpdateUserArgs, boolean>(
  (_root, _args) => true,
);
