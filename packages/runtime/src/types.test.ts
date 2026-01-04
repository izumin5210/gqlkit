/**
 * Type inference tests for @gqlkit-ts/runtime
 *
 * These tests verify that TypeScript correctly infers and enforces types.
 * The tests are compile-time checks - if this file compiles, the types work correctly.
 * Runtime assertions verify the tests are actually executed.
 */

import type { GraphQLResolveInfo } from "graphql";
import { describe, expect, it } from "vitest";
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
  type ResolverKind,
  type ResolverMetadataKey,
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
      expect(emptyArgs).toEqual({});
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
      expect(fn).toBeDefined();
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
      expect(fn).toBeDefined();
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
      expect(fn).toBeDefined();
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
      expect(fn).toBeDefined();
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
      expect(fn).toBeDefined();
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
      expect(fn).toBeDefined();
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
      expect(fnWithExplicit).toBeDefined();
    });
  });

  describe("Branded Types (Task 2)", () => {
    it("should define ResolverKind as union of query/mutation/field", () => {
      const queryKind: ResolverKind = "query";
      const mutationKind: ResolverKind = "mutation";
      const fieldKind: ResolverKind = "field";
      expect(queryKind).toBe("query");
      expect(mutationKind).toBe("mutation");
      expect(fieldKind).toBe("field");
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
      expect(result).toEqual({ id: "1", name: "", email: "" });
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
      expect(result).toEqual({ id: "1", name: "", email: "" });
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
      expect(result).toBe("test");
    });

    it("should include kind in QueryResolver metadata", () => {
      type MetadataType = NonNullable<
        QueryResolver<NoArgs, User>[ResolverMetadataKey]
      >;
      const metadata: MetadataType = {
        kind: "query",
        args: {},
        result: {} as User,
      };
      expect(metadata.kind).toBe("query");
    });

    it("should include kind in MutationResolver metadata", () => {
      type MetadataType = NonNullable<
        MutationResolver<NoArgs, User>[ResolverMetadataKey]
      >;
      const metadata: MetadataType = {
        kind: "mutation",
        args: {},
        result: {} as User,
      };
      expect(metadata.kind).toBe("mutation");
    });

    it("should include kind and parent in FieldResolver metadata", () => {
      type MetadataType = NonNullable<
        FieldResolver<User, NoArgs, string>[ResolverMetadataKey]
      >;
      const metadata: MetadataType = {
        kind: "field",
        parent: {} as User,
        args: {},
        result: "",
      };
      expect(metadata.kind).toBe("field");
    });

    it("should support custom Context in branded types", () => {
      type CustomContext = { userId: string };
      type TestResolver = QueryResolver<NoArgs, User, CustomContext>;

      const resolver: TestResolver = ((_root, _args, ctx, _info) => {
        void (ctx.userId satisfies string);
        return { id: "1", name: "", email: "" };
      }) as TestResolver;

      expect(resolver).toBeDefined();
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

      expect(query).toBeDefined();
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

      expect(mutation).toBeDefined();
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

      expect(field).toBeDefined();
    });

    it("should use unknown as default Context when not specified", () => {
      const apis = createGqlkitApis();

      const query = apis.defineQuery<NoArgs, User>(
        (_root, _args, ctx, _info) => {
          void (ctx satisfies unknown);
          return { id: "1", name: "", email: "" };
        },
      );

      expect(query).toBeDefined();
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

      expect(query).toBeDefined();
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

      expect(query).toBeDefined();
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

      expect(field).toBeDefined();
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
      expect(fn).toBeDefined();
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
      expect(fn).toBeDefined();
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
      expect(fn).toBeDefined();
    });
  });

  describe("Resolver type metadata verification (Task 5.4)", () => {
    it("should return resolver type with metadata from createGqlkitApis.defineQuery", () => {
      const apis = createGqlkitApis<{ userId: string }>();

      const query = apis.defineQuery<NoArgs, User>(
        (_root, _args, _ctx, _info) => ({
          id: "1",
          name: "",
          email: "",
        }),
      );

      type QueryType = typeof query;
      type MetadataInfo = NonNullable<QueryType[ResolverMetadataKey]>;
      void ({} as MetadataInfo["kind"] satisfies "query");

      expect(query).toBeDefined();
    });

    it("should return resolver type with metadata from createGqlkitApis.defineMutation", () => {
      const apis = createGqlkitApis<{ userId: string }>();

      const mutation = apis.defineMutation<{ name: string }, User>(
        (_root, _args, _ctx, _info) => ({
          id: "1",
          name: "",
          email: "",
        }),
      );

      type MutationType = typeof mutation;
      type MetadataInfo = NonNullable<MutationType[ResolverMetadataKey]>;
      void ({} as MetadataInfo["kind"] satisfies "mutation");

      expect(mutation).toBeDefined();
    });

    it("should return resolver type with metadata from createGqlkitApis.defineField", () => {
      const apis = createGqlkitApis<{ userId: string }>();

      const field = apis.defineField<User, NoArgs, string>(
        (parent, _args, _ctx, _info) => {
          return parent.name;
        },
      );

      type FieldType = typeof field;
      type MetadataInfo = NonNullable<FieldType[ResolverMetadataKey]>;
      void ({} as MetadataInfo["kind"] satisfies "field");

      expect(field).toBeDefined();
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
      expect(result).toEqual({ id: "1", name: "", email: "" });
    });
  });

  describe("GqlkitApis type (Task 3.1 additional)", () => {
    it("should correctly type GqlkitApis interface", () => {
      type MyContext = { userId: string };
      const apis: GqlkitApis<MyContext> = createGqlkitApis<MyContext>();

      expect(apis.defineQuery).toBeDefined();
      expect(apis.defineMutation).toBeDefined();
      expect(apis.defineField).toBeDefined();
    });
  });

  describe("Package exports (Task 8)", () => {
    it("should export NoArgs type (Task 8.1)", () => {
      const args: NoArgs = {};
      expect(args).toEqual({});
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

      expect(query).toBeDefined();
    });

    it("should export createGqlkitApis (Task 8.2)", () => {
      expect(typeof createGqlkitApis).toBe("function");
    });

    it("should export GqlkitApis type (Task 8.2)", () => {
      type MyContext = { userId: string };
      const apis: GqlkitApis<MyContext> = createGqlkitApis<MyContext>();
      expect(apis).toBeDefined();
    });

    it("should export QueryResolver branded type (Task 8.2)", () => {
      type MyContext = { userId: string };
      const apis = createGqlkitApis<MyContext>();

      const query: QueryResolver<NoArgs, User, MyContext> = apis.defineQuery<
        NoArgs,
        User
      >((_root, _args, _ctx, _info) => ({ id: "1", name: "", email: "" }));

      expect(query).toBeDefined();
    });

    it("should export MutationResolver branded type (Task 8.2)", () => {
      type MyContext = { userId: string };
      const apis = createGqlkitApis<MyContext>();

      const mutation: MutationResolver<{ name: string }, User, MyContext> =
        apis.defineMutation<{ name: string }, User>(
          (_root, _args, _ctx, _info) => ({ id: "1", name: "", email: "" }),
        );

      expect(mutation).toBeDefined();
    });

    it("should export FieldResolver branded type (Task 8.2)", () => {
      type MyContext = { userId: string };
      const apis = createGqlkitApis<MyContext>();

      const field: FieldResolver<User, NoArgs, string, MyContext> =
        apis.defineField<User, NoArgs, string>(
          (parent, _args, _ctx, _info) => parent.name,
        );

      expect(field).toBeDefined();
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
      expect(fn).toBeDefined();
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
      expect(fn).toBeDefined();
    });

    it("should export FieldResolverFn type (Task 8.2)", () => {
      const fn: FieldResolverFn<User, NoArgs, string> = (
        parent,
        _args,
        _ctx,
        _info,
      ) => parent.name;
      expect(fn).toBeDefined();
    });

    it("should export ResolverMetadataKey and ResolverKind types (Task 8.2)", () => {
      const key: ResolverMetadataKey = " $gqlkitResolver ";
      const queryKind: ResolverKind = "query";
      const mutationKind: ResolverKind = "mutation";
      const fieldKind: ResolverKind = "field";

      expect(key).toBe(" $gqlkitResolver ");
      expect(queryKind).toBe("query");
      expect(mutationKind).toBe("mutation");
      expect(fieldKind).toBe("field");
    });
  });
});
