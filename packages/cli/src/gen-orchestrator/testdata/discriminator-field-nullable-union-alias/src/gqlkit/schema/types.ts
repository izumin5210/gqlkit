/**
 * Test case: discriminator field union used as nullable field type
 *
 * When a discriminator field union (Item) is used as `Item | null` in
 * another type's field, TypeScript's type checker flattens the union,
 * losing the type alias symbol. The field type resolver then cannot
 * detect the known schema type reference and incorrectly treats it
 * as an inline union, causing UNNAMEABLE_UNION_MEMBER errors.
 *
 * Expected: gqlkit should resolve `Item | null` as a nullable reference
 * to Item, not as an expanded inline union.
 */

export type Item =
  | { kind: "alpha"; value: string }
  | { kind: "beta"; count: number };

export type Container = {
  label: string;
  item: Item | null;
};
