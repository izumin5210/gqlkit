import type { GraphQLResolveInfo } from "graphql";

/**
 * The key for scalar metadata property.
 * Uses a string with a leading space to prevent accidental collisions with user-defined properties.
 * Used by CLI to detect scalar types through type analysis.
 */
export type ScalarMetadataKey = " $gqlkitScalar";

/**
 * The shape of scalar metadata embedded in intersection types.
 * @property name - The GraphQL scalar name (e.g., "Int", "ID", "DateTime")
 * @property only - Optional constraint: "input" for input-only, "output" for output-only, undefined for both
 */
export interface ScalarMetadataShape {
  readonly name: string;
  readonly only?: "input" | "output";
}

/**
 * Utility type for defining custom scalar types with metadata.
 * Creates an intersection type that embeds GraphQL scalar metadata while preserving
 * compatibility with the underlying TypeScript type.
 *
 * @typeParam Name - The GraphQL scalar name (e.g., "DateTime", "URL")
 * @typeParam Base - The underlying TypeScript type
 * @typeParam Only - Optional usage constraint: "input" | "output" | undefined (default: undefined for both)
 *
 * @example
 * ```typescript
 * // Input/output both (default)
 * type DateTime = DefineScalar<"DateTime", Date>;
 *
 * // Output only (resolver can return this)
 * type DateTimeOutput = DefineScalar<"DateTime", Date | string, "output">;
 *
 * // Input only (resolver receives this)
 * type DateTimeInput = DefineScalar<"DateTime", Date, "input">;
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
 * Type for GraphQL ID scalar (string-based).
 * Use this when the ID is represented as a string in your system.
 * The CLI detects this type by the embedded metadata to map to GraphQL ID.
 */
export type IDString = DefineScalar<"ID", string>;

/**
 * Type for GraphQL ID scalar (number-based).
 * Use this when the ID is represented as a number in your system.
 * The CLI detects this type by the embedded metadata to map to GraphQL ID.
 */
export type IDNumber = DefineScalar<"ID", number>;

/**
 * Type for GraphQL Int scalar.
 * Use this to explicitly mark a field as an integer.
 * The CLI detects this type by the embedded metadata to map to GraphQL Int.
 */
export type Int = DefineScalar<"Int", number>;

/**
 * Type for GraphQL Float scalar.
 * Use this to explicitly mark a field as a floating-point number.
 * The CLI detects this type by the embedded metadata to map to GraphQL Float.
 * Note: Plain `number` type will also map to Float by default.
 */
export type Float = DefineScalar<"Float", number>;

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
 * The key for resolver metadata property.
 * Uses a string with spaces to prevent accidental collisions with user-defined properties.
 * Used by CLI to detect resolvers through type analysis.
 */
export type ResolverMetadataKey = " $gqlkitResolver ";

/**
 * The kind of resolver.
 */
export type ResolverKind = "query" | "mutation" | "field";

/**
 * Query resolver type with metadata for CLI detection.
 * @typeParam TArgs - The type of arguments the resolver accepts
 * @typeParam TResult - The return type of the resolver
 * @typeParam TContext - The context type (defaults to unknown)
 */
export type QueryResolver<TArgs, TResult, TContext = unknown> = QueryResolverFn<
  TArgs,
  TResult,
  TContext
> & {
  [" $gqlkitResolver "]?: {
    kind: "query";
    args: TArgs;
    result: TResult;
  };
};

/**
 * Mutation resolver type with metadata for CLI detection.
 * @typeParam TArgs - The type of arguments the resolver accepts
 * @typeParam TResult - The return type of the resolver
 * @typeParam TContext - The context type (defaults to unknown)
 */
export type MutationResolver<
  TArgs,
  TResult,
  TContext = unknown,
> = MutationResolverFn<TArgs, TResult, TContext> & {
  [" $gqlkitResolver "]?: {
    kind: "mutation";
    args: TArgs;
    result: TResult;
  };
};

/**
 * Field resolver type with metadata for CLI detection.
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
  [" $gqlkitResolver "]?: {
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
