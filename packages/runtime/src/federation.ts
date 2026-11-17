import {
  type GraphQLObjectType,
  type GraphQLOutputType,
  type GraphQLResolveInfo,
  GraphQLScalarType,
  isLeafType,
  isListType,
  isNonNullType,
  isObjectType,
  valueFromASTUntyped,
} from "graphql";
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

type Whitespace = " " | "," | "\n" | "\r" | "\t";

type TrimStart<S extends string> = S extends `${Whitespace}${infer Rest}`
  ? TrimStart<Rest>
  : S;

type ReadName<
  S extends string,
  Name extends string = "",
> = S extends `${infer Char}${infer Rest}`
  ? Char extends Whitespace | "{" | "}"
    ? [Name, S]
    : ReadName<Rest, `${Name}${Char}`>
  : [Name, ""];

/**
 * Parses a key such as `"id organization { id }"` into a tree of the
 * selected field names, `{ id: true; organization: { id: true } }`.
 * Returns the tree and the input left after the closing `}`.
 */
type ParseSelections<S extends string, Tree = unknown> =
  TrimStart<S> extends infer T extends string
    ? T extends ""
      ? [Tree, ""]
      : T extends `}${infer Rest}`
        ? [Tree, Rest]
        : ReadName<T> extends [
              infer Name extends string,
              infer AfterName extends string,
            ]
          ? Name extends ""
            ? [Tree, ""]
            : TrimStart<AfterName> extends `{${infer Inner}`
              ? ParseSelections<Inner> extends [
                  infer Sub,
                  infer AfterSub extends string,
                ]
                ? ParseSelections<AfterSub, Tree & Record<Name, Sub>>
                : never
              : ParseSelections<AfterName, Tree & Record<Name, true>>
          : never
    : never;

type SelectKeyFields<T, Tree> = {
  [K in keyof Tree & keyof T]: Tree[K] extends true
    ? T[K]
    : SelectKeyFields<NonNullable<T[K]>, Tree[K]>;
};

type KeyDirectivesOf<TEntity> = TEntity extends {
  readonly " $gqlkitTypeMeta"?: infer Meta;
}
  ? NonNullable<Meta> extends { readonly directives?: infer Directives }
    ? NonNullable<Directives>
    : []
  : [];

type ResolvableKeyFields<Directives> = Directives extends readonly [
  infer Head,
  ...infer Tail,
]
  ?
      | (Head extends {
          readonly " $gqlkitFederationDirective": "key";
          readonly " $directiveArgs": infer Args;
        }
          ? Args extends { readonly resolvable: false }
            ? never
            : Args extends { readonly fields: infer Fields extends string }
              ? Fields
              : never
          : never)
      | ResolvableKeyFields<Tail>
  : never;

type ReferenceForKey<TEntity, Fields> = Fields extends string
  ? { readonly __typename: string } & SelectKeyFields<
      TEntity,
      ParseSelections<Fields>[0]
    >
  : never;

/**
 * The representation of an entity that the gateway passes to
 * `__resolveReference`: `__typename` and the fields of one of the entity's
 * resolvable keys. A union when the entity has several keys.
 *
 * @typeParam TEntity - A `GqlObject` type with `Key` directives
 */
export type EntityReference<TEntity> = ReferenceForKey<
  TEntity,
  ResolvableKeyFields<KeyDirectivesOf<TEntity>>
>;

/**
 * Type for `__resolveReference` functions. Apollo Federation only.
 * @typeParam TEntity - The entity type to resolve
 * @typeParam TContext - The context type (defaults to unknown)
 */
export type ResolveReferenceFn<TEntity, TContext = unknown> = (
  reference: EntityReference<TEntity>,
  context: TContext,
  info: GraphQLResolveInfo,
) => TEntity | null | Promise<TEntity | null>;

/**
 * `__resolveReference` resolver type with metadata.
 * The metadata is embedded as an optional property with space-prefixed key
 * to avoid collision with user-defined properties.
 */
export type ReferenceResolver<TEntity, TContext = unknown> = ResolveReferenceFn<
  TEntity,
  TContext
> & {
  " $gqlkitAbstractResolver"?: {
    kind: "resolveReference";
    targetType: TEntity;
  };
};

/**
 * The API set returned by {@link createFederationApis}.
 * @typeParam TContext - The context type for all resolvers in this API set
 */
export interface FederationApis<TContext> {
  /**
   * Defines how this subgraph resolves an entity from the reference the
   * gateway sends (`__resolveReference`). Apollo Federation only.
   *
   * Pass the entity type explicitly. The reference has `__typename` and the
   * fields of one of the entity's resolvable keys, with values converted
   * the same way as arguments (e.g. enum values and custom scalars).
   *
   * @example
   * ```typescript
   * export const userReference = defineResolveReference<User>(
   *   (ref, ctx) => ctx.users.load(ref.id),
   * );
   * ```
   */
  defineResolveReference: <TEntity>(
    resolver: ResolveReferenceFn<TEntity, TContext>,
  ) => ReferenceResolver<TEntity, TContext>;
}

