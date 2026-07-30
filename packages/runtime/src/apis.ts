import type { DirectiveLocation, GqlDirective } from "./directive.js";
import type {
  FieldResolver,
  FieldResolverFn,
  IsTypeOfResolver,
  IsTypeOfResolverFn,
  MutationResolver,
  MutationResolverFn,
  QueryResolver,
  QueryResolverFn,
  ResolveTypeResolver,
  ResolveTypeResolverFn,
  SubscriptionResolver,
  SubscriptionResolverFn,
} from "./resolver.js";

/**
 * The API set returned by createGqlkitApis.
 * Contains typed define functions for Query, Mutation, and Field resolvers.
 * @typeParam TContext - The context type for all resolvers in this API set
 */
export interface GqlkitApis<TContext> {
  /**
   * Defines a Query field resolver with the specified Context type.
   *
   * IMPORTANT: Explicit type arguments are required, e.g. `defineQuery<Args, Result>(...)`.
   * The CLI extracts `Args`/`Result` by reading the syntactic type arguments on the
   * call expression (it does not run TypeScript's inference engine), so a call that
   * relies on inference alone fails generation with `INVALID_DEFINE_CALL`.
   *
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
      GqlDirective<
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
   *
   * IMPORTANT: Explicit type arguments are required, e.g. `defineMutation<Args, Result>(...)`.
   * The CLI extracts `Args`/`Result` by reading the syntactic type arguments on the
   * call expression (it does not run TypeScript's inference engine), so a call that
   * relies on inference alone fails generation with `INVALID_DEFINE_CALL`.
   *
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
      GqlDirective<
        string,
        Record<string, unknown>,
        DirectiveLocation | DirectiveLocation[]
      >
    > = [],
  >(
    resolver: MutationResolverFn<TArgs, TResult, TContext>,
  ) => MutationResolver<TArgs, TResult, TContext, TDirectives>;

  /**
   * Defines a Subscription field resolver with the specified Context type.
   *
   * IMPORTANT: Explicit type arguments are required, e.g. `defineSubscription<Args, Result>(...)`.
   * The CLI extracts `Args`/`Result` by reading the syntactic type arguments on the
   * call expression (it does not run TypeScript's inference engine), so a call that
   * relies on inference alone fails generation with `INVALID_DEFINE_CALL`.
   *
   * @typeParam TArgs - The type of arguments the resolver accepts
   * @typeParam TResult - The type of each event in the subscription stream
   * @typeParam TDirectives - Array of directives to attach to this field (defaults to [])
   * @param resolver - The resolver function returning an AsyncIterable
   * @returns The resolver with metadata for CLI detection
   *
   * @example
   * ```typescript
   * // Without directives
   * export const messageAdded = defineSubscription<{ channelId: string }, Message>(
   *   async function* (_root, args, ctx) {
   *     yield* ctx.pubsub.subscribe(`channel:${args.channelId}`);
   *   }
   * );
   *
   * // With directives
   * export const userStatusChanged = defineSubscription<NoArgs, UserStatus, [AuthDirective<{ role: ["USER"] }>]>(
   *   async function* (_root, _args, ctx) {
   *     yield* ctx.pubsub.subscribe("userStatus");
   *   }
   * );
   * ```
   */
  defineSubscription: <
    TArgs,
    TResult,
    TDirectives extends ReadonlyArray<
      GqlDirective<
        string,
        Record<string, unknown>,
        DirectiveLocation | DirectiveLocation[]
      >
    > = [],
  >(
    resolver: SubscriptionResolverFn<TArgs, TResult, TContext>,
  ) => SubscriptionResolver<TArgs, TResult, TContext, TDirectives>;

  /**
   * Defines an object type field resolver with the specified Context type.
   *
   * IMPORTANT: Explicit type arguments are required, e.g. `defineField<Parent, Args, Result>(...)`.
   * The CLI extracts `TParent`/`TArgs`/`TResult` by reading the syntactic type arguments
   * on the call expression (it does not run TypeScript's inference engine), so a call
   * that relies on inference alone fails generation with `INVALID_DEFINE_CALL`.
   *
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
      GqlDirective<
        string,
        Record<string, unknown>,
        DirectiveLocation | DirectiveLocation[]
      >
    > = [],
  >(
    resolver: FieldResolverFn<TParent, TArgs, TResult, TContext>,
  ) => FieldResolver<TParent, TArgs, TResult, TContext, TDirectives>;

  /**
   * Defines a resolveType resolver for union or interface types.
   * Used to determine the concrete type of an abstract type at runtime.
   * @typeParam TAbstract - The abstract type (union or interface) to resolve
   * @param resolver - The resolver function that returns the concrete type name
   * @returns The resolver with metadata for CLI detection
   *
   * @example
   * ```typescript
   * type Animal = Dog | Cat;
   *
   * export const animalResolveType = defineResolveType<Animal>((value) => {
   *   return value.kind === "dog" ? "Dog" : "Cat";
   * });
   * ```
   */
  defineResolveType: <TAbstract>(
    resolver: ResolveTypeResolverFn<TAbstract, TContext>,
  ) => ResolveTypeResolver<TAbstract, TContext>;

  /**
   * Defines an isTypeOf resolver for object types.
   * Used to check if a value belongs to a specific object type.
   * @typeParam TObject - The object type to check
   * @param resolver - The resolver function that returns true if the value is of this type
   * @returns The resolver with metadata for CLI detection
   *
   * @example
   * ```typescript
   * export const dogIsTypeOf = defineIsTypeOf<Dog>((value) => {
   *   return typeof value === "object" && value !== null && "kind" in value && value.kind === "dog";
   * });
   * ```
   */
  defineIsTypeOf: <TObject>(
    resolver: IsTypeOfResolverFn<TContext>,
  ) => IsTypeOfResolver<TObject, TContext>;
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
    defineSubscription: <TArgs, TResult>(
      resolver: SubscriptionResolverFn<TArgs, TResult, TContext>,
    ) => {
      return resolver;
    },
    defineField: <TParent, TArgs, TResult>(
      resolver: FieldResolverFn<TParent, TArgs, TResult, TContext>,
    ) => {
      return resolver;
    },
    defineResolveType: <TAbstract>(
      resolver: ResolveTypeResolverFn<TAbstract, TContext>,
    ) => {
      return resolver;
    },
    defineIsTypeOf: (resolver: IsTypeOfResolverFn<TContext>) => {
      return resolver;
    },
  };
  return apis as unknown as GqlkitApis<TContext>;
}
