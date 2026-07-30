/**
 * Scalar metadata structure embedded in intersection types.
 * Used by CLI to detect and identify scalar types through type analysis.
 *
 * @example
 * ```typescript
 * // A type with scalar metadata
 * type MyScalar = Base & { " $gqlkitScalar"?: ScalarMetadataShape };
 * ```
 *
 * @internal Structural shape consumed by the CLI's shape-based type
 * detection, not by user code. Kept exported (rather than removed) because
 * `GqlScalar`'s metadata marker is typed in terms of it.
 */
export interface ScalarMetadataShape {
  readonly name: string;
  readonly only?: "input" | "output";
}

/**
 * Utility type for defining custom scalar types with metadata.
 * The metadata is embedded as an optional property to maintain compatibility
 * with the underlying base type.
 *
 * @typeParam Name - The GraphQL scalar name
 * @typeParam Base - The underlying TypeScript type
 * @typeParam Only - Usage constraint: "input" for input-only, "output" for output-only, undefined for both
 *
 * @example
 * ```typescript
 * // Basic custom scalar
 * type DateTime = GqlScalar<"DateTime", Date>;
 *
 * // Input-only scalar
 * type DateTimeInput = GqlScalar<"DateTime", Date, "input">;
 *
 * // Output-only scalar (can accept multiple base types)
 * type DateTimeOutput = GqlScalar<"DateTime", Date | string, "output">;
 * ```
 */
export type GqlScalar<
  Name extends string,
  Base,
  Only extends "input" | "output" | undefined = undefined,
> = Base & {
  " $gqlkitScalar"?: {
    name: Name;
    only: Only;
  };
};

/**
 * GraphQL Int scalar type.
 * Use this to explicitly mark a field as an integer.
 * Includes metadata for CLI detection.
 */
export type Int = GqlScalar<"Int", number>;

/**
 * GraphQL Float scalar type.
 * Use this to explicitly mark a field as a floating-point number.
 * Note: Plain `number` type will also map to Float by default.
 * Includes metadata for CLI detection.
 */
export type Float = GqlScalar<"Float", number>;

/**
 * GraphQL ID scalar type (string-based).
 * Use this when the ID is represented as a string in your system.
 * Includes metadata for CLI detection.
 */
export type IDString = GqlScalar<"ID", string>;

/**
 * GraphQL ID scalar type (number-based).
 * Use this when the ID is represented as a number in your system.
 * Includes metadata for CLI detection.
 */
export type IDNumber = GqlScalar<"ID", number>;
