import type { DirectiveLocation, GqlDirective } from "./directive.js";
import type { GqlInterfaceMarker } from "./interface.js";

/**
 * Metadata structure for type-level GraphQL metadata.
 * Used to attach directives, interface implementations, and field exclusions to types.
 *
 * @typeParam Meta - The metadata configuration object
 */
export interface GqlTypeMetaShape<
  Meta extends {
    directives?: ReadonlyArray<
      GqlDirective<
        string,
        Record<string, unknown>,
        DirectiveLocation | DirectiveLocation[]
      >
    >;
    implements?: ReadonlyArray<GqlInterfaceMarker>;
    ignoreFields?: string;
  },
> {
  readonly directives?: Meta["directives"];
  readonly implements?: Meta["implements"];
  readonly ignoreFields?: Meta["ignoreFields"];
}

/**
 * Attaches metadata to a type definition.
 * The metadata is embedded as optional properties to maintain compatibility
 * with the underlying type.
 *
 * The structure uses two properties:
 * - `$gqlkitTypeMeta`: Contains the metadata object with directives, implements, and ignoreFields
 * - `$gqlkitOriginalType`: Preserves the original type T to maintain nullability information
 *
 * @typeParam T - The base type to attach metadata to
 * @typeParam Meta - The metadata configuration object containing directives, implements, and/or ignoreFields
 *
 * @example
 * ```typescript
 * // Type with directives only
 * type User = GqlObject<
 *   {
 *     id: string;
 *     name: string;
 *   },
 *   { directives: [CacheDirective<{ maxAge: 60 }>] }
 * >;
 *
 * // Type implementing an interface
 * type User = GqlObject<
 *   {
 *     id: IDString;
 *     name: string;
 *   },
 *   { implements: [Node] }
 * >;
 *
 * // Type with both directives and implements
 * type Post = GqlObject<
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
 *
 * // Type with ignoreFields to exclude fields from GraphQL schema
 * type User = GqlObject<
 *   {
 *     id: IDString;
 *     name: string;
 *     internalId: string;
 *   },
 *   { ignoreFields: "internalId" }
 * >;
 *
 * // Type with multiple ignored fields
 * type User = GqlObject<
 *   {
 *     id: IDString;
 *     name: string;
 *     cacheKey: string;
 *     internalId: string;
 *   },
 *   { ignoreFields: "cacheKey" | "internalId" }
 * >;
 * ```
 */
export type GqlObject<
  T,
  Meta extends {
    directives?: ReadonlyArray<
      GqlDirective<
        string,
        Record<string, unknown>,
        DirectiveLocation | DirectiveLocation[]
      >
    >;
    implements?: ReadonlyArray<GqlInterfaceMarker>;
    ignoreFields?: keyof T & string;
  } = { directives: [] },
> = T & {
  readonly " $gqlkitTypeMeta"?: GqlTypeMetaShape<Meta>;
  readonly " $gqlkitOriginalType"?: T;
};
