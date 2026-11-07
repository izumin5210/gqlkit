import type { GraphQLResolveInfo } from "graphql";
import { describe, expect, expectTypeOf, test } from "vitest";
import type {
  AbstractResolverKind,
  AbstractResolverMetadataShape,
  DirectiveLocation,
  FieldResolver,
  FieldResolverFn,
  Float,
  GqlDirective,
  GqlField,
  GqlFieldMetaShape,
  GqlInterface,
  GqlInterfaceMarker,
  GqlInterfaceMetaShape,
  GqlObject,
  GqlScalar,
  GqlTypeMetaShape,
  IDNumber,
  IDString,
  Int,
  IsTypeOfResolver,
  IsTypeOfResolverFn,
  MutationResolver,
  MutationResolverFn,
  NoArgs,
  QueryResolver,
  QueryResolverFn,
  ResolverKind,
  ResolverMetadataShape,
  ResolveTypeResolver,
  ResolveTypeResolverFn,
  ScalarMetadataShape,
  SubscriptionResolver,
  SubscriptionResolverFn,
} from "./index.js";
import { createGqlkitApis } from "./index.js";

describe("SubscriptionResolverFn", () => {
  test("has correct parameter types", () => {
    type Args = { channelId: string };
    type Result = { message: string };
    type Context = { userId: string };

    expectTypeOf<SubscriptionResolverFn<Args, Result, Context>>().toEqualTypeOf<
      (
        root: undefined,
        args: Args,
        context: Context,
        info: GraphQLResolveInfo,
      ) => AsyncIterable<Result> | Promise<AsyncIterable<Result>>
    >();
  });

  test("defaults TContext to unknown", () => {
    expectTypeOf<
      SubscriptionResolverFn<{ id: string }, { name: string }>
    >().toEqualTypeOf<
      (
        root: undefined,
        args: { id: string },
        context: unknown,
        info: GraphQLResolveInfo,
      ) =>
        | AsyncIterable<{ name: string }>
        | Promise<AsyncIterable<{ name: string }>>
    >();
  });
});

describe("SubscriptionResolver", () => {
  test("is an intersection of SubscriptionResolverFn and metadata", () => {
    type Args = { channelId: string };
    type Result = { message: string };
    type Context = { userId: string };

    // SubscriptionResolver should be assignable from SubscriptionResolverFn
    expectTypeOf<SubscriptionResolverFn<Args, Result, Context>>().toMatchTypeOf<
      SubscriptionResolver<Args, Result, Context>
    >();
  });

  test("has metadata with kind subscription", () => {
    type SR = SubscriptionResolver<{ id: string }, { name: string }>;

    // The metadata property should exist and have kind "subscription"
    expectTypeOf<NonNullable<SR[" $gqlkitResolver"]>>().toHaveProperty("kind");
    expectTypeOf<
      NonNullable<SR[" $gqlkitResolver"]>["kind"]
    >().toEqualTypeOf<"subscription">();
  });

  test("metadata has args and result", () => {
    type Args = { channelId: string };
    type Result = { message: string };
    type SR = SubscriptionResolver<Args, Result>;

    expectTypeOf<
      NonNullable<SR[" $gqlkitResolver"]>["args"]
    >().toEqualTypeOf<Args>();
    expectTypeOf<
      NonNullable<SR[" $gqlkitResolver"]>["result"]
    >().toEqualTypeOf<Result>();
  });

  test("metadata has directives", () => {
    type SR = SubscriptionResolver<
      { id: string },
      { name: string },
      unknown,
      []
    >;

    expectTypeOf<
      NonNullable<SR[" $gqlkitResolver"]>["directives"]
    >().toEqualTypeOf<[]>();
  });

  test("metadata conforms to ResolverMetadataShape", () => {
    type SR = SubscriptionResolver<{ id: string }, { name: string }>;
    type Meta = NonNullable<SR[" $gqlkitResolver"]>;

    // ResolverMetadataShape requires kind, args, result -- subscription metadata should be assignable
    expectTypeOf<Meta>().toMatchTypeOf<ResolverMetadataShape>();
  });
});

