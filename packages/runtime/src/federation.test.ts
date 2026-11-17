import { makeExecutableSchema } from "@graphql-tools/schema";
import { GraphQLScalarType, graphql } from "graphql";
import { describe, expect, expectTypeOf, test } from "vitest";
import {
  createFederationApis,
  type EntityReference,
  type Inaccessible,
  type Key,
  type Shareable,
  withSubgraphResolvers,
} from "./federation.js";
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

describe("EntityReference", () => {
  type Organization = GqlObject<
    { id: IDString; name: string },
    { directives: [Key<"id", { resolvable: false }>] }
  >;
  type User = GqlObject<
    { id: IDString; email: string; organization: Organization; name: string },
    { directives: [Key<"id">, Key<"email organization { id }">] }
  >;

  test("has the key fields of one resolvable key and __typename", () => {
    expectTypeOf<EntityReference<User>>().toEqualTypeOf<
      | ({ readonly __typename: string } & { id: IDString })
      | ({ readonly __typename: string } & {
          email: string;
          organization: { id: IDString };
        })
    >();
  });

  test("is never for a type without resolvable keys", () => {
    expectTypeOf<EntityReference<Organization>>().toBeNever();
  });
});

describe("createFederationApis", () => {
  type User = GqlObject<
    { id: IDString; name: string },
    { directives: [Key<"id">] }
  >;

  test("types the reference from the entity's keys", () => {
    const { defineResolveReference } = createFederationApis<{
      users: Map<string, User>;
    }>();
    const resolver = defineResolveReference<User>(
      (ref, ctx) => ctx.users.get(ref.id) ?? null,
    );
    expectTypeOf(resolver).parameter(0).toEqualTypeOf<EntityReference<User>>();
  });
});

describe("withSubgraphResolvers", () => {
  const sdl =
    'extend schema @link(url: "https://specs.apollo.dev/federation/v2.9")';

  function buildSchema(
    resolvers: Record<string, unknown>,
    entityTypeNames: ReadonlyArray<string>,
  ) {
    return makeExecutableSchema({
      typeDefs: `
        scalar _Any
        scalar DateTime
        union _Entity = ${entityTypeNames.join(" | ")}
        type _Service { sdl: String! }
        enum Status { ACTIVE DISABLED }
        type Org { id: ID! }
        type User { id: ID! status: Status! org: Org! name: String! }
        type Event { at: DateTime! title: String! }
        type Query {
          _service: _Service!
          _entities(representations: [_Any!]!): [_Entity]!
        }
      `,
      resolvers: withSubgraphResolvers(resolvers, {
        sdl,
        entityTypeNames,
      }) as NonNullable<
        Parameters<typeof makeExecutableSchema>[0]["resolvers"]
      >,
    });
  }

  test("serves the subgraph SDL", async () => {
    const schema = buildSchema({}, ["User"]);
    const result = await graphql({ schema, source: "{ _service { sdl } }" });
    expect(result).toEqual({ data: { _service: { sdl } } });
  });

  test("resolves each representation with its type's __resolveReference", async () => {
    const references: unknown[] = [];
    const schema = buildSchema(
      {
        Status: { ACTIVE: "active", DISABLED: "disabled" },
        DateTime: new GraphQLScalarType({
          name: "DateTime",
          serialize: (value) => (value as Date).toISOString(),
          parseValue: (value) => new Date(value as string),
        }),
        User: {
          __resolveReference: (ref: unknown) => {
            references.push(ref);
            return { ...(ref as object), name: "Alice" };
          },
        },
        Event: {
          __resolveReference: (ref: { at: Date }) => ({
            at: ref.at,
            title: ref.at instanceof Date ? "parsed" : "raw",
          }),
        },
      },
      ["Event", "User"],
    );

    const result = await graphql({
      schema,
      source: `
        query ($representations: [_Any!]!) {
          _entities(representations: $representations) {
            ... on User { id status name org { id } }
            ... on Event { title }
          }
        }
      `,
      variableValues: {
        representations: [
          { __typename: "User", id: 1, status: "ACTIVE", org: { id: "o1" } },
          { __typename: "Event", at: "2026-01-01T00:00:00.000Z" },
        ],
      },
    });

    expect(result).toEqual({
      data: {
        _entities: [
          { id: "1", status: "ACTIVE", name: "Alice", org: { id: "o1" } },
          { title: "parsed" },
        ],
      },
    });
    // Values arrive converted to what resolvers return for those fields.
    expect(references).toEqual([
      { __typename: "User", id: "1", status: "active", org: { id: "o1" } },
    ]);
  });

  test("returns the representation itself without __resolveReference", async () => {
    const schema = buildSchema({}, ["User"]);
    const result = await graphql({
      schema,
      source: `
        query ($representations: [_Any!]!) {
          _entities(representations: $representations) { ... on User { id } }
        }
      `,
      variableValues: { representations: [{ __typename: "User", id: "u1" }] },
    });
    expect(result).toEqual({ data: { _entities: [{ id: "u1" }] } });
  });

  test("reports a representation of a type that is not an entity", async () => {
    const schema = buildSchema({}, ["User"]);
    const result = await graphql({
      schema,
      source: `
        query ($representations: [_Any!]!) {
          _entities(representations: $representations) { __typename }
        }
      `,
      variableValues: { representations: [{ __typename: "Org", id: "o1" }] },
    });
    expect(result.data).toEqual({ _entities: [null] });
    expect(result.errors?.[0]?.message).toBe(
      "'Org' is not an entity of this subgraph",
    );
  });
});
