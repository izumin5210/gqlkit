import type { GraphQLResolveInfo } from "graphql";

/**
 * Scalar metadata structure embedded in intersection types.
 * Used by CLI to detect and identify scalar types through type analysis.
 *
 * @example
 * ```typescript
 * // A type with scalar metadata
 * type MyScalar = Base & { " $gqlkitScalar"?: ScalarMetadataShape };
 * ```
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
 * type DateTime = DefineScalar<"DateTime", Date>;
 *
 * // Input-only scalar
 * type DateTimeInput = DefineScalar<"DateTime", Date, "input">;
 *
 * // Output-only scalar (can accept multiple base types)
 * type DateTimeOutput = DefineScalar<"DateTime", Date | string, "output">;
 * ```
 */
export type DefineScalar<
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
export type Int = DefineScalar<"Int", number>;

/**
 * GraphQL Float scalar type.
 * Use this to explicitly mark a field as a floating-point number.
 * Note: Plain `number` type will also map to Float by default.
 * Includes metadata for CLI detection.
 */
export type Float = DefineScalar<"Float", number>;

/**
 * GraphQL ID scalar type (string-based).
 * Use this when the ID is represented as a string in your system.
 * Includes metadata for CLI detection.
 */
export type IDString = DefineScalar<"ID", string>;

/**
 * GraphQL ID scalar type (number-based).
 * Use this when the ID is represented as a number in your system.
 * Includes metadata for CLI detection.
 */
export type IDNumber = DefineScalar<"ID", number>;

/**
 * Type alias representing no arguments for a resolver.
 * Use this when defining resolvers that don't accept any arguments.
 */
export type NoArgs = Record<string, never>;

/**
 * Type for Query resolver functions.
 * @typeParam TArgs - The type of arguments the resolver accepts
 * @typeParam TResult - The return type of the resolver
 * @typeParam TContext - The context type (defaults to unknown)
 */
