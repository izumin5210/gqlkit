import type { GraphQLResolveInfo } from "graphql";

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
 * type AuthDirective<R extends string[]> = Directive<"auth", { roles: R }, "FIELD_DEFINITION">;
 * type CacheDirective = Directive<"cache", { maxAge: number }, "FIELD_DEFINITION" | "OBJECT">;
 * ```
 */
export type Directive<
  Name extends string,
  Args extends Record<string, unknown> = Record<string, never>,
  Location extends DirectiveLocation | DirectiveLocation[] = DirectiveLocation,
> = {
  readonly " $directiveName": Name;
  readonly " $directiveArgs": Args;
  readonly " $directiveLocation": Location;
};

/**
 * Metadata structure for field-level GraphQL metadata.
 * Used to attach directives and other metadata to individual fields.
 *
 * @typeParam Meta - The metadata configuration object
 */
export interface GqlFieldMetaShape<
  Meta extends {
    directives: ReadonlyArray<
      Directive<
        string,
        Record<string, unknown>,
        DirectiveLocation | DirectiveLocation[]
      >
    >;
  },
> {
  readonly directives: Meta["directives"];
}

/**
 * Attaches metadata to a field type.
 * The metadata is embedded as optional properties to maintain compatibility
 * with the underlying type.
 *
 * The structure uses two properties:
 * - `$gqlkitFieldMeta`: Contains the metadata object with directives
 * - `$gqlkitOriginalType`: Preserves the original type T to maintain nullability information
 *
 * This design is necessary because TypeScript normalizes `(T | null) & { metadata }` to
 * `(T & { metadata }) | never`, which loses the null part of the union. By storing
 * the original type in `$gqlkitOriginalType`, we can recover the full type information
 * during CLI analysis.
 *
 * @typeParam T - The base type to attach metadata to
 * @typeParam Meta - The metadata configuration object containing directives
 *
 * @example
 * ```typescript
 * type User = {
 *   id: GqlFieldDef<IDString, { directives: [AuthDirective<{ role: ["USER"] }>] }>;
 *   bio: GqlFieldDef<string | null, { directives: [AuthDirective<{ role: ["ADMIN"] }>] }>;
 * };
 * ```
 */
export type GqlFieldDef<
  T,
  Meta extends {
    directives: ReadonlyArray<
      Directive<
        string,
        Record<string, unknown>,
        DirectiveLocation | DirectiveLocation[]
      >
    >;
  },
> = T & {
  readonly " $gqlkitFieldMeta"?: GqlFieldMetaShape<Meta>;
  readonly " $gqlkitOriginalType"?: T;
};

/**
 * Marker type for DefineInterface - used internally for type discrimination.
 */
export type DefineInterfaceMarker = Record<string, unknown>;

/**
 * Interface metadata structure embedded in intersection types.
 * Used by CLI to detect and identify interface types through type analysis.
 *
 * @typeParam Meta - The metadata configuration object containing implements
 */
export interface GqlInterfaceMetaShape<
  Meta extends {
    implements?: ReadonlyArray<DefineInterfaceMarker>;
  } = object,
> {
  readonly " $gqlkitInterface": true;
  readonly implements?: Meta["implements"];
}

/**
 * GraphQL interface type definition utility.
 * Use this to define GraphQL interface types that can be implemented by object types.
 *
 * @typeParam T - The interface field definitions as an object type
 * @typeParam Meta - Optional metadata containing implements for interface inheritance
 *
 * @example
 * ```typescript
 * // Basic interface definition
 * export type Node = DefineInterface<{
 *   id: IDString;
 * }>;
 *
 * export type Timestamped = DefineInterface<{
 *   createdAt: DateTime;
 *   updatedAt: DateTime;
 * }>;
 *
 * // Interface inheriting other interfaces
 * export type Entity = DefineInterface<
 *   {
 *     id: IDString;
 *     createdAt: DateTime;
 *     updatedAt: DateTime;
 *   },
 *   { implements: [Node, Timestamped] }
 * >;
 * ```
 */
export type DefineInterface<
  T extends Record<string, unknown>,
  Meta extends {
    implements?: ReadonlyArray<DefineInterfaceMarker>;
  } = object,
> = T & {
  readonly " $gqlkitInterfaceMeta"?: GqlInterfaceMetaShape<Meta>;
};

/**
 * Metadata structure for type-level GraphQL metadata.
 * Used to attach directives and other metadata to types.
 *
 * @typeParam Meta - The metadata configuration object
 */
export interface GqlTypeMetaShape<
  Meta extends {
    directives?: ReadonlyArray<
      Directive<
        string,
        Record<string, unknown>,
        DirectiveLocation | DirectiveLocation[]
      >
    >;
    implements?: ReadonlyArray<DefineInterfaceMarker>;
  },
> {
  readonly directives?: Meta["directives"];
  readonly implements?: Meta["implements"];
}

/**
 * Attaches metadata to a type definition.
 * The metadata is embedded as optional properties to maintain compatibility
 * with the underlying type.
 *
 * The structure uses two properties:
 * - `$gqlkitTypeMeta`: Contains the metadata object with directives and implements
 * - `$gqlkitOriginalType`: Preserves the original type T to maintain nullability information
 *
 * @typeParam T - The base type to attach metadata to
 * @typeParam Meta - The metadata configuration object containing directives and/or implements
 *
 * @example
 * ```typescript
 * // Type with directives only
 * type User = GqlTypeDef<
 *   {
 *     id: string;
 *     name: string;
 *   },
 *   { directives: [CacheDirective<{ maxAge: 60 }>] }
 * >;
 *
 * // Type implementing an interface
 * type User = GqlTypeDef<
 *   {
 *     id: IDString;
 *     name: string;
 *   },
 *   { implements: [Node] }
 * >;
 *
 * // Type with both directives and implements
 * type Post = GqlTypeDef<
 *   {
 *     id: IDString;
 *     title: string;
 *     createdAt: DateTime;
 *   },
 *   {
 *     implements: [Node, Timestamped],
 *     directives: [CacheDirective<{ maxAge: 60 }>]
 *   }
 * >;
 * ```
 */
export type GqlTypeDef<
  T,
  Meta extends {
    directives?: ReadonlyArray<
      Directive<
        string,
        Record<string, unknown>,
        DirectiveLocation | DirectiveLocation[]
      >
    >;
    implements?: ReadonlyArray<DefineInterfaceMarker>;
  } = { directives: [] },
> = T & {
  readonly " $gqlkitTypeMeta"?: GqlTypeMetaShape<Meta>;
  readonly " $gqlkitOriginalType"?: T;
};

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
 * The kind of resolver.
 */
export type ResolverKind = "query" | "mutation" | "field";

/**
 * Resolver metadata structure embedded in intersection types.
 * Used by CLI to detect and identify resolver types through type analysis.
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
    Directive<
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
    Directive<
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
    Directive<
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
   * @typeParam TDirectives - Array of directives to attach to this field (defaults to [])
   * @param resolver - The resolver function
   * @returns The resolver with metadata for CLI detection
   *
   * @example
   * ```typescript
   * // Without directives
   * export const users = defineQuery<NoArgs, User[]>(() => []);
   *
   * // With directives
   * export const me = defineQuery<NoArgs, User, [AuthDirective<{ role: ["USER"] }>]>(
   *   (root, args, ctx) => ctx.currentUser
   * );
   * ```
   */
  defineQuery: <
    TArgs,
    TResult,
    TDirectives extends ReadonlyArray<
      Directive<
        string,
        Record<string, unknown>,
        DirectiveLocation | DirectiveLocation[]
      >
    > = [],
  >(
    resolver: QueryResolverFn<TArgs, TResult, TContext>,
  ) => QueryResolver<TArgs, TResult, TContext, TDirectives>;

  /**
   * Defines a Mutation field resolver with the specified Context type.
   * @typeParam TArgs - The type of arguments the resolver accepts
   * @typeParam TResult - The return type of the resolver
   * @typeParam TDirectives - Array of directives to attach to this field (defaults to [])
   * @param resolver - The resolver function
   * @returns The resolver with metadata for CLI detection
   *
   * @example
   * ```typescript
   * // Without directives
   * export const createUser = defineMutation<CreateUserInput, User>((root, args) => ({ ... }));
   *
   * // With directives
   * export const deleteUser = defineMutation<{ id: string }, boolean, [AuthDirective<{ role: ["ADMIN"] }>]>(
   *   (root, args, ctx) => true
   * );
   * ```
   */
  defineMutation: <
    TArgs,
    TResult,
    TDirectives extends ReadonlyArray<
      Directive<
        string,
        Record<string, unknown>,
        DirectiveLocation | DirectiveLocation[]
      >
    > = [],
  >(
    resolver: MutationResolverFn<TArgs, TResult, TContext>,
  ) => MutationResolver<TArgs, TResult, TContext, TDirectives>;

  /**
   * Defines an object type field resolver with the specified Context type.
   * @typeParam TParent - The parent type this field belongs to
   * @typeParam TArgs - The type of arguments the resolver accepts
   * @typeParam TResult - The return type of the resolver
   * @typeParam TDirectives - Array of directives to attach to this field (defaults to [])
   * @param resolver - The resolver function
   * @returns The resolver with metadata for CLI detection
   *
   * @example
   * ```typescript
   * // Without directives
   * export const userPosts = defineField<User, NoArgs, Post[]>((parent) => []);
   *
   * // With directives
   * export const userEmail = defineField<User, NoArgs, string, [AuthDirective<{ role: ["ADMIN"] }>]>(
   *   (parent) => parent.email
   * );
   * ```
   */
  defineField: <
    TParent,
    TArgs,
    TResult,
    TDirectives extends ReadonlyArray<
      Directive<
        string,
        Record<string, unknown>,
        DirectiveLocation | DirectiveLocation[]
      >
    > = [],
  >(
    resolver: FieldResolverFn<TParent, TArgs, TResult, TContext>,
  ) => FieldResolver<TParent, TArgs, TResult, TContext, TDirectives>;
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
  const apis = {
    defineQuery: <TArgs, TResult>(
      resolver: QueryResolverFn<TArgs, TResult, TContext>,
    ) => {
      return resolver;
    },
    defineMutation: <TArgs, TResult>(
      resolver: MutationResolverFn<TArgs, TResult, TContext>,
    ) => {
      return resolver;
    },
    defineField: <TParent, TArgs, TResult>(
      resolver: FieldResolverFn<TParent, TArgs, TResult, TContext>,
    ) => {
      return resolver;
    },
  };
  return apis as unknown as GqlkitApis<TContext>;
}
