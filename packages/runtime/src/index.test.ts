import type { GraphQLResolveInfo } from "graphql";
import { describe, expect, expectTypeOf, test } from "vitest";
import type {
  ResolverMetadataShape,
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
