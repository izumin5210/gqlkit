import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GraphQLResolveInfo } from "graphql";
import {
  defineField,
  defineMutation,
  defineQuery,
  type NoArgs,
} from "./index.js";

describe("@gqlkit-ts/runtime", () => {
  describe("NoArgs type", () => {
    it("should be usable as empty args type", () => {
      const args: NoArgs = {};
      assert.deepEqual(args, {});
    });
  });

  describe("defineQuery", () => {
    it("should return the resolver function as-is (identity function)", () => {
      type User = { id: string; name: string };
      const resolver = (
        _root: undefined,
        _args: NoArgs,
        _ctx: unknown,
        _info: GraphQLResolveInfo,
      ): User => ({
        id: "1",
        name: "Test User",
      });

      const result = defineQuery<NoArgs, User>(resolver);
      assert.strictEqual(result, resolver);
    });

    it("should support async resolver functions", async () => {
      type User = { id: string; name: string };
      const resolver = async (
        _root: undefined,
        _args: NoArgs,
        _ctx: unknown,
        _info: GraphQLResolveInfo,
      ): Promise<User> => ({
        id: "1",
        name: "Async User",
      });

      const result = defineQuery<NoArgs, User>(resolver);
      assert.strictEqual(result, resolver);

      const resolvedValue = await result(
        undefined,
        {},
        {},
        {} as GraphQLResolveInfo,
      );
      assert.deepEqual(resolvedValue, { id: "1", name: "Async User" });
    });

    it("should support resolver with args", () => {
      type GetUserArgs = { id: string };
      type User = { id: string; name: string };
      const resolver = (
        _root: undefined,
        args: GetUserArgs,
        _ctx: unknown,
        _info: GraphQLResolveInfo,
      ): User => ({
        id: args.id,
        name: "User",
      });

      const result = defineQuery<GetUserArgs, User>(resolver);
      assert.strictEqual(result, resolver);
    });
  });

  describe("defineMutation", () => {
    it("should return the resolver function as-is (identity function)", () => {
      type CreateUserInput = { name: string };
      type User = { id: string; name: string };
      const resolver = (
        _root: undefined,
        args: { input: CreateUserInput },
        _ctx: unknown,
        _info: GraphQLResolveInfo,
      ): User => ({
        id: "new-id",
        name: args.input.name,
      });

      const result = defineMutation<{ input: CreateUserInput }, User>(resolver);
      assert.strictEqual(result, resolver);
    });

    it("should support async resolver functions", async () => {
      type User = { id: string; name: string };
      const resolver = async (
        _root: undefined,
        _args: NoArgs,
        _ctx: unknown,
        _info: GraphQLResolveInfo,
      ): Promise<User> => ({
        id: "1",
        name: "Deleted User",
      });

      const result = defineMutation<NoArgs, User>(resolver);
      assert.strictEqual(result, resolver);

      const resolvedValue = await result(
        undefined,
        {},
        {},
        {} as GraphQLResolveInfo,
      );
      assert.deepEqual(resolvedValue, { id: "1", name: "Deleted User" });
    });
  });

  describe("defineField", () => {
    it("should return the resolver function as-is (identity function)", () => {
      type User = { id: string; firstName: string; lastName: string };
      const resolver = (
        parent: User,
        _args: NoArgs,
        _ctx: unknown,
        _info: GraphQLResolveInfo,
      ): string => `${parent.firstName} ${parent.lastName}`;

      const result = defineField<User, NoArgs, string>(resolver);
      assert.strictEqual(result, resolver);
    });

    it("should support async resolver functions", async () => {
      type User = { id: string };
      type Post = { id: string; title: string };
      const resolver = async (
        parent: User,
        _args: NoArgs,
        _ctx: unknown,
        _info: GraphQLResolveInfo,
      ): Promise<Post[]> => [{ id: "1", title: `Post by ${parent.id}` }];

      const result = defineField<User, NoArgs, Post[]>(resolver);
      assert.strictEqual(result, resolver);

      const resolvedValue = await result(
        { id: "user-1" },
        {},
        {},
        {} as GraphQLResolveInfo,
      );
      assert.deepEqual(resolvedValue, [{ id: "1", title: "Post by user-1" }]);
    });

    it("should support resolver with args", () => {
      type User = { id: string };
      type Post = { id: string; title: string };
      type PostsArgs = { limit: number };
      const resolver = (
        _parent: User,
        args: PostsArgs,
        _ctx: unknown,
        _info: GraphQLResolveInfo,
      ): Post[] =>
        Array.from({ length: args.limit }, (_, i) => ({
          id: `${i}`,
          title: `Post ${i}`,
        }));

      const result = defineField<User, PostsArgs, Post[]>(resolver);
      assert.strictEqual(result, resolver);
    });
  });
});