export type QueryResolverFn<TArgs, TResult, TContext = unknown> = (
  root: undefined,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => TResult | Promise<TResult>;

/**
 * Type for Mutation resolver functions.
 * @typeParam TArgs - The type of arguments the resolver accepts
 * @typeParam TResult - The return type of the resolver
 * @typeParam TContext - The context type (defaults to unknown)
 */
export type MutationResolverFn<TArgs, TResult, TContext = unknown> = (
  root: undefined,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => TResult | Promise<TResult>;

/**
 * Type for Field resolver functions.
 * @typeParam TParent - The parent type this field belongs to
 * @typeParam TArgs - The type of arguments the resolver accepts
 * @typeParam TResult - The return type of the resolver
 * @typeParam TContext - The context type (defaults to unknown)
 */
export type FieldResolverFn<TParent, TArgs, TResult, TContext = unknown> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => TResult | Promise<TResult>;

/**
 * Type-level symbol for identifying resolvers.
 * This symbol only exists at the type level and has no runtime representation.
 * Used by CLI to detect resolvers through type analysis.
 */
declare const ResolverBrandSymbol: unique symbol;

/**
 * The type of the resolver brand symbol.
 * Export this type so users can access brand information from resolver types.
 */
export type ResolverBrand = typeof ResolverBrandSymbol;

/**
 * The kind of resolver.
 */
export type ResolverKind = "query" | "mutation" | "field";

/**
 * Branded Query resolver type.
 * Includes type-level metadata for CLI detection.
 * @typeParam TArgs - The type of arguments the resolver accepts
 * @typeParam TResult - The return type of the resolver
 * @typeParam TContext - The context type (defaults to unknown)
 */
export type QueryResolver<TArgs, TResult, TContext = unknown> = QueryResolverFn<
  TArgs,
  TResult,
  TContext
> & {
  [ResolverBrandSymbol]: {
    kind: "query";
    args: TArgs;
    result: TResult;
  };
};

/**
 * Branded Mutation resolver type.
 * Includes type-level metadata for CLI detection.
 * @typeParam TArgs - The type of arguments the resolver accepts
 * @typeParam TResult - The return type of the resolver
 * @typeParam TContext - The context type (defaults to unknown)
 */
export type MutationResolver<
  TArgs,
  TResult,
  TContext = unknown,
> = MutationResolverFn<TArgs, TResult, TContext> & {
  [ResolverBrandSymbol]: {
    kind: "mutation";
    args: TArgs;
    result: TResult;
  };
};

/**
 * Branded Field resolver type.
 * Includes type-level metadata for CLI detection.
 * @typeParam TParent - The parent type this field belongs to
 * @typeParam TArgs - The type of arguments the resolver accepts
 * @typeParam TResult - The return type of the resolver
 * @typeParam TContext - The context type (defaults to unknown)
 */
export type FieldResolver<
  TParent,
  TArgs,
  TResult,
  TContext = unknown,
> = FieldResolverFn<TParent, TArgs, TResult, TContext> & {
  [ResolverBrandSymbol]: {
    kind: "field";
    parent: TParent;
    args: TArgs;
    result: TResult;
  };
};

/**
 * The API set returned by createGqlkitApis.
 * Contains typed define functions for Query, Mutation, and Field resolvers.
 * @typeParam TContext - The context type for all resolvers in this API set
 */
export interface GqlkitApis<TContext> {
  /**
   * Defines a Query field resolver with the specified Context type.
   * @typeParam TArgs - The type of arguments the resolver accepts
   * @typeParam TResult - The return type of the resolver
   * @param resolver - The resolver function
   * @returns The resolver with branded type for CLI detection
   */
  defineQuery: <TArgs, TResult>(
    resolver: QueryResolverFn<TArgs, TResult, TContext>,
  ) => QueryResolver<TArgs, TResult, TContext>;

  /**
   * Defines a Mutation field resolver with the specified Context type.
   * @typeParam TArgs - The type of arguments the resolver accepts
   * @typeParam TResult - The return type of the resolver
   * @param resolver - The resolver function
   * @returns The resolver with branded type for CLI detection
   */
  defineMutation: <TArgs, TResult>(
    resolver: MutationResolverFn<TArgs, TResult, TContext>,
  ) => MutationResolver<TArgs, TResult, TContext>;

  /**
   * Defines an object type field resolver with the specified Context type.
   * @typeParam TParent - The parent type this field belongs to
   * @typeParam TArgs - The type of arguments the resolver accepts
   * @typeParam TResult - The return type of the resolver
   * @param resolver - The resolver function
   * @returns The resolver with branded type for CLI detection
   */
  defineField: <TParent, TArgs, TResult>(
    resolver: FieldResolverFn<TParent, TArgs, TResult, TContext>,
  ) => FieldResolver<TParent, TArgs, TResult, TContext>;
}

/**
 * Creates a set of typed define functions for GraphQL resolvers.
 * Use this factory to create API sets with custom Context types.
 *
 * @typeParam TContext - The context type for all resolvers (defaults to unknown)
 * @returns An object containing defineQuery, defineMutation, and defineField functions
 *
 * @example
 * ```typescript
 * type MyContext = { userId: string; db: Database };
 *
 * const { defineQuery, defineMutation, defineField } = createGqlkitApis<MyContext>();
 *
 * export const me = defineQuery<NoArgs, User>(
 *   (root, args, ctx, info) => ctx.db.findUser(ctx.userId)
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Multiple schemas with different contexts
 * type AdminContext = { adminId: string };
 * type PublicContext = { sessionId: string };
 *
 * const adminApis = createGqlkitApis<AdminContext>();
 * const publicApis = createGqlkitApis<PublicContext>();
 * ```
 */
export function createGqlkitApis<TContext = unknown>(): GqlkitApis<TContext> {
  return {
    defineQuery: <TArgs, TResult>(
      resolver: QueryResolverFn<TArgs, TResult, TContext>,
    ): QueryResolver<TArgs, TResult, TContext> => {
      return resolver as QueryResolver<TArgs, TResult, TContext>;
    },
    defineMutation: <TArgs, TResult>(
      resolver: MutationResolverFn<TArgs, TResult, TContext>,
    ): MutationResolver<TArgs, TResult, TContext> => {
      return resolver as MutationResolver<TArgs, TResult, TContext>;
    },
    defineField: <TParent, TArgs, TResult>(
      resolver: FieldResolverFn<TParent, TArgs, TResult, TContext>,
    ): FieldResolver<TParent, TArgs, TResult, TContext> => {
      return resolver as FieldResolver<TParent, TArgs, TResult, TContext>;
    },
  };
}
