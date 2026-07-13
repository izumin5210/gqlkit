/**
 * Marker type for GqlInterface - used internally for type discrimination.
 */
export type GqlInterfaceMarker = Record<string, unknown>;

/**
 * Interface metadata structure embedded in intersection types.
 * Used by CLI to detect and identify interface types through type analysis.
 *
 * @typeParam Meta - The metadata configuration object containing implements
 */
export interface GqlInterfaceMetaShape<
  Meta extends {
    implements?: ReadonlyArray<GqlInterfaceMarker>;
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
 * export type Node = GqlInterface<{
 *   id: IDString;
 * }>;
 *
 * export type Timestamped = GqlInterface<{
 *   createdAt: DateTime;
 *   updatedAt: DateTime;
 * }>;
 *
 * // Interface inheriting other interfaces
 * export type Entity = GqlInterface<
 *   {
 *     id: IDString;
 *     createdAt: DateTime;
 *     updatedAt: DateTime;
 *   },
 *   { implements: [Node, Timestamped] }
 * >;
 * ```
 */
export type GqlInterface<
  T extends Record<string, unknown>,
  Meta extends {
    implements?: ReadonlyArray<GqlInterfaceMarker>;
  } = object,
> = T & {
  readonly " $gqlkitInterfaceMeta"?: GqlInterfaceMetaShape<Meta>;
};