describe("createGqlkitApis() defineSubscription", () => {
  test("returned object has defineSubscription", () => {
    const apis = createGqlkitApis();
    expect(apis).toHaveProperty("defineSubscription");
    expect(typeof apis.defineSubscription).toBe("function");
  });

  test("defineSubscription is a passthrough function", () => {
    const apis = createGqlkitApis();
    const resolver = async function* () {
      yield { message: "hello" };
    };
    // The passthrough should return the exact same function reference
    const result = apis.defineSubscription(resolver as never);
    expect(result).toBe(resolver);
  });

  test("defineSubscription preserves type information", () => {
    type Args = { channelId: string };
    type Result = { message: string };
    type Context = { userId: string };

    const apis = createGqlkitApis<Context>();

    const resolver: SubscriptionResolverFn<Args, Result, Context> = async (
      _root,
      _args,
      _context,
      _info,
    ) => {
      return (async function* () {
        yield { message: "test" };
      })();
    };

    const result = apis.defineSubscription<Args, Result>(resolver);

    // Result should be typed as SubscriptionResolver
    expectTypeOf(result).toMatchTypeOf<
      SubscriptionResolver<Args, Result, Context>
    >();
  });
});

// -----------------------------------------------------------------------
// Directives
// -----------------------------------------------------------------------

describe("GqlDirective", () => {
  test("carries name, args, and location in marker properties", () => {
    type Auth = GqlDirective<"auth", { roles: string[] }, "FIELD_DEFINITION">;

    expectTypeOf<Auth[" $directiveName"]>().toEqualTypeOf<"auth">();
    expectTypeOf<Auth[" $directiveArgs"]>().toEqualTypeOf<{
      roles: string[];
    }>();
    expectTypeOf<
      Auth[" $directiveLocation"]
    >().toEqualTypeOf<"FIELD_DEFINITION">();
  });

  test("defaults Args to an empty record and Location to any DirectiveLocation", () => {
    type Cache = GqlDirective<"cache">;

    expectTypeOf<Cache[" $directiveArgs"]>().toEqualTypeOf<
      Record<string, never>
    >();
    expectTypeOf<
      Cache[" $directiveLocation"]
    >().toEqualTypeOf<DirectiveLocation>();
  });

  test("accepts an array of locations", () => {
    type Multi = GqlDirective<
      "multi",
      Record<string, never>,
      "OBJECT" | "INTERFACE"
    >;

    expectTypeOf<Multi[" $directiveLocation"]>().toEqualTypeOf<
      "OBJECT" | "INTERFACE"
    >();
  });
});

// -----------------------------------------------------------------------
// NoArgs
// -----------------------------------------------------------------------

describe("NoArgs", () => {
  test("is an empty-object args shape", () => {
    expectTypeOf<NoArgs>().toEqualTypeOf<Record<string, never>>();
  });
});

// -----------------------------------------------------------------------
// GqlField
// -----------------------------------------------------------------------

describe("GqlFieldMetaShape", () => {
  test("exposes optional directives and defaultValue sourced from Meta", () => {
    type Meta = GqlFieldMetaShape<{ defaultValue: number }>;

    expectTypeOf<Meta["defaultValue"]>().toEqualTypeOf<number | undefined>();
  });
});

describe("GqlField", () => {
  test("a plain value is assignable where GqlField<T> is expected", () => {
    expectTypeOf<string>().toExtend<GqlField<string>>();
    expectTypeOf<{ id: string }>().toExtend<GqlField<{ id: string }>>();
  });

  test("carries an optional field-metadata marker and preserves the original type", () => {
    type Field = GqlField<string, { defaultValue: "x" }>;

    expectTypeOf<Field[" $gqlkitFieldMeta"]>().toEqualTypeOf<
      GqlFieldMetaShape<{ defaultValue: "x" }> | undefined
    >();
    expectTypeOf<Field[" $gqlkitOriginalType"]>().toEqualTypeOf<
      string | undefined
    >();
  });

  test("threads directive metadata through to the marker", () => {
    type AuthDirective = GqlDirective<
      "auth",
      { role: string[] },
      "FIELD_DEFINITION"
    >;
    type Field = GqlField<string, { directives: [AuthDirective] }>;

    expectTypeOf<
      NonNullable<Field[" $gqlkitFieldMeta"]>["directives"]
    >().toEqualTypeOf<[AuthDirective] | undefined>();
  });
});

// -----------------------------------------------------------------------
// GqlInterface
// -----------------------------------------------------------------------

describe("GqlInterfaceMarker", () => {
  test("is a structural record usable as an implements entry", () => {
    expectTypeOf<GqlInterfaceMarker>().toEqualTypeOf<Record<string, unknown>>();
  });
});

