import type { DirectiveLocation, GqlDirective } from "./directive.js";

/**
 * Metadata structure for field-level GraphQL metadata.
 * Used to attach directives, default values, and other metadata to individual fields.
 *
 * @typeParam Meta - The metadata configuration object
 *
 * @internal Structural shape consumed by the CLI's shape-based type
 * detection, not by user code. Kept exported (rather than removed) because
 * `GqlField`'s metadata marker is typed in terms of it.
 */
export interface GqlFieldMetaShape<
  Meta extends {
    directives?: ReadonlyArray<
      GqlDirective<
        string,
        Record<string, unknown>,
        DirectiveLocation | DirectiveLocation[]
      >
    >;
    defaultValue?: unknown;
  },
> {
  readonly directives?: Meta["directives"];
  readonly defaultValue?: Meta["defaultValue"];
}

/**
 * Attaches metadata to a field type.
 * The metadata is embedded as optional properties to maintain compatibility
 * with the underlying type.
 *
 * The structure uses two properties:
 * - `$gqlkitFieldMeta`: Contains the metadata object with directives and defaultValue
 * - `$gqlkitOriginalType`: Preserves the original type T to maintain nullability information
 *
 * This design is necessary because TypeScript normalizes `(T | null) & { metadata }` to
 * `(T & { metadata }) | never`, which loses the null part of the union. By storing
 * the original type in `$gqlkitOriginalType`, we can recover the full type information
 * during CLI analysis.
 *
 * @typeParam T - The base type to attach metadata to
 * @typeParam Meta - The metadata configuration object containing directives and/or defaultValue
 *
 * @example
 * ```typescript
 * // With directives
 * type User = {
 *   id: GqlField<IDString, { directives: [AuthDirective<{ role: ["USER"] }>] }>;
 *   bio: GqlField<string | null, { directives: [AuthDirective<{ role: ["ADMIN"] }>] }>;
 * };
 *
 * // With default value
 * type PaginationInput = {
 *   limit: GqlField<Int, { defaultValue: 10 }>;
 *   offset: GqlField<Int, { defaultValue: 0 }>;
 * };
 *
 * // With both directives and default value
 * type SearchInput = {
 *   query: GqlField<string, { defaultValue: ""; directives: [SomeDirective] }>;
 * };
 * ```
 */
export type GqlField<
  T,
  Meta extends {
    directives?: ReadonlyArray<
      GqlDirective<
        string,
        Record<string, unknown>,
        DirectiveLocation | DirectiveLocation[]
      >
    >;
    defaultValue?: unknown;
  } = object,
> = T & {
  readonly " $gqlkitFieldMeta"?: GqlFieldMetaShape<Meta>;
  readonly " $gqlkitOriginalType"?: T;
};
