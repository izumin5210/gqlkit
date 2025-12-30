/**
 * Type inference tests for @gqlkit-ts/runtime
 *
 * These tests verify that TypeScript correctly infers and enforces types.
 * The tests are compile-time checks - if this file compiles, the types work correctly.
 * Runtime assertions verify the tests are actually executed.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { GraphQLResolveInfo } from "graphql";
import {
  defineQuery,
  defineMutation,
  defineField,
  type NoArgs,
  type GqlkitContext,
  type QueryResolverFn,
  type MutationResolverFn,
  type FieldResolverFn,
} from "./index.js";

type User = {
  id: string;
  name: string;
  email: string;
};

type Post = {
  id: string;
  title: string;
  authorId: string;
};

type CreateUserInput = {
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

  describe("GqlkitContext type", () => {
    it("should be unknown by default (when Context is empty)", () => {
      const ctx: GqlkitContext = { anything: "is allowed" };
      assert.ok(ctx !== undefined);
    });
  });

  describe("defineQuery type inference", () => {
    it("should infer return type correctly for sync resolver", () => {
      const users = defineQuery<NoArgs, User[]>(
        (_root, _args, _ctx, _info) => []
      );

      const result: QueryResolverFn<NoArgs, User[]> = users;
      assert.ok(result);
    });

    it("should infer return type correctly for async resolver", () => {
      const users = defineQuery<NoArgs, User[]>(async (_root, _args, _ctx, _info) =>
        Promise.resolve([])
      );

      const result: QueryResolverFn<NoArgs, User[]> = users;
      assert.ok(result);
    });

    it("should infer args type correctly", () => {
      type GetUserArgs = { id: string };
      const user = defineQuery<GetUserArgs, User | null>(
        (_root, args, _ctx, _info) => {
          const _id: string = args.id;
          return null;
        }
      );

      const result: QueryResolverFn<GetUserArgs, User | null> = user;
      assert.ok(result);
    });

    it("should enforce root parameter type as undefined", () => {
      defineQuery<NoArgs, string>(
        (root, _args, _ctx, _info) => {
          const _r: undefined = root;
          return "ok";
        }
      );
      assert.ok(true);
    });
  });

  describe("defineMutation type inference", () => {
    it("should infer return type correctly for sync resolver", () => {
      const createUser = defineMutation<{ input: CreateUserInput }, User>(
        (_root, args, _ctx, _info) => ({
          id: "new",
          name: args.input.name,
          email: args.input.email,
        })
      );

      const result: MutationResolverFn<{ input: CreateUserInput }, User> =
        createUser;
      assert.ok(result);
    });

    it("should infer return type correctly for async resolver", () => {
      const createUser = defineMutation<{ input: CreateUserInput }, User>(
        async (_root, args, _ctx, _info) =>
          Promise.resolve({
            id: "new",
            name: args.input.name,
            email: args.input.email,
          })
      );

      const result: MutationResolverFn<{ input: CreateUserInput }, User> =
        createUser;
      assert.ok(result);
    });

    it("should support NoArgs for mutations without args", () => {
      const deleteAllUsers = defineMutation<NoArgs, boolean>(
        (_root, _args, _ctx, _info) => true
      );

      const result: MutationResolverFn<NoArgs, boolean> = deleteAllUsers;
      assert.ok(result);
    });
  });

  describe("defineField type inference", () => {
    it("should infer parent type correctly", () => {
      const fullName = defineField<User, NoArgs, string>(
        (parent, _args, _ctx, _info) => {
          const _name: string = parent.name;
          const _email: string = parent.email;
          return parent.name;
        }
      );

      const result: FieldResolverFn<User, NoArgs, string> = fullName;
      assert.ok(result);
    });

    it("should infer args type correctly for field with args", () => {
      type PostsArgs = { limit: number; offset?: number };
      const posts = defineField<User, PostsArgs, Post[]>(
        (parent, args, _ctx, _info) => {
          const _limit: number = args.limit;
          const _authorId: string = parent.id;
          return [];
        }
      );

      const result: FieldResolverFn<User, PostsArgs, Post[]> = posts;
      assert.ok(result);
    });

    it("should infer return type correctly for async resolver", () => {
      const posts = defineField<User, NoArgs, Post[]>(
        async (parent, _args, _ctx, _info) =>
          Promise.resolve([{ id: "1", title: "Post", authorId: parent.id }])
      );

      const result: FieldResolverFn<User, NoArgs, Post[]> = posts;
      assert.ok(result);
    });

    it("should support nullable return types", () => {
      const avatar = defineField<User, NoArgs, string | null>(
        (_parent, _args, _ctx, _info) => null
      );

      const result: FieldResolverFn<User, NoArgs, string | null> = avatar;
      assert.ok(result);
    });
  });

  describe("Resolver function types", () => {
    it("should have correct 4-parameter signature for QueryResolverFn", () => {
      const fn: QueryResolverFn<{ id: string }, User> = (
        root,
        args,
        context,
        info
      ) => {
        const _root: undefined = root;
        const _id: string = args.id;
        const _ctx: GqlkitContext = context;
        const _info: GraphQLResolveInfo = info;
        return { id: _id, name: "", email: "" };
      };
      assert.ok(fn);
    });

    it("should have correct 4-parameter signature for MutationResolverFn", () => {
      const fn: MutationResolverFn<{ name: string }, User> = (
        root,
        args,
        context,
        info
      ) => {
        const _root: undefined = root;
        const _name: string = args.name;
        const _ctx: GqlkitContext = context;
        const _info: GraphQLResolveInfo = info;
        return { id: "1", name: _name, email: "" };
      };
      assert.ok(fn);
    });

    it("should have correct 4-parameter signature for FieldResolverFn", () => {
      const fn: FieldResolverFn<User, { format: string }, string> = (
        parent,
        args,
        context,
        info
      ) => {
        const _user: User = parent;
        const _format: string = args.format;
        const _ctx: GqlkitContext = context;
        const _info: GraphQLResolveInfo = info;
        return _user.name;
      };
      assert.ok(fn);
    });
  });
});
