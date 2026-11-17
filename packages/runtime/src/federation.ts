import type { DirectiveLocation, GqlDirective } from "./directive.js";

/**
 * Which federation directive a type stands for.
 *
 * @internal The CLI reads this marker instead of the directive name, so that
 * a custom `GqlDirective` that happens to be named `key` stays a custom
 * directive. The CLI also takes the definition, version requirements, and
 * argument types of the directive from the federation spec the config
 * selects, not from this type.
 */
type FederationDirectiveKind = "key" | "shareable" | "inaccessible";

type FederationDirective<
  Kind extends FederationDirectiveKind,
  Args extends Record<string, unknown>,
  Location extends DirectiveLocation[],
> = GqlDirective<Kind, Args, Location> & {
  readonly " $gqlkitFederationDirective": Kind;
};

/**
 * Options of {@link Key}.
 */
export type KeyOptions = {
  /**
   * Set to `false` when this subgraph only references the entity and cannot
   * resolve it from its key. Apollo Federation only.
   */
  readonly resolvable?: boolean;
};

/**
 * Declares an entity and one of its keys (`@key`). Attach it to an object
 * type with `GqlObject`; attach several to declare several keys.
 *
 * @typeParam Fields - The key as a selection set without the outer braces,
 * e.g. `"id"` or `"organization { id }"`. gqlkit checks it against the type
 * when generating the schema.
 * @typeParam Options - See {@link KeyOptions}.
 *
 * @example
 * ```typescript
 * export type User = GqlObject<
 *   { id: IDString; organization: Organization },
 *   { directives: [Key<"id">, Key<"organization { id }">] }
 * >;
 * ```
 */
export type Key<
  Fields extends string,
  Options extends KeyOptions = Record<never, never>,
> = FederationDirective<"key", { fields: Fields } & Options, ["OBJECT"]>;

/**
 * Allows more than one subgraph to resolve a field (`@shareable`). Attach it
 * to an object type to apply it to all of the type's fields.
 */
export type Shareable = FederationDirective<
  "shareable",
  Record<string, never>,
  ["OBJECT", "FIELD_DEFINITION"]
>;

/**
 * Hides a schema element from the supergraph's public API
 * (`@inaccessible`) while keeping it usable inside the supergraph.
 */
export type Inaccessible = FederationDirective<
  "inaccessible",
  Record<string, never>,
  [
    "OBJECT",
    "FIELD_DEFINITION",
    "ARGUMENT_DEFINITION",
    "INPUT_FIELD_DEFINITION",
  ]
>;
