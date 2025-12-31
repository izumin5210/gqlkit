import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GraphQLResolveInfo } from "graphql";
import { createGqlkitApis, type GqlkitApis, type NoArgs } from "./index.js";

describe("@gqlkit-ts/runtime", () => {
  describe("NoArgs type", () => {
    it("should be usable as empty args type", () => {
      const args: NoArgs = {};
      assert.deepEqual(args, {});
    });
  });

  describe("createGqlkitApis (Task 3 & 4)", () => {
    type TestContext = {
      userId: string;
      db: { query: (sql: string) => unknown };
    };

    describe("factory function behavior (Task 4.1)", () => {
      it("should return an object with defineQuery, defineMutation, defineField", () => {
        const apis = createGqlkitApis<TestContext>();

        assert.ok(apis);
        assert.ok(typeof apis.defineQuery === "function");
        assert.ok(typeof apis.defineMutation === "function");
        assert.ok(typeof apis.defineField === "function");
      });

      it("should return resolvers as identity functions", () => {
        const apis = createGqlkitApis<TestContext>();

        type User = { id: string; name: string };
        const queryResolver = (
          _root: undefined,
          _args: NoArgs,
          _ctx: TestContext,
          _info: GraphQLResolveInfo,
        ): User => ({ id: "1", name: "Test" });

        const mutationResolver = (
          _root: undefined,
          _args: { name: string },
          _ctx: TestContext,
          _info: GraphQLResolveInfo,
        ): User => ({ id: "2", name: "Created" });

        const fieldResolver = (
          parent: User,
          _args: NoArgs,
          _ctx: TestContext,
          _info: GraphQLResolveInfo,
        ): string => parent.name.toUpperCase();

        const query = apis.defineQuery<NoArgs, User>(queryResolver);
        const mutation = apis.defineMutation<{ name: string }, User>(
          mutationResolver,
        );
        const field = apis.defineField<User, NoArgs, string>(fieldResolver);

        assert.strictEqual(query, queryResolver);
        assert.strictEqual(mutation, mutationResolver);
        assert.strictEqual(field, fieldResolver);
      });

      it("should support async resolvers", async () => {
        const apis = createGqlkitApis<TestContext>();

        type User = { id: string; name: string };
        const asyncResolver = async (
          _root: undefined,
          _args: NoArgs,
          _ctx: TestContext,
          _info: GraphQLResolveInfo,
        ): Promise<User> => ({ id: "1", name: "Async User" });

        const query = apis.defineQuery<NoArgs, User>(asyncResolver);

        assert.strictEqual(query, asyncResolver);
        const result = await query(
          undefined,
          {},
          { userId: "u1", db: { query: () => null } },
          {} as GraphQLResolveInfo,
        );
        assert.deepEqual(result, { id: "1", name: "Async User" });
      });
    });

    describe("multiple schema support (Task 4.2)", () => {
      it("should return independent API sets for different Context types", () => {
        type AdminContext = { adminId: string; permissions: string[] };
        type PublicContext = { sessionId: string };

        const adminApis = createGqlkitApis<AdminContext>();
        const publicApis = createGqlkitApis<PublicContext>();

        assert.ok(adminApis);
        assert.ok(publicApis);
        assert.notStrictEqual(adminApis, publicApis);
      });

      it("should bind each API set to its Context type", () => {
        type AdminContext = { adminId: string };
        type PublicContext = { sessionId: string };

        const adminApis = createGqlkitApis<AdminContext>();
        const publicApis = createGqlkitApis<PublicContext>();

        type User = { id: string };

        const adminQuery = adminApis.defineQuery<NoArgs, User>(
          (_root, _args, ctx, _info) => {
            const _adminId: string = ctx.adminId;
            return { id: "admin-user" };
          },
        );

        const publicQuery = publicApis.defineQuery<NoArgs, User>(
          (_root, _args, ctx, _info) => {
            const _sessionId: string = ctx.sessionId;
            return { id: "public-user" };
          },
        );

        assert.ok(adminQuery);
        assert.ok(publicQuery);
      });
    });

    describe("GqlkitApis type (Task 3.1)", () => {
      it("should be correctly typed", () => {
        const apis: GqlkitApis<TestContext> = createGqlkitApis<TestContext>();
        assert.ok(apis);
      });
    });

    describe("default Context type (Task 3.2)", () => {
      it("should use unknown as default Context when not specified", () => {
        const apis = createGqlkitApis();

        type User = { id: string };
        const query = apis.defineQuery<NoArgs, User>(
          (_root, _args, _ctx, _info) => {
            return { id: "1" };
          },
        );

        assert.ok(query);
      });
    });
  });
});
