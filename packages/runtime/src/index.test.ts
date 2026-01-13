/**
 * Tests for abstract type resolver types and define functions.
 *
 * These tests verify that defineResolveType and defineIsTypeOf
 * correctly handle type resolution for union/interface types
 * and type checking for object types.
 */

import type { GraphQLResolveInfo } from "graphql";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  createGqlkitApis,
  type IsTypeOfResolver,
  type IsTypeOfResolverFn,
  type ResolveTypeResolver,
  type ResolveTypeResolverFn,
} from "./index.js";

type TestContext = { userId: string };

type Dog = { kind: "dog"; name: string; breed: string };
type Cat = { kind: "cat"; name: string; indoor: boolean };
type Animal = Dog | Cat;

describe("defineResolveType", () => {
  describe("Type definitions", () => {
    it("should define ResolveTypeResolverFn with correct signature", () => {
      type TestFn = ResolveTypeResolverFn<Animal, TestContext>;

      expectTypeOf<TestFn>().toBeFunction();
      expectTypeOf<TestFn>().parameter(0).toEqualTypeOf<Animal>();
      expectTypeOf<TestFn>().parameter(1).toEqualTypeOf<TestContext>();
      expectTypeOf<TestFn>().parameter(2).toEqualTypeOf<GraphQLResolveInfo>();
      expectTypeOf<TestFn>().returns.toEqualTypeOf<string | Promise<string>>();
    });

    it("should define ResolveTypeResolver with metadata structure", () => {
      type TestResolver = ResolveTypeResolver<Animal, TestContext>;

      expectTypeOf<TestResolver>().toMatchTypeOf<
        ResolveTypeResolverFn<Animal, TestContext>
      >();

      type MetadataKey = keyof TestResolver;
      expectTypeOf<" $gqlkitAbstractResolver">().toMatchTypeOf<MetadataKey>();
    });

    it("should accept unknown as default context type", () => {
      type TestFn = ResolveTypeResolverFn<Animal>;

      expectTypeOf<TestFn>().parameter(1).toEqualTypeOf<unknown>();
    });
  });

  describe("Runtime behavior", () => {
    it("should return the resolver function as-is", () => {
      const { defineResolveType } = createGqlkitApis<TestContext>();

      const resolver = (value: Animal) => {
        return value.kind === "dog" ? "Dog" : "Cat";
      };

      const result = defineResolveType<Animal>(resolver);

      expect(result).toBe(resolver);
    });

    it("should work with async resolver", () => {
      const { defineResolveType } = createGqlkitApis<TestContext>();

      const resolver = async (value: Animal) => {
        return value.kind === "dog" ? "Dog" : "Cat";
      };

      const result = defineResolveType<Animal>(resolver);

      expect(result).toBe(resolver);
    });

    it("should preserve resolver function behavior", async () => {
      const { defineResolveType } = createGqlkitApis<TestContext>();

      const resolver = (value: Animal) => {
        return value.kind === "dog" ? "Dog" : "Cat";
      };

      const result = defineResolveType<Animal>(resolver);

      const dog: Dog = { kind: "dog", name: "Buddy", breed: "Labrador" };
      const cat: Cat = { kind: "cat", name: "Whiskers", indoor: true };

      expect(result(dog, { userId: "123" }, {} as GraphQLResolveInfo)).toBe(
        "Dog",
      );
      expect(result(cat, { userId: "123" }, {} as GraphQLResolveInfo)).toBe(
        "Cat",
      );
    });
  });
});

