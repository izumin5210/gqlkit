import { describe, expectTypeOf, test } from "vitest";
import type { Inaccessible, Key, Shareable } from "./federation.js";
import type {
  DirectiveLocation,
  GqlDirective,
  GqlField,
  GqlObject,
  IDString,
} from "./index.js";

type AnyDirective = GqlDirective<
  string,
  Record<string, unknown>,
  DirectiveLocation | DirectiveLocation[]
>;

describe("Key", () => {
  test("is a directive named key whose fields argument keeps the literal", () => {
    expectTypeOf<Key<"id">>().toExtend<AnyDirective>();
    expectTypeOf<Key<"id">[" $directiveName"]>().toEqualTypeOf<"key">();
    expectTypeOf<
      Key<"id">[" $directiveArgs"]["fields"]
    >().toEqualTypeOf<"id">();
  });

  test("adds resolvable to the arguments when given", () => {
    expectTypeOf<
      Key<"id", { resolvable: false }>[" $directiveArgs"]
    >().toEqualTypeOf<{ fields: "id" } & { resolvable: false }>();
  });

  test("carries the federation marker", () => {
    expectTypeOf<
      Key<"id">[" $gqlkitFederationDirective"]
    >().toEqualTypeOf<"key">();
  });

  test("can be attached to an object type", () => {
    type User = GqlObject<
      { id: IDString; name: string },
      { directives: [Key<"id">, Key<"name", { resolvable: false }>] }
    >;
    expectTypeOf<User>().toHaveProperty("id");
  });
});

describe("Shareable", () => {
  test("is a directive named shareable with the federation marker", () => {
    expectTypeOf<Shareable>().toExtend<AnyDirective>();
    expectTypeOf<Shareable[" $directiveName"]>().toEqualTypeOf<"shareable">();
    expectTypeOf<
      Shareable[" $gqlkitFederationDirective"]
    >().toEqualTypeOf<"shareable">();
  });

  test("can be attached to object types and fields", () => {
    type Product = GqlObject<
      { name: GqlField<string, { directives: [Shareable] }> },
      { directives: [Shareable] }
    >;
    expectTypeOf<Product>().toHaveProperty("name");
  });
});

describe("Inaccessible", () => {
  test("is a directive named inaccessible with the federation marker", () => {
    expectTypeOf<Inaccessible>().toExtend<AnyDirective>();
    expectTypeOf<
      Inaccessible[" $directiveName"]
    >().toEqualTypeOf<"inaccessible">();
    expectTypeOf<
      Inaccessible[" $gqlkitFederationDirective"]
    >().toEqualTypeOf<"inaccessible">();
  });
});
