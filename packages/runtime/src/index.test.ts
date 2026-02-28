import type { GraphQLResolveInfo } from "graphql";
import { assertType, describe, expect, expectTypeOf, test } from "vitest";
import type {
  GqlkitApis,
  ResolverKind,
  ResolverMetadataShape,
  SubscriptionResolver,
  SubscriptionResolverFn,
} from "./index.js";
import { createGqlkitApis } from "./index.js";

describe("SubscriptionResolverFn", () => {
  test("accepts a function that returns AsyncIterable", () => {
    const fn: SubscriptionResolverFn<{ id: string }, { name: string }> = (
      _root,
      _args,
      _context,
      _info,
    ) => {
      return (async function* () {
        yield { name: "test" };
      })();
    };
    assertType<SubscriptionResolverFn<{ id: string }, { name: string }>>(fn);
  });

  test("accepts a function that returns Promise<AsyncIterable>", () => {
    const fn: SubscriptionResolverFn<{ id: string }, { name: string }> = async (
      _root,
      _args,
      _context,
      _info,
    ) => {
      return (async function* () {
        yield { name: "test" };
      })();
    };
    assertType<SubscriptionResolverFn<{ id: string }, { name: string }>>(fn);
  });

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

describe("ResolverKind", () => {
  test("includes subscription", () => {
    // "subscription" should be assignable to ResolverKind
    const kind: ResolverKind = "subscription";
    assertType<ResolverKind>(kind);
  });

  test("still includes existing kinds", () => {
    const query: ResolverKind = "query";
    const mutation: ResolverKind = "mutation";
    const field: ResolverKind = "field";
    assertType<ResolverKind>(query);
    assertType<ResolverKind>(mutation);
    assertType<ResolverKind>(field);
  });
});

describe("ResolverMetadataShape", () => {
  test("can represent subscription metadata with existing properties", () => {
    // Verify that ResolverMetadataShape's existing properties (kind, args, result)
    // can represent subscription metadata without any changes
    const subscriptionMeta: ResolverMetadataShape = {
      kind: "subscription",
      args: { channelId: "123" },
      result: { message: "hello" },
    };
    assertType<ResolverMetadataShape>(subscriptionMeta);
  });
});

describe("GqlkitApis.defineSubscription", () => {
  test("GqlkitApis interface has defineSubscription method", () => {
    // defineSubscription should be a property of GqlkitApis
    expectTypeOf<GqlkitApis<unknown>>().toHaveProperty("defineSubscription");
  });

  test("defineSubscription accepts SubscriptionResolverFn and returns SubscriptionResolver", () => {
    type Context = { userId: string };

    // The defineSubscription method should be a function
    type DefineSubscriptionFn = GqlkitApis<Context>["defineSubscription"];
    expectTypeOf<DefineSubscriptionFn>().toBeFunction();
  });

  test("defineSubscription has same type argument pattern as defineQuery", () => {
    type Context = { db: unknown };

    // defineSubscription should accept TArgs, TResult, TDirectives type arguments
    // identical to the pattern used by defineQuery
    type DefineSubscription = GqlkitApis<Context>["defineSubscription"];
    type DefineQuery = GqlkitApis<Context>["defineQuery"];

    // Both should be callable with <TArgs, TResult> type arguments
    expectTypeOf<DefineSubscription>().toBeFunction();
    expectTypeOf<DefineQuery>().toBeFunction();
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
