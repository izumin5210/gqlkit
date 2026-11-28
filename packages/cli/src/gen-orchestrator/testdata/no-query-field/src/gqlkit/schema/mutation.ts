import { defineMutation } from "../gqlkit.js";

/**
 * A project with mutations but no queries still generates an empty
 * `type Query`, which GraphQL cannot serve. Generation succeeds, but a
 * MISSING_QUERY_FIELD warning is reported.
 */
export const ping = defineMutation<{ message: string }, boolean>(() => true);
