import type { GraphQLResolveInfo } from "graphql";

/**
 * Global namespace for gqlkit configuration.
 * Users can extend this namespace to provide custom Context type.
 *
 * @example
 * ```typescript
 * declare global {
 *   namespace Gqlkit {
 *     interface Context {
 *       userId: string;
 *       db: Database;
 *     }
 *   }
 * }
 * ```
 */
declare global {
  namespace Gqlkit {
    interface Context {}
  }
}

/**
 * The context type used in resolver functions.
 * If user has extended Gqlkit.Context, uses that type.
 * Otherwise falls back to `unknown`.
 */
export type GqlkitContext =
  Gqlkit.Context extends Record<string, never> ? unknown : Gqlkit.Context;

/**
 * Type alias representing no arguments for a resolver.
 * Use this when defining resolvers that don't accept any arguments.
 */
export type NoArgs = Record<string, never>;

/**
 * Type for Query resolver functions.
 * @typeParam TArgs - The type of arguments the resolver accepts
 * @typeParam TResult - The return type of the resolver
 */
export type QueryResolverFn<TArgs, TResult> = (
  root: undefined,
  args: TArgs,
  context: GqlkitContext,
  info: GraphQLResolveInfo,
) => TResult | Promise<TResult>;

/**
 * Type for Mutation resolver functions.
 * @typeParam TArgs - The type of arguments the resolver accepts
 * @typeParam TResult - The return type of the resolver
 */
export type MutationResolverFn<TArgs, TResult> = (
  root: undefined,
  args: TArgs,
  context: GqlkitContext,
  info: GraphQLResolveInfo,
) => TResult | Promise<TResult>;

/**
 * Type for Field resolver functions.
 * @typeParam TParent - The parent type this field belongs to
 * @typeParam TArgs - The type of arguments the resolver accepts
 * @typeParam TResult - The return type of the resolver
 */
export type FieldResolverFn<TParent, TArgs, TResult> = (
  parent: TParent,
  args: TArgs,
  context: GqlkitContext,
  info: GraphQLResolveInfo,
) => TResult | Promise<TResult>;

/**
 * Defines a Query field resolver.
 * This is an identity function that provides type safety for Query resolvers.
 *
 * @typeParam TArgs - The type of arguments (use NoArgs for no arguments)
 * @typeParam TResult - The return type of the resolver
 * @param resolver - The resolver function
 * @returns The same resolver function
 *
 * @example
 * ```typescript
 * export const me = defineQuery<NoArgs, User>(
 *   (root, args, ctx, info) => ctx.currentUser
 * );
 *
 * export const user = defineQuery<{ id: string }, User>(
 *   (root, args, ctx, info) => findUser(args.id)
 * );
 * ```
 */
export function defineQuery<TArgs, TResult>(
  resolver: QueryResolverFn<TArgs, TResult>,
): QueryResolverFn<TArgs, TResult> {
  return resolver;
}

/**
 * Defines a Mutation field resolver.
 * This is an identity function that provides type safety for Mutation resolvers.
 *
 * @typeParam TArgs - The type of arguments (use NoArgs for no arguments)
 * @typeParam TResult - The return type of the resolver
 * @param resolver - The resolver function
 * @returns The same resolver function
 *
 * @example
 * ```typescript
 * export const createUser = defineMutation<{ input: CreateUserInput }, User>(
 *   (root, args, ctx, info) => createNewUser(args.input)
 * );
 * ```
 */
export function defineMutation<TArgs, TResult>(
  resolver: MutationResolverFn<TArgs, TResult>,
): MutationResolverFn<TArgs, TResult> {
  return resolver;
}

/**
 * Defines an object type field resolver.
 * This is an identity function that provides type safety for field resolvers.
 *
 * @typeParam TParent - The parent type (must be defined in src/gql/types)
 * @typeParam TArgs - The type of arguments (use NoArgs for no arguments)
 * @typeParam TResult - The return type of the resolver
 * @param resolver - The resolver function
 * @returns The same resolver function
 *
 * @example
 * ```typescript
 * export const fullName = defineField<User, NoArgs, string>(
 *   (parent, args, ctx, info) => `${parent.firstName} ${parent.lastName}`
 * );
 *
 * export const posts = defineField<User, { limit: number }, Post[]>(
 *   (parent, args, ctx, info) => findPostsByUser(parent.id, args.limit)
 * );
 * ```
 */
export function defineField<TParent, TArgs, TResult>(
  resolver: FieldResolverFn<TParent, TArgs, TResult>,
): FieldResolverFn<TParent, TArgs, TResult> {
  return resolver;
}