describe("defineIsTypeOf", () => {
  describe("Type definitions", () => {
    it("should define IsTypeOfResolverFn with correct signature", () => {
      type TestFn = IsTypeOfResolverFn<Dog, TestContext>;

      expectTypeOf<TestFn>().toBeFunction();
      expectTypeOf<TestFn>().parameter(0).toEqualTypeOf<unknown>();
      expectTypeOf<TestFn>().parameter(1).toEqualTypeOf<TestContext>();
      expectTypeOf<TestFn>().parameter(2).toEqualTypeOf<GraphQLResolveInfo>();
      expectTypeOf<TestFn>().returns.toEqualTypeOf<
        boolean | Promise<boolean>
      >();
    });

    it("should define IsTypeOfResolver with metadata structure", () => {
      type TestResolver = IsTypeOfResolver<Dog, TestContext>;

      expectTypeOf<TestResolver>().toMatchTypeOf<
        IsTypeOfResolverFn<Dog, TestContext>
      >();

      type MetadataKey = keyof TestResolver;
      expectTypeOf<" $gqlkitAbstractResolver">().toMatchTypeOf<MetadataKey>();
    });

    it("should accept unknown as default context type", () => {
      type TestFn = IsTypeOfResolverFn<Dog>;

      expectTypeOf<TestFn>().parameter(1).toEqualTypeOf<unknown>();
    });

    it("should have value parameter typed as unknown", () => {
      type TestFn = IsTypeOfResolverFn<Dog, TestContext>;

      expectTypeOf<TestFn>().parameter(0).toEqualTypeOf<unknown>();
    });
  });

  describe("Runtime behavior", () => {
    it("should return the resolver function as-is", () => {
      const { defineIsTypeOf } = createGqlkitApis<TestContext>();

      const resolver = (value: unknown) => {
        return (
          typeof value === "object" &&
          value !== null &&
          "kind" in value &&
          value.kind === "dog"
        );
      };

      const result = defineIsTypeOf<Dog>(resolver);

      expect(result).toBe(resolver);
    });

    it("should work with async resolver", () => {
      const { defineIsTypeOf } = createGqlkitApis<TestContext>();

      const resolver = async (value: unknown) => {
        return (
          typeof value === "object" &&
          value !== null &&
          "kind" in value &&
          value.kind === "dog"
        );
      };

      const result = defineIsTypeOf<Dog>(resolver);

      expect(result).toBe(resolver);
    });

    it("should preserve resolver function behavior", () => {
      const { defineIsTypeOf } = createGqlkitApis<TestContext>();

      const resolver = (value: unknown) => {
        return (
          typeof value === "object" &&
          value !== null &&
          "kind" in value &&
          value.kind === "dog"
        );
      };

      const result = defineIsTypeOf<Dog>(resolver);

      const dog: Dog = { kind: "dog", name: "Buddy", breed: "Labrador" };
      const cat: Cat = { kind: "cat", name: "Whiskers", indoor: true };

      expect(result(dog, { userId: "123" }, {} as GraphQLResolveInfo)).toBe(
        true,
      );
      expect(result(cat, { userId: "123" }, {} as GraphQLResolveInfo)).toBe(
        false,
      );
    });
  });
});

describe("GqlkitApis integration", () => {
  it("should include defineResolveType in returned API", () => {
    const apis = createGqlkitApis<TestContext>();

    expect(apis).toHaveProperty("defineResolveType");
    expect(typeof apis.defineResolveType).toBe("function");
  });

  it("should include defineIsTypeOf in returned API", () => {
    const apis = createGqlkitApis<TestContext>();

    expect(apis).toHaveProperty("defineIsTypeOf");
    expect(typeof apis.defineIsTypeOf).toBe("function");
  });

  it("should use TContext for defineResolveType context parameter", () => {
    const { defineResolveType } = createGqlkitApis<TestContext>();

    type ResultType = ReturnType<typeof defineResolveType<Animal>>;
    expectTypeOf<ResultType>().toMatchTypeOf<
      ResolveTypeResolver<Animal, TestContext>
    >();
  });

  it("should use TContext for defineIsTypeOf context parameter", () => {
    const { defineIsTypeOf } = createGqlkitApis<TestContext>();

    type ResultType = ReturnType<typeof defineIsTypeOf<Dog>>;
    expectTypeOf<ResultType>().toMatchTypeOf<
      IsTypeOfResolver<Dog, TestContext>
    >();
  });
});