describe("GqlInterfaceMetaShape", () => {
  test("exposes optional implements sourced from Meta", () => {
    type Meta = GqlInterfaceMetaShape<{ implements: [GqlInterfaceMarker] }>;

    expectTypeOf<Meta["implements"]>().toEqualTypeOf<
      [GqlInterfaceMarker] | undefined
    >();
  });
});

describe("GqlInterface", () => {
  test("a plain object is assignable where GqlInterface<T> is expected", () => {
    type Node = { id: string };

    expectTypeOf<Node>().toExtend<GqlInterface<Node>>();
  });

  test("carries an optional interface-metadata marker", () => {
    type Timestamped = GqlInterface<{ createdAt: string }>;

    expectTypeOf<Timestamped>().toHaveProperty(" $gqlkitInterfaceMeta");
  });

  test("implements accepts other GqlInterface markers", () => {
    type Node = GqlInterface<{ id: string }>;
    type Entity = GqlInterface<
      { id: string; createdAt: string },
      { implements: [Node] }
    >;

    expectTypeOf<
      NonNullable<Entity[" $gqlkitInterfaceMeta"]>["implements"]
    >().toEqualTypeOf<[Node] | undefined>();
  });
});

// -----------------------------------------------------------------------
// GqlObject
// -----------------------------------------------------------------------

describe("GqlTypeMetaShape", () => {
  test("exposes optional directives, implements, and ignoreFields sourced from Meta", () => {
    type Meta = GqlTypeMetaShape<{ ignoreFields: "internalId" }>;

    expectTypeOf<Meta["ignoreFields"]>().toEqualTypeOf<
      "internalId" | undefined
    >();
  });
});

describe("GqlObject", () => {
  test("a plain value is assignable where GqlObject<T> is expected", () => {
    type User = { id: string; name: string };

    expectTypeOf<User>().toExtend<GqlObject<User>>();
  });

  test("carries an optional type-metadata marker and preserves the original type", () => {
    type User = GqlObject<{ id: string }, { ignoreFields: "id" }>;

    expectTypeOf<User[" $gqlkitTypeMeta"]>().toEqualTypeOf<
      GqlTypeMetaShape<{ ignoreFields: "id" }> | undefined
    >();
    expectTypeOf<User[" $gqlkitOriginalType"]>().toEqualTypeOf<
      { id: string } | undefined
    >();
  });

  test("ignoreFields is constrained to the wrapped type's own keys", () => {
    type Base = { id: string; internalId: string };
    type User = GqlObject<Base, { ignoreFields: "internalId" }>;

    expectTypeOf<
      NonNullable<User[" $gqlkitTypeMeta"]>["ignoreFields"]
    >().toEqualTypeOf<"internalId" | undefined>();
  });

  test("implements accepts GqlInterface markers", () => {
    type Node = GqlInterface<{ id: string }>;
    type User = GqlObject<{ id: string }, { implements: [Node] }>;

    expectTypeOf<
      NonNullable<User[" $gqlkitTypeMeta"]>["implements"]
    >().toEqualTypeOf<[Node] | undefined>();
  });
});

// -----------------------------------------------------------------------
// GqlScalar
// -----------------------------------------------------------------------

describe("ScalarMetadataShape", () => {
  test("requires name and allows an optional input/output constraint", () => {
    expectTypeOf<ScalarMetadataShape["name"]>().toEqualTypeOf<string>();
    expectTypeOf<ScalarMetadataShape["only"]>().toEqualTypeOf<
      "input" | "output" | undefined
    >();
  });
});

describe("GqlScalar", () => {
  test("a plain base value is assignable where GqlScalar<Name, Base> is expected", () => {
    expectTypeOf<Date>().toExtend<GqlScalar<"DateTime", Date>>();
  });

  test("carries an optional scalar-metadata marker with name and usage constraint", () => {
    type DateTimeInput = GqlScalar<"DateTime", Date, "input">;

    expectTypeOf<DateTimeInput[" $gqlkitScalar"]>().toEqualTypeOf<
      { name: "DateTime"; only: "input" } | undefined
    >();
  });

  test("Only defaults to undefined, meaning usable for both input and output", () => {
    type DateTime = GqlScalar<"DateTime", Date>;

    expectTypeOf<
      NonNullable<DateTime[" $gqlkitScalar"]>["only"]
    >().toEqualTypeOf<undefined>();
  });
});

