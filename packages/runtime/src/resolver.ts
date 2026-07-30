import type { GraphQLResolveInfo } from "graphql";
import type { DirectiveLocation, GqlDirective } from "./directive.js";

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
 * Type for Subscription resolver functions.
 * Returns AsyncIterable for the subscription event stream.
 * @typeParam TArgs - The type of arguments the resolver accepts
 * @typeParam TResult - The type of each event in the subscription stream
 * @typeParam TContext - The context type (defaults to unknown)
 */
export type SubscriptionResolverFn<TArgs, TResult, TContext = unknown> = (
  root: undefined,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

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
 * The kind of resolver.
 */
export type ResolverKind = "query" | "mutation" | "field" | "subscription";

/**
 * The kind of abstract type resolver.
 */
export type AbstractResolverKind = "resolveType" | "isTypeOf";

/**
 * Type for resolveType resolver functions.
 * Used to resolve the concrete type of a union or interface type at runtime.
 * @typeParam TAbstract - The abstract type (union or interface) to resolve
 * @typeParam TContext - The context type (defaults to unknown)
 */
export type ResolveTypeResolverFn<TAbstract, TContext = unknown> = (
  value: TAbstract,
  context: TContext,
  info: GraphQLResolveInfo,
) => string | Promise<string>;

/**
 * Type for isTypeOf resolver functions.
 * Used to check if a value belongs to a specific object type.
 * @typeParam TContext - The context type (defaults to unknown)
 */
export type IsTypeOfResolverFn<TContext = unknown> = (
  value: unknown,
  context: TContext,
  info: GraphQLResolveInfo,
) => boolean | Promise<boolean>;

/**
 * Abstract type resolver metadata structure embedded in intersection types.
 * Used by CLI to detect and identify abstract type resolvers through type analysis.
 *
 * @internal Structural shape consumed by the CLI's shape-based type
 * detection, not by user code. Kept exported (rather than removed) because
 * `ResolveTypeResolver`/`IsTypeOfResolver`'s metadata marker is typed in
 * terms of it.
 */
export interface AbstractResolverMetadataShape {
  readonly kind: AbstractResolverKind;
  readonly targetType: unknown;
}

/**
 * resolveType resolver type with metadata.
 * The metadata is embedded as an optional property with space-prefixed key
 * to avoid collision with user-defined properties.
 * @typeParam TAbstract - The abstract type (union or interface) to resolve
 * @typeParam TContext - The context type (defaults to unknown)
 */
export type ResolveTypeResolver<
  TAbstract,
  TContext = unknown,
> = ResolveTypeResolverFn<TAbstract, TContext> & {
  " $gqlkitAbstractResolver"?: {
    kind: "resolveType";
    targetType: TAbstract;
  };
};

/**
 * isTypeOf resolver type with metadata.
 * The metadata is embedded as an optional property with space-prefixed key
 * to avoid collision with user-defined properties.
 * @typeParam TObject - The object type to check
 * @typeParam TContext - The context type (defaults to unknown)
 */
export type IsTypeOfResolver<
  TObject,
  TContext = unknown,
> = IsTypeOfResolverFn<TContext> & {
  " $gqlkitAbstractResolver"?: {
    kind: "isTypeOf";
    targetType: TObject;
  };
};

/**
 * Resolver metadata structure embedded in intersection types.
 * Used by CLI to detect and identify resolver types through type analysis.
 *
 * @internal Structural shape consumed by the CLI's shape-based type
 * detection, not by user code. Kept exported (rather than removed) because
 * `QueryResolver`/`MutationResolver`/`SubscriptionResolver`/`FieldResolver`'s
 * metadata marker is typed in terms of it.
 */
export interface ResolverMetadataShape {
  readonly kind: ResolverKind;
  readonly args: unknown;
  readonly result: unknown;
  readonly parent?: unknown;
}

/**
 * Query resolver type with metadata.
 * The metadata is embedded as an optional property with space-prefixed key
 * to avoid collision with user-defined properties.
 * @typeParam TArgs - The type of arguments the resolver accepts
 * @typeParam TResult - The return type of the resolver
 * @typeParam TContext - The context type (defaults to unknown)
 * @typeParam TDirectives - Array of directives to attach to this field (defaults to [])
 */
export type QueryResolver<
  TArgs,
  TResult,
  TContext = unknown,
  TDirectives extends ReadonlyArray<
    GqlDirective<
      string,
      Record<string, unknown>,
      DirectiveLocation | DirectiveLocation[]
    >
  > = [],
> = QueryResolverFn<TArgs, TResult, TContext> & {
  " $gqlkitResolver"?: {
    kind: "query";
    args: TArgs;
    result: TResult;
    directives: TDirectives;
  };
};

/**
 * Mutation resolver type with metadata.
 * The metadata is embedded as an optional property with space-prefixed key
 * to avoid collision with user-defined properties.
 * @typeParam TArgs - The type of arguments the resolver accepts
 * @typeParam TResult - The return type of the resolver
 * @typeParam TContext - The context type (defaults to unknown)
 * @typeParam TDirectives - Array of directives to attach to this field (defaults to [])
 */
export type MutationResolver<
  TArgs,
  TResult,
  TContext = unknown,
  TDirectives extends ReadonlyArray<
    GqlDirective<
      string,
      Record<string, unknown>,
      DirectiveLocation | DirectiveLocation[]
    >
  > = [],
> = MutationResolverFn<TArgs, TResult, TContext> & {
  " $gqlkitResolver"?: {
    kind: "mutation";
    args: TArgs;
    result: TResult;
    directives: TDirectives;
  };
};

/**
 * Subscription resolver type with metadata.
 * The metadata is embedded as an optional property with space-prefixed key
 * to avoid collision with user-defined properties.
 * @typeParam TArgs - The type of arguments the resolver accepts
 * @typeParam TResult - The type of each event in the subscription stream
 * @typeParam TContext - The context type (defaults to unknown)
 * @typeParam TDirectives - Array of directives to attach to this field (defaults to [])
 */
export type SubscriptionResolver<
  TArgs,
  TResult,
  TContext = unknown,
  TDirectives extends ReadonlyArray<
    GqlDirective<
      string,
      Record<string, unknown>,
      DirectiveLocation | DirectiveLocation[]
    >
  > = [],
> = SubscriptionResolverFn<TArgs, TResult, TContext> & {
  " $gqlkitResolver"?: {
    kind: "subscription";
    args: TArgs;
    result: TResult;
    directives: TDirectives;
  };
};

/**
 * Field resolver type with metadata.
 * The metadata is embedded as an optional property with space-prefixed key
 * to avoid collision with user-defined properties.
 * @typeParam TParent - The parent type this field belongs to
 * @typeParam TArgs - The type of arguments the resolver accepts
 * @typeParam TResult - The return type of the resolver
 * @typeParam TContext - The context type (defaults to unknown)
 * @typeParam TDirectives - Array of directives to attach to this field (defaults to [])
 */
export type FieldResolver<
  TParent,
  TArgs,
  TResult,
  TContext = unknown,
  TDirectives extends ReadonlyArray<
    GqlDirective<
      string,
      Record<string, unknown>,
      DirectiveLocation | DirectiveLocation[]
    >
  > = [],
> = FieldResolverFn<TParent, TArgs, TResult, TContext> & {
  " $gqlkitResolver"?: {
    kind: "field";
    parent: TParent;
    args: TArgs;
    result: TResult;
    directives: TDirectives;
  };
};
