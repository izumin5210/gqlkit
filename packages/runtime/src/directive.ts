/**
 * Represents the locations where a directive can be applied.
 * This corresponds to GraphQL Type System Directive Locations.
 */
export type DirectiveLocation =
  | "SCHEMA"
  | "SCALAR"
  | "OBJECT"
  | "FIELD_DEFINITION"
  | "ARGUMENT_DEFINITION"
  | "INTERFACE"
  | "UNION"
  | "ENUM"
  | "ENUM_VALUE"
  | "INPUT_OBJECT"
  | "INPUT_FIELD_DEFINITION";

/**
 * Represents a GraphQL directive with name, arguments, and location.
 * Used to define custom directives that can be attached to types and fields.
 *
 * @typeParam Name - The directive name (without @)
 * @typeParam Args - The argument types for the directive
 * @typeParam Location - The location(s) where the directive can be applied
 *
 * @example
 * ```typescript
 * type AuthDirective<R extends string[]> = GqlDirective<"auth", { roles: R }, "FIELD_DEFINITION">;
 * type CacheDirective = GqlDirective<"cache", { maxAge: number }, "FIELD_DEFINITION" | "OBJECT">;
 * ```
 */
export type GqlDirective<
  Name extends string,
  Args extends Record<string, unknown> = Record<string, never>,
  Location extends DirectiveLocation | DirectiveLocation[] = DirectiveLocation,
> = {
  readonly " $directiveName": Name;
  readonly " $directiveArgs": Args;
  readonly " $directiveLocation": Location;
};