describe("branded scalar aliases", () => {
  test("Int wraps number and is assignable from a plain number", () => {
    expectTypeOf<number>().toExtend<Int>();
    expectTypeOf<
      NonNullable<Int[" $gqlkitScalar"]>["name"]
    >().toEqualTypeOf<"Int">();
  });

  test("Float wraps number and is assignable from a plain number", () => {
    expectTypeOf<number>().toExtend<Float>();
    expectTypeOf<
      NonNullable<Float[" $gqlkitScalar"]>["name"]
    >().toEqualTypeOf<"Float">();
  });

  test("IDString wraps string and is assignable from a plain string", () => {
    expectTypeOf<string>().toExtend<IDString>();
    expectTypeOf<
      NonNullable<IDString[" $gqlkitScalar"]>["name"]
    >().toEqualTypeOf<"ID">();
  });

  test("IDNumber wraps number and is assignable from a plain number", () => {
    expectTypeOf<number>().toExtend<IDNumber>();
    expectTypeOf<
      NonNullable<IDNumber[" $gqlkitScalar"]>["name"]
    >().toEqualTypeOf<"ID">();
  });
});

// -----------------------------------------------------------------------
// Resolver function signatures (Query / Mutation / Field / ResolveType / IsTypeOf)
// -----------------------------------------------------------------------

describe("QueryResolverFn", () => {
  test("has correct parameter types", () => {
    type Args = { id: string };
    type Result = { name: string };
    type Context = { userId: string };

    expectTypeOf<QueryResolverFn<Args, Result, Context>>().toEqualTypeOf<
      (
        root: undefined,
        args: Args,
        context: Context,
        info: GraphQLResolveInfo,
      ) => Result | Promise<Result>
    >();
  });

  test("defaults TContext to unknown", () => {
    expectTypeOf<QueryResolverFn<NoArgs, string>>().toEqualTypeOf<
      (
        root: undefined,
        args: NoArgs,
        context: unknown,
        info: GraphQLResolveInfo,
      ) => string | Promise<string>
    >();
  });
});

describe("MutationResolverFn", () => {
  test("has correct parameter types", () => {
    type Args = { id: string };
    type Result = { name: string };
    type Context = { userId: string };

    expectTypeOf<MutationResolverFn<Args, Result, Context>>().toEqualTypeOf<
      (
        root: undefined,
        args: Args,
        context: Context,
        info: GraphQLResolveInfo,
      ) => Result | Promise<Result>
    >();
  });

  test("defaults TContext to unknown", () => {
    expectTypeOf<MutationResolverFn<NoArgs, string>>().toEqualTypeOf<
      (
        root: undefined,
        args: NoArgs,
        context: unknown,
        info: GraphQLResolveInfo,
      ) => string | Promise<string>
    >();
  });
});

describe("FieldResolverFn", () => {
  test("has correct parameter types including the parent value", () => {
    type Parent = { id: string };
    type Result = string;
    type Context = { db: unknown };

    expectTypeOf<
      FieldResolverFn<Parent, NoArgs, Result, Context>
    >().toEqualTypeOf<
      (
        parent: Parent,
        args: NoArgs,
        context: Context,
        info: GraphQLResolveInfo,
      ) => Result | Promise<Result>
    >();
  });

  test("defaults TContext to unknown", () => {
    expectTypeOf<
      FieldResolverFn<{ id: string }, NoArgs, string>
    >().toEqualTypeOf<
      (
        parent: { id: string },
        args: NoArgs,
        context: unknown,
        info: GraphQLResolveInfo,
      ) => string | Promise<string>
    >();
  });
});

describe("ResolveTypeResolverFn", () => {
  test("has correct parameter types and returns a type-name string", () => {
    type Abstract = { kind: "dog" } | { kind: "cat" };
    type Context = { userId: string };

    expectTypeOf<ResolveTypeResolverFn<Abstract, Context>>().toEqualTypeOf<
      (
        value: Abstract,
        context: Context,
        info: GraphQLResolveInfo,
      ) => string | Promise<string>
    >();
  });

  test("defaults TContext to unknown", () => {
    expectTypeOf<ResolveTypeResolverFn<{ kind: string }>>().toEqualTypeOf<
      (
        value: { kind: string },
        context: unknown,
        info: GraphQLResolveInfo,
      ) => string | Promise<string>
    >();
  });
});