/**
 * Creates define functions for federation subgraphs.
 *
 * @typeParam TContext - The context type for all resolvers (defaults to unknown)
 */
export function createFederationApis<
  TContext = unknown,
>(): FederationApis<TContext> {
  const apis = {
    defineResolveReference: <TEntity>(
      resolver: ResolveReferenceFn<TEntity, TContext>,
    ) => resolver,
  };
  return apis as unknown as FederationApis<TContext>;
}

/**
 * Converts a value from a representation, which the gateway sends in its
 * serialized form, the way graphql-js converts an argument of the field's
 * type: enum names to internal values, custom scalars with `parseValue`.
 */
function parseRepresentationValue(
  value: unknown,
  type: GraphQLOutputType,
): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (isNonNullType(type)) {
    return parseRepresentationValue(value, type.ofType);
  }
  if (isListType(type)) {
    return Array.isArray(value)
      ? value.map((item) => parseRepresentationValue(item, type.ofType))
      : value;
  }
  if (isLeafType(type)) {
    const parsed: unknown = type.parseValue(value);
    if (parsed === undefined) {
      throw new TypeError(
        `${JSON.stringify(value)} is not a valid ${type.name} value`,
      );
    }
    return parsed;
  }
  if (isObjectType(type) && typeof value === "object") {
    return parseRepresentationFields(value as Record<string, unknown>, type);
  }
  return value;
}

function parseRepresentationFields(
  representation: Record<string, unknown>,
  type: GraphQLObjectType,
): Record<string, unknown> {
  const fields = type.getFields();
  const parsed: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(representation)) {
    const field = fields[name];
    parsed[name] =
      field === undefined ? value : parseRepresentationValue(value, field.type);
  }
  return parsed;
}

/** The parts of a subgraph schema's resolvers that federation defines. */
export interface SubgraphResolversOptions {
  /** The subgraph SDL that `_service { sdl }` returns. */
  readonly sdl: string;
  /** Types in the `_Entity` union. Empty when the subgraph has no entities. */
  readonly entityTypeNames: ReadonlyArray<string>;
}

type ResolverMap = Record<string, unknown>;

/**
 * Adds the resolvers of the federation subgraph fields (`_service`,
 * `_entities`, `_Any`, `_Entity`) to a resolver map. gqlkit calls this from
 * the generated `createResolvers`; `_entities` calls the
 * `__resolveReference` of each representation's type in the map.
 */
export function withSubgraphResolvers<TResolvers extends ResolverMap>(
  resolvers: TResolvers,
  options: SubgraphResolversOptions,
): TResolvers & { Query: ResolverMap } {
  const { sdl, entityTypeNames } = options;
  const query = { ...(resolvers["Query"] as ResolverMap | undefined) };
  query["_service"] = () => ({ sdl });

  if (entityTypeNames.length === 0) {
    return { ...resolvers, Query: query };
  }

  const entityTypes = new Set(entityTypeNames);
  // `_Entity.__resolveType` reads the type from here, so that entities do
  // not need a `__typename` of their own.
  const entityTypenames = new WeakMap<object, string>();

  query["_entities"] = (
    _root: unknown,
    args: { representations: ReadonlyArray<Record<string, unknown>> },
    context: unknown,
    info: GraphQLResolveInfo,
  ) =>
    args.representations.map(async (representation) => {
      const typename = representation["__typename"];
      const type =
        typeof typename === "string" ? info.schema.getType(typename) : null;
      if (
        typeof typename !== "string" ||
        !entityTypes.has(typename) ||
        !isObjectType(type)
      ) {
        throw new Error(
          `'${String(typename)}' is not an entity of this subgraph`,
        );
      }
      const reference = parseRepresentationFields(representation, type);
      const typeResolvers = resolvers[typename] as
        | { __resolveReference?: (...args: unknown[]) => unknown }
        | undefined;
      const entity: unknown =
        typeResolvers?.__resolveReference === undefined
          ? reference
          : await typeResolvers.__resolveReference(reference, context, info);
      if (typeof entity === "object" && entity !== null) {
        entityTypenames.set(entity, typename);
      }
      return entity;
    });

  return {
    ...resolvers,
    Query: query,
    _Any: new GraphQLScalarType({
      name: "_Any",
      serialize: (value) => value,
      parseValue: (value) => value,
      parseLiteral: (ast) => valueFromASTUntyped(ast),
    }),
    _Entity: {
      __resolveType: (entity: object) =>
        entityTypenames.get(entity) ??
        (entity as { __typename?: string }).__typename,
    },
  };
}
