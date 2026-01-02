/**
 * Type inference tests for @gqlkit-ts/runtime
 *
 * These tests verify that TypeScript correctly infers and enforces types.
 * The tests are compile-time checks - if this file compiles, the types work correctly.
 * Runtime assertions verify the tests are actually executed.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GraphQLResolveInfo } from "graphql";
import {
  createGqlkitApis,
  type FieldResolver,
  type FieldResolverFn,
  type GqlkitApis,
  type MutationResolver,
  type MutationResolverFn,
  type NoArgs,
  type QueryResolver,
  type QueryResolverFn,
  type ResolverBrand,
  type ResolverKind,
} from "./index.js";

type User = {
  id: string;
  name: string;
  email: string;
};


describe("Type inference tests", () => {
  describe("NoArgs type", () => {
    it("should represent empty args", () => {
      const emptyArgs: NoArgs = {};
      assert.deepEqual(emptyArgs, {});
    });
  });

  describe("Resolver function types", () => {
    it("should have correct 4-parameter signature for QueryResolverFn", () => {
      const fn: QueryResolverFn<{ id: string }, User> = (
        root,
        args,
        _context,
        info,
      ) => {
        void (root satisfies undefined);
        void (info satisfies GraphQLResolveInfo);
        return { id: args.id, name: "", email: "" };
      };
      assert.ok(fn);
    });

    it("should have correct 4-parameter signature for MutationResolverFn", () => {
      const fn: MutationResolverFn<{ name: string }, User> = (
        root,
        args,
        _context,
        info,
      ) => {
        void (root satisfies undefined);
        void (info satisfies GraphQLResolveInfo);
        return { id: "1", name: args.name, email: "" };
      };
      assert.ok(fn);
    });

    it("should have correct 4-parameter signature for FieldResolverFn", () => {
      const fn: FieldResolverFn<User, { format: string }, string> = (
        parent,
        args,
        _context,
        info,
      ) => {
        void (parent satisfies User);
        void (args.format satisfies string);
        void (info satisfies GraphQLResolveInfo);
        return parent.name;
      };
      assert.ok(fn);
    });
  });

  describe("Resolver function types with custom Context (Task 1)", () => {
    type CustomContext = {
      userId: string;
      db: { query: (sql: string) => unknown };
    };

    it("should accept custom Context type for QueryResolverFn", () => {
      const fn: QueryResolverFn<{ id: string }, User, CustomContext> = (
        root,
        args,
        context,
        info,
      ) => {
        void (root satisfies undefined);
        void (context.userId satisfies string);
        void (context.db satisfies { query: (sql: string) => unknown });
        void (info satisfies GraphQLResolveInfo);
        return { id: args.id, name: "", email: "" };
      };
      assert.ok(fn);
    });

    it("should accept custom Context type for MutationResolverFn", () => {
      const fn: MutationResolverFn<{ name: string }, User, CustomContext> = (
        root,
        args,
        context,
        info,
      ) => {
        void (root satisfies undefined);
        void (context.userId satisfies string);
        void (info satisfies GraphQLResolveInfo);
        return { id: "1", name: args.name, email: "" };
      };
      assert.ok(fn);
    });

    it("should accept custom Context type for FieldResolverFn", () => {
      const fn: FieldResolverFn<
        User,
        { format: string },
        string,
        CustomContext
      > = (parent, args, context, info) => {
        void (parent satisfies User);
        void (args.format satisfies string);
        void (context.userId satisfies string);
        void (info satisfies GraphQLResolveInfo);
        return parent.name;
      };
      assert.ok(fn);
    });

    it("should default to unknown when Context type is not specified", () => {
      const fnWithDefault: QueryResolverFn<NoArgs, User> = (
        _root,
        _args,
        _ctx,
        _info,
      ) => ({ id: "1", name: "", email: "" });

      const fnWithExplicit: QueryResolverFn<NoArgs, User, unknown> =
        fnWithDefault;
      assert.ok(fnWithExplicit);
    });
  });

  describe("Branded Types (Task 2)", () => {
    it("should define ResolverKind as union of query/mutation/field", () => {
      const queryKind: ResolverKind = "query";
      const mutationKind: ResolverKind = "mutation";
      const fieldKind: ResolverKind = "field";
      assert.equal(queryKind, "query");
      assert.equal(mutationKind, "mutation");
      assert.equal(fieldKind, "field");
    });

    it("should define QueryResolver as intersection of function and brand", () => {
      type TestQueryResolver = QueryResolver<{ id: string }, User>;

      const resolver: TestQueryResolver = ((_root, _args, _ctx, _info) => ({
        id: "1",
        name: "",
        email: "",
      })) as TestQueryResolver;

      const result = resolver(
        undefined,
        { id: "1" },
        {},
        {} as GraphQLResolveInfo,
      );
      assert.deepEqual(result, { id: "1", name: "", email: "" });
    });

    it("should define MutationResolver as intersection of function and brand", () => {
      type TestMutationResolver = MutationResolver<{ name: string }, User>;

      const resolver: TestMutationResolver = ((_root, _args, _ctx, _info) => ({
        id: "1",
        name: "",
        email: "",
      })) as TestMutationResolver;

      const result = resolver(
        undefined,
        { name: "test" },
        {},
        {} as GraphQLResolveInfo,
      );
      assert.deepEqual(result, { id: "1", name: "", email: "" });
    });

    it("should define FieldResolver as intersection of function and brand", () => {
      type TestFieldResolver = FieldResolver<User, NoArgs, string>;

      const resolver: TestFieldResolver = ((_parent, _args, _ctx, _info) =>
        "test") as TestFieldResolver;

      const result = resolver(
        { id: "1", name: "Test", email: "" },
        {},
        {},
        {} as GraphQLResolveInfo,
      );
      assert.equal(result, "test");
    });

    it("should include kind in QueryResolver brand", () => {
      type BrandType = QueryResolver<NoArgs, User>[ResolverBrand];
      const brand: BrandType = { kind: "query", args: {}, result: {} as User };
      assert.equal(brand.kind, "query");
    });

    it("should include kind in MutationResolver brand", () => {
      type BrandType = MutationResolver<NoArgs, User>[ResolverBrand];
      const brand: BrandType = {
        kind: "mutation",
        args: {},
        result: {} as User,
      };
      assert.equal(brand.kind, "mutation");
    });

    it("should include kind and parent in FieldResolver brand", () => {
      type BrandType = FieldResolver<User, NoArgs, string>[ResolverBrand];
      const brand: BrandType = {
        kind: "field",
        parent: {} as User,
        args: {},
        result: "",
      };
      assert.equal(brand.kind, "field");
    });

    it("should support custom Context in branded types", () => {
      type CustomContext = { userId: string };
      type TestResolver = QueryResolver<NoArgs, User, CustomContext>;

      const resolver: TestResolver = ((_root, _args, ctx, _info) => {
        void (ctx.userId satisfies string);
        return { id: "1", name: "", email: "" };
      }) as TestResolver;

      assert.ok(resolver);
    });
  });

  describe("Context type inference (Task 5.1)", () => {
    it("should infer context type in generated defineQuery", () => {
      type MyContext = { userId: string; db: unknown };
      const apis = createGqlkitApis<MyContext>();

      const query = apis.defineQuery<NoArgs, User>(
        (_root, _args, ctx, _info) => {
          void (ctx.db satisfies unknown);
          return { id: ctx.userId, name: "", email: "" };
        },
      );

      assert.ok(query);
    });

    it("should infer context type in generated defineMutation", () => {
      type MyContext = { userId: string; db: unknown };
      const apis = createGqlkitApis<MyContext>();

      const mutation = apis.defineMutation<{ name: string }, User>(
        (_root, args, ctx, _info) => {
          const userId: string = ctx.userId;
          return { id: userId, name: args.name, email: "" };
        },
      );

      assert.ok(mutation);
    });

    it("should infer context type in generated defineField", () => {
      type MyContext = { userId: string; db: unknown };
      const apis = createGqlkitApis<MyContext>();

      const field = apis.defineField<User, NoArgs, string>(
        (parent, _args, ctx, _info) => {
          void (ctx.userId satisfies string);
          return parent.name;
        },
      );

      assert.ok(field);
    });

    it("should use unknown as default Context when not specified", () => {
      const apis = createGqlkitApis();

      const query = apis.defineQuery<NoArgs, User>(
        (_root, _args, ctx, _info) => {
          void (ctx satisfies unknown);
          return { id: "1", name: "", email: "" };
        },
      );

      assert.ok(query);
    });
  });

  describe("Type mismatch detection (Task 5.2)", () => {
    it("should enforce correct args type", () => {
      type MyContext = { userId: string };
      const apis = createGqlkitApis<MyContext>();

      type GetUserArgs = { id: string };
      const query = apis.defineQuery<GetUserArgs, User>(
        (_root, args, _ctx, _info) => {
          const id: string = args.id;
          return { id, name: "", email: "" };
        },
      );

      assert.ok(query);
    });

    it("should enforce correct return type", () => {
      type MyContext = { userId: string };
      const apis = createGqlkitApis<MyContext>();

      const query = apis.defineQuery<NoArgs, User>(
        (_root, _args, _ctx, _info) => {
          const user: User = { id: "1", name: "", email: "" };
          return user;
        },
      );

      assert.ok(query);
    });

    it("should enforce correct parent type in field resolver", () => {
      type MyContext = { userId: string };
      const apis = createGqlkitApis<MyContext>();

      const field = apis.defineField<User, NoArgs, string>(
        (parent, _args, _ctx, _info) => {
          const email: string = parent.email;
          return email;
        },
      );

      assert.ok(field);
    });
  });

  describe("Resolver types with default context", () => {
    it("should work with QueryResolverFn without context type parameter", () => {
      const fn: QueryResolverFn<{ id: string }, User> = (
        _root,
        args,
        _ctx,
        _info,
      ) => {
        return { id: args.id, name: "", email: "" };
      };
      assert.ok(fn);
    });

    it("should work with MutationResolverFn without context type parameter", () => {
      const fn: MutationResolverFn<{ name: string }, User> = (
        _root,
        args,
        _ctx,
        _info,
      ) => {
        return { id: "1", name: args.name, email: "" };
      };
      assert.ok(fn);
    });

    it("should work with FieldResolverFn without context type parameter", () => {
      const fn: FieldResolverFn<User, NoArgs, string> = (
        parent,
        _args,
        _ctx,
        _info,
      ) => {
        return parent.name;
      };
      assert.ok(fn);
    });
  });

  describe("Branded Type verification (Task 5.4)", () => {
    it("should return branded type from createGqlkitApis.defineQuery", () => {
      const apis = createGqlkitApis<{ userId: string }>();

      const query = apis.defineQuery<NoArgs, User>(
        (_root, _args, _ctx, _info) => ({
          id: "1",
          name: "",
          email: "",
        }),
      );

      type QueryType = typeof query;
      type BrandInfo = QueryType[ResolverBrand];
      void ({} as BrandInfo["kind"] satisfies "query");

      assert.ok(query);
    });

    it("should return branded type from createGqlkitApis.defineMutation", () => {
      const apis = createGqlkitApis<{ userId: string }>();

      const mutation = apis.defineMutation<{ name: string }, User>(
        (_root, _args, _ctx, _info) => ({
          id: "1",
          name: "",
          email: "",
        }),
      );

      type MutationType = typeof mutation;
      type BrandInfo = MutationType[ResolverBrand];
      void ({} as BrandInfo["kind"] satisfies "mutation");

      assert.ok(mutation);
    });

    it("should return branded type from createGqlkitApis.defineField", () => {
      const apis = createGqlkitApis<{ userId: string }>();

      const field = apis.defineField<User, NoArgs, string>(
        (parent, _args, _ctx, _info) => {
          return parent.name;
        },
      );

      type FieldType = typeof field;
      type BrandInfo = FieldType[ResolverBrand];
      void ({} as BrandInfo["kind"] satisfies "field");

      assert.ok(field);
    });

    it("should be callable as a function", () => {
      const apis = createGqlkitApis<{ userId: string }>();

      const query = apis.defineQuery<NoArgs, User>(
        (_root, _args, _ctx, _info) => ({
          id: "1",
          name: "",
          email: "",
        }),
      );

      const result = query(
        undefined,
        {},
        { userId: "u1" },
        {} as GraphQLResolveInfo,
      );
      assert.deepEqual(result, { id: "1", name: "", email: "" });
    });
  });

  describe("GqlkitApis type (Task 3.1 additional)", () => {
    it("should correctly type GqlkitApis interface", () => {
      type MyContext = { userId: string };
      const apis: GqlkitApis<MyContext> = createGqlkitApis<MyContext>();

      assert.ok(apis.defineQuery);
      assert.ok(apis.defineMutation);
      assert.ok(apis.defineField);
    });
  });

  describe("Package exports (Task 8)", () => {
    it("should export NoArgs type (Task 8.1)", () => {
      const args: NoArgs = {};
      assert.deepEqual(args, {});
    });

    it("should export NoArgs usable with createGqlkitApis (Task 8.1)", () => {
      type MyContext = { userId: string };
      const apis = createGqlkitApis<MyContext>();

      const query = apis.defineQuery<NoArgs, User>(
        (_root, _args, _ctx, _info) => ({
          id: "1",
          name: "",
          email: "",
        }),
      );

      assert.ok(query);
    });

    it("should export createGqlkitApis (Task 8.2)", () => {
      assert.ok(typeof createGqlkitApis === "function");
    });

    it("should export GqlkitApis type (Task 8.2)", () => {
      type MyContext = { userId: string };
      const apis: GqlkitApis<MyContext> = createGqlkitApis<MyContext>();
      assert.ok(apis);
    });

    it("should export QueryResolver branded type (Task 8.2)", () => {
      type MyContext = { userId: string };
      const apis = createGqlkitApis<MyContext>();

      const query: QueryResolver<NoArgs, User, MyContext> = apis.defineQuery<
        NoArgs,
        User
      >((_root, _args, _ctx, _info) => ({ id: "1", name: "", email: "" }));

      assert.ok(query);
    });

    it("should export MutationResolver branded type (Task 8.2)", () => {
      type MyContext = { userId: string };
      const apis = createGqlkitApis<MyContext>();

      const mutation: MutationResolver<{ name: string }, User, MyContext> =
        apis.defineMutation<{ name: string }, User>(
          (_root, _args, _ctx, _info) => ({ id: "1", name: "", email: "" }),
        );

      assert.ok(mutation);
    });

    it("should export FieldResolver branded type (Task 8.2)", () => {
      type MyContext = { userId: string };
      const apis = createGqlkitApis<MyContext>();

      const field: FieldResolver<User, NoArgs, string, MyContext> =
        apis.defineField<User, NoArgs, string>(
          (parent, _args, _ctx, _info) => parent.name,
        );

      assert.ok(field);
    });

    it("should export QueryResolverFn type (Task 8.2)", () => {
      const fn: QueryResolverFn<{ id: string }, User> = (
        _root,
        args,
        _ctx,
        _info,
      ) => ({
        id: args.id,
        name: "",
        email: "",
      });
      assert.ok(fn);
    });

    it("should export MutationResolverFn type (Task 8.2)", () => {
      const fn: MutationResolverFn<{ name: string }, User> = (
        _root,
        args,
        _ctx,
        _info,
      ) => ({
        id: "1",
        name: args.name,
        email: "",
      });
      assert.ok(fn);
    });

    it("should export FieldResolverFn type (Task 8.2)", () => {
      const fn: FieldResolverFn<User, NoArgs, string> = (
        parent,
        _args,
        _ctx,
        _info,
      ) => parent.name;
      assert.ok(fn);
    });

    it("should export ResolverBrand and ResolverKind types (Task 8.2)", () => {
      const queryKind: ResolverKind = "query";
      const mutationKind: ResolverKind = "mutation";
      const fieldKind: ResolverKind = "field";

      assert.equal(queryKind, "query");
      assert.equal(mutationKind, "mutation");
      assert.equal(fieldKind, "field");
    });
  });
});