describe("IsTypeOfResolverFn", () => {
  test("has correct parameter types and returns a boolean", () => {
    type Context = { userId: string };

    expectTypeOf<IsTypeOfResolverFn<Context>>().toEqualTypeOf<
      (
        value: unknown,
        context: Context,
        info: GraphQLResolveInfo,
      ) => boolean | Promise<boolean>
    >();
  });

  test("defaults TContext to unknown", () => {
    expectTypeOf<IsTypeOfResolverFn>().toEqualTypeOf<
      (
        value: unknown,
        context: unknown,
        info: GraphQLResolveInfo,
      ) => boolean | Promise<boolean>
    >();
  });
});

// -----------------------------------------------------------------------
// Metadata shapes shared across resolver kinds
// -----------------------------------------------------------------------

describe("ResolverMetadataShape", () => {
  test("requires kind, args, and result, and allows an optional parent", () => {
    expectTypeOf<ResolverMetadataShape["kind"]>().toEqualTypeOf<ResolverKind>();
    expectTypeOf<ResolverMetadataShape>().toHaveProperty("args");
    expectTypeOf<ResolverMetadataShape>().toHaveProperty("result");
    expectTypeOf<ResolverMetadataShape>().toHaveProperty("parent");
  });
});

describe("AbstractResolverMetadataShape", () => {
  test("requires kind and targetType", () => {
    expectTypeOf<
      AbstractResolverMetadataShape["kind"]
    >().toEqualTypeOf<AbstractResolverKind>();
    expectTypeOf<AbstractResolverMetadataShape>().toHaveProperty("targetType");
  });
});

// -----------------------------------------------------------------------
// Resolver types with embedded metadata (Query / Mutation / Field)
// -----------------------------------------------------------------------

describe("QueryResolver", () => {
  test("is an intersection of QueryResolverFn and metadata", () => {
    expectTypeOf<QueryResolverFn<NoArgs, string>>().toExtend<
      QueryResolver<NoArgs, string>
    >();
  });

  test("has metadata with kind query", () => {
    type QR = QueryResolver<NoArgs, string>;

    expectTypeOf<
      NonNullable<QR[" $gqlkitResolver"]>["kind"]
    >().toEqualTypeOf<"query">();
  });

  test("metadata has args and result", () => {
    type Args = { id: string };
    type Result = { name: string };
    type QR = QueryResolver<Args, Result>;

    expectTypeOf<
      NonNullable<QR[" $gqlkitResolver"]>["args"]
    >().toEqualTypeOf<Args>();
    expectTypeOf<
      NonNullable<QR[" $gqlkitResolver"]>["result"]
    >().toEqualTypeOf<Result>();
  });

  test("metadata has directives", () => {
    type QR = QueryResolver<NoArgs, string, unknown, []>;

    expectTypeOf<
      NonNullable<QR[" $gqlkitResolver"]>["directives"]
    >().toEqualTypeOf<[]>();
  });

  test("metadata conforms to ResolverMetadataShape", () => {
    type QR = QueryResolver<NoArgs, string>;
    type Meta = NonNullable<QR[" $gqlkitResolver"]>;

    expectTypeOf<Meta>().toExtend<ResolverMetadataShape>();
  });
});

describe("MutationResolver", () => {
  test("is an intersection of MutationResolverFn and metadata", () => {
    expectTypeOf<MutationResolverFn<NoArgs, string>>().toExtend<
      MutationResolver<NoArgs, string>
    >();
  });

  test("has metadata with kind mutation", () => {
    type MR = MutationResolver<NoArgs, string>;

    expectTypeOf<
      NonNullable<MR[" $gqlkitResolver"]>["kind"]
    >().toEqualTypeOf<"mutation">();
  });

  test("metadata has args and result", () => {
    type Args = { id: string };
    type Result = boolean;
    type MR = MutationResolver<Args, Result>;

    expectTypeOf<
      NonNullable<MR[" $gqlkitResolver"]>["args"]
    >().toEqualTypeOf<Args>();
    expectTypeOf<
      NonNullable<MR[" $gqlkitResolver"]>["result"]
    >().toEqualTypeOf<Result>();
  });

  test("metadata conforms to ResolverMetadataShape", () => {
    type MR = MutationResolver<NoArgs, string>;
    type Meta = NonNullable<MR[" $gqlkitResolver"]>;

    expectTypeOf<Meta>().toExtend<ResolverMetadataShape>();
  });
});

