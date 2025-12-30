import assert from "node:assert";
import { describe, it } from "node:test";
import type { GraphQLTypeInfo } from "../types/index.js";
import { validateTypes } from "./type-validator.js";

describe("TypeValidator", () => {
  describe("validateTypes", () => {
    describe("reference resolution", () => {
      it("should pass when all references are resolvable", () => {
        const types: GraphQLTypeInfo[] = [
          {
            name: "User",
            kind: "Object",
            fields: [
              {
                name: "id",
                type: { typeName: "String", nullable: false, list: false },
              },
            ],
            sourceFile: "/path/to/user.ts",
          },
          {
            name: "Post",
            kind: "Object",
            fields: [
              {
                name: "author",
                type: { typeName: "User", nullable: false, list: false },
              },
            ],
            sourceFile: "/path/to/post.ts",
          },
        ];

        const result = validateTypes(types);

        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.diagnostics.length, 0);
      });

      it("should pass for built-in scalar types", () => {
        const types: GraphQLTypeInfo[] = [
          {
            name: "User",
            kind: "Object",
            fields: [
              {
                name: "id",
                type: { typeName: "String", nullable: false, list: false },
              },
              {
                name: "age",
                type: { typeName: "Int", nullable: false, list: false },
              },
              {
                name: "active",
                type: { typeName: "Boolean", nullable: false, list: false },
              },
            ],
            sourceFile: "/path/to/user.ts",
          },
        ];

        const result = validateTypes(types);

        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.diagnostics.length, 0);
      });

      it("should report error for unresolved type reference", () => {
        const types: GraphQLTypeInfo[] = [
          {
            name: "Post",
            kind: "Object",
            fields: [
              {
                name: "author",
                type: { typeName: "User", nullable: false, list: false },
              },
            ],
            sourceFile: "/path/to/post.ts",
          },
        ];

        const result = validateTypes(types);

        assert.strictEqual(result.valid, false);
        assert.strictEqual(result.diagnostics.length, 1);
        assert.strictEqual(result.diagnostics[0]?.code, "UNRESOLVED_REFERENCE");
      });

      it("should include field name in error message", () => {
        const types: GraphQLTypeInfo[] = [
          {
            name: "Post",
            kind: "Object",
            fields: [
              {
                name: "author",
                type: { typeName: "User", nullable: false, list: false },
              },
            ],
            sourceFile: "/path/to/post.ts",
          },
        ];

        const result = validateTypes(types);

        assert.ok(result.diagnostics[0]?.message.includes("author"));
        assert.ok(result.diagnostics[0]?.message.includes("User"));
      });

      it("should include source location in diagnostics", () => {
        const types: GraphQLTypeInfo[] = [
          {
            name: "Post",
            kind: "Object",
            fields: [
              {
                name: "author",
                type: { typeName: "User", nullable: false, list: false },
              },
            ],
            sourceFile: "/path/to/post.ts",
          },
        ];

        const result = validateTypes(types);

        assert.ok(result.diagnostics[0]?.location);
        assert.strictEqual(
          result.diagnostics[0]?.location.file,
          "/path/to/post.ts",
        );
      });

      it("should validate union member references", () => {
        const types: GraphQLTypeInfo[] = [
          {
            name: "User",
            kind: "Object",
            fields: [],
            sourceFile: "/path/to/user.ts",
          },
          {
            name: "SearchResult",
            kind: "Union",
            unionMembers: ["User", "Post"],
            sourceFile: "/path/to/search.ts",
          },
        ];

        const result = validateTypes(types);

        assert.strictEqual(result.valid, false);
        assert.ok(result.diagnostics.some((d) => d.message.includes("Post")));
      });

      it("should collect all unresolved references", () => {
        const types: GraphQLTypeInfo[] = [
          {
            name: "Post",
            kind: "Object",
            fields: [
              {
                name: "author",
                type: { typeName: "User", nullable: false, list: false },
              },
              {
                name: "category",
                type: { typeName: "Category", nullable: false, list: false },
              },
            ],
            sourceFile: "/path/to/post.ts",
          },
        ];

        const result = validateTypes(types);

        assert.strictEqual(result.valid, false);
        assert.strictEqual(result.diagnostics.length, 2);
      });

      it("should validate list element type references", () => {
        const types: GraphQLTypeInfo[] = [
          {
            name: "Blog",
            kind: "Object",
            fields: [
              {
                name: "posts",
                type: {
                  typeName: "Post",
                  nullable: false,
                  list: true,
                  listItemNullable: false,
                },
              },
            ],
            sourceFile: "/path/to/blog.ts",
          },
        ];

        const result = validateTypes(types);

        assert.strictEqual(result.valid, false);
        assert.ok(result.diagnostics.some((d) => d.message.includes("Post")));
      });
    });
  });
});