describe("FieldResolver", () => {
  test("is an intersection of FieldResolverFn and metadata", () => {
    expectTypeOf<FieldResolverFn<{ id: string }, NoArgs, string>>().toExtend<
      FieldResolver<{ id: string }, NoArgs, string>
    >();
  });

  test("has metadata with kind field and a parent type", () => {
    type FR = FieldResolver<{ id: string }, NoArgs, string>;

    expectTypeOf<
      NonNullable<FR[" $gqlkitResolver"]>["kind"]
    >().toEqualTypeOf<"field">();
    expectTypeOf<
      NonNullable<FR[" $gqlkitResolver"]>["parent"]
    >().toEqualTypeOf<{ id: string }>();
  });

  test("metadata conforms to ResolverMetadataShape", () => {
    type FR = FieldResolver<{ id: string }, NoArgs, string>;
    type Meta = NonNullable<FR[" $gqlkitResolver"]>;

    expectTypeOf<Meta>().toExtend<ResolverMetadataShape>();
  });
});

// -----------------------------------------------------------------------
// Abstract-type resolver types with embedded metadata (resolveType / isTypeOf)
// -----------------------------------------------------------------------

describe("ResolveTypeResolver", () => {
  test("is an intersection of ResolveTypeResolverFn and metadata", () => {
    type Abstract = { kind: "dog" } | { kind: "cat" };

    expectTypeOf<ResolveTypeResolverFn<Abstract>>().toExtend<
      ResolveTypeResolver<Abstract>
    >();
  });

  test("has metadata with kind resolveType and a target type", () => {
    type Abstract = { kind: "dog" } | { kind: "cat" };
    type RT = ResolveTypeResolver<Abstract>;

    expectTypeOf<
      NonNullable<RT[" $gqlkitAbstractResolver"]>["kind"]
    >().toEqualTypeOf<"resolveType">();
    expectTypeOf<
      NonNullable<RT[" $gqlkitAbstractResolver"]>["targetType"]
    >().toEqualTypeOf<Abstract>();
  });

  test("metadata conforms to AbstractResolverMetadataShape", () => {
    type RT = ResolveTypeResolver<{ kind: string }>;
    type Meta = NonNullable<RT[" $gqlkitAbstractResolver"]>;

    expectTypeOf<Meta>().toExtend<AbstractResolverMetadataShape>();
  });
});

describe("IsTypeOfResolver", () => {
  test("is an intersection of IsTypeOfResolverFn and metadata", () => {
    expectTypeOf<IsTypeOfResolverFn>().toExtend<
      IsTypeOfResolver<{ kind: "dog" }>
    >();
  });

  test("has metadata with kind isTypeOf and a target type", () => {
    type Dog = { kind: "dog" };
    type IT = IsTypeOfResolver<Dog>;

    expectTypeOf<
      NonNullable<IT[" $gqlkitAbstractResolver"]>["kind"]
    >().toEqualTypeOf<"isTypeOf">();
    expectTypeOf<
      NonNullable<IT[" $gqlkitAbstractResolver"]>["targetType"]
    >().toEqualTypeOf<Dog>();
  });

  test("metadata conforms to AbstractResolverMetadataShape", () => {
    type IT = IsTypeOfResolver<{ kind: "dog" }>;
    type Meta = NonNullable<IT[" $gqlkitAbstractResolver"]>;

    expectTypeOf<Meta>().toExtend<AbstractResolverMetadataShape>();
  });
});

// -----------------------------------------------------------------------
// createGqlkitApis() -- defineQuery / defineMutation / defineField /
// defineResolveType / defineIsTypeOf
// -----------------------------------------------------------------------

describe("createGqlkitApis() defineQuery", () => {
  test("returned object has defineQuery", () => {
    const apis = createGqlkitApis();
    expect(apis).toHaveProperty("defineQuery");
    expect(typeof apis.defineQuery).toBe("function");
  });

  test("defineQuery is a passthrough function", () => {
    const apis = createGqlkitApis();
    const resolver = () => "ok";
    const result = apis.defineQuery(resolver as never);
    expect(result).toBe(resolver);
  });

  test("defineQuery preserves type information and threads TContext", () => {
    type Result = string;
    type Context = { userId: string };

    const apis = createGqlkitApis<Context>();

    const resolver: QueryResolverFn<NoArgs, Result, Context> = (
      _root,
      _args,
      context,
    ) => context.userId;

    const result = apis.defineQuery<NoArgs, Result>(resolver);

    expectTypeOf(result).toExtend<QueryResolver<NoArgs, Result, Context>>();
  });
});

describe("createGqlkitApis() defineMutation", () => {
  test("returned object has defineMutation", () => {
    const apis = createGqlkitApis();
    expect(apis).toHaveProperty("defineMutation");
    expect(typeof apis.defineMutation).toBe("function");
  });

  test("defineMutation is a passthrough function", () => {
    const apis = createGqlkitApis();
    const resolver = () => true;
    const result = apis.defineMutation(resolver as never);
    expect(result).toBe(resolver);
  });

  test("defineMutation preserves type information and threads TContext", () => {
    type Args = { id: string };
    type Result = boolean;
    type Context = { userId: string };

    const apis = createGqlkitApis<Context>();

    const resolver: MutationResolverFn<Args, Result, Context> = (
      _root,
      _args,
      _context,
    ) => true;

    const result = apis.defineMutation<Args, Result>(resolver);

    expectTypeOf(result).toExtend<MutationResolver<Args, Result, Context>>();
  });
});

describe("createGqlkitApis() defineField", () => {
  test("returned object has defineField", () => {
    const apis = createGqlkitApis();
    expect(apis).toHaveProperty("defineField");
    expect(typeof apis.defineField).toBe("function");
  });

  test("defineField is a passthrough function", () => {
    const apis = createGqlkitApis();
    const resolver = (parent: { id: string }) => parent.id;
    const result = apis.defineField(resolver as never);
    expect(result).toBe(resolver);
  });

  test("defineField preserves type information and threads TContext", () => {
    type Parent = { id: string };
    type Result = string;
    type Context = { db: unknown };

    const apis = createGqlkitApis<Context>();

    const resolver: FieldResolverFn<Parent, NoArgs, Result, Context> = (
      parent,
    ) => parent.id;

    const result = apis.defineField<Parent, NoArgs, Result>(resolver);

    expectTypeOf(result).toExtend<
      FieldResolver<Parent, NoArgs, Result, Context>
    >();
  });
});

describe("createGqlkitApis() defineResolveType", () => {
  test("returned object has defineResolveType", () => {
    const apis = createGqlkitApis();
    expect(apis).toHaveProperty("defineResolveType");
    expect(typeof apis.defineResolveType).toBe("function");
  });

  test("defineResolveType is a passthrough function", () => {
    const apis = createGqlkitApis();
    const resolver = () => "Dog";
    const result = apis.defineResolveType(resolver as never);
    expect(result).toBe(resolver);
  });

  test("defineResolveType preserves type information and threads TContext", () => {
    type Abstract = { kind: "dog" } | { kind: "cat" };
    type Context = { userId: string };

    const apis = createGqlkitApis<Context>();

    const resolver: ResolveTypeResolverFn<Abstract, Context> = (value) =>
      value.kind === "dog" ? "Dog" : "Cat";

    const result = apis.defineResolveType<Abstract>(resolver);

    expectTypeOf(result).toExtend<ResolveTypeResolver<Abstract, Context>>();
  });
});

describe("createGqlkitApis() defineIsTypeOf", () => {
  test("returned object has defineIsTypeOf", () => {
    const apis = createGqlkitApis();
    expect(apis).toHaveProperty("defineIsTypeOf");
    expect(typeof apis.defineIsTypeOf).toBe("function");
  });

  test("defineIsTypeOf is a passthrough function", () => {
    const apis = createGqlkitApis();
    const resolver = (value: unknown) =>
      typeof value === "object" && value !== null;
    const result = apis.defineIsTypeOf(resolver as never);
    expect(result).toBe(resolver);
  });

  test("defineIsTypeOf preserves type information and threads TContext", () => {
    type Dog = { kind: "dog" };
    type Context = { userId: string };

    const apis = createGqlkitApis<Context>();

    const resolver: IsTypeOfResolverFn<Context> = (value) =>
      typeof value === "object" && value !== null && "kind" in value;

    const result = apis.defineIsTypeOf<Dog>(resolver);

    expectTypeOf(result).toExtend<IsTypeOfResolver<Dog, Context>>();
  });
});
