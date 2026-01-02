import { describe, expect, it } from "vitest";
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
                type: {
                  typeName: "String",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
            ],
            unionMembers: null,
            enumValues: null,
            sourceFile: "/path/to/user.ts",
            description: null,
            deprecated: null,
          },
          {
            name: "Post",
            kind: "Object",
            fields: [
              {
                name: "author",
                type: {
                  typeName: "User",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
            ],
            unionMembers: null,
            enumValues: null,
            sourceFile: "/path/to/post.ts",
            description: null,
            deprecated: null,
          },
        ];

        const result = validateTypes(types);

        expect(result.valid).toBe(true);
        expect(result.diagnostics.length).toBe(0);
      });

      it("should pass for built-in scalar types", () => {
        const types: GraphQLTypeInfo[] = [
          {
            name: "User",
            kind: "Object",
            fields: [
              {
                name: "id",
                type: {
                  typeName: "String",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
              {
                name: "age",
                type: {
                  typeName: "Int",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
              {
                name: "active",
                type: {
                  typeName: "Boolean",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
            ],
            unionMembers: null,
            enumValues: null,
            sourceFile: "/path/to/user.ts",
            description: null,
            deprecated: null,
          },
        ];

        const result = validateTypes(types);

        expect(result.valid).toBe(true);
        expect(result.diagnostics.length).toBe(0);
      });

      it("should report error for unresolved type reference", () => {
        const types: GraphQLTypeInfo[] = [
          {
            name: "Post",
            kind: "Object",
            fields: [
              {
                name: "author",
                type: {
                  typeName: "User",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
            ],
            unionMembers: null,
            enumValues: null,
            sourceFile: "/path/to/post.ts",
            description: null,
            deprecated: null,
          },
        ];

        const result = validateTypes(types);

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("UNRESOLVED_REFERENCE");
      });

      it("should include field name in error message", () => {
        const types: GraphQLTypeInfo[] = [
          {
            name: "Post",
            kind: "Object",
            fields: [
              {
                name: "author",
                type: {
                  typeName: "User",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
            ],
            unionMembers: null,
            enumValues: null,
            sourceFile: "/path/to/post.ts",
            description: null,
            deprecated: null,
          },
        ];

        const result = validateTypes(types);

        expect(result.diagnostics[0]?.message).toContain("author");
        expect(result.diagnostics[0]?.message).toContain("User");
      });

      it("should include source location in diagnostics", () => {
        const types: GraphQLTypeInfo[] = [
          {
            name: "Post",
            kind: "Object",
            fields: [
              {
                name: "author",
                type: {
                  typeName: "User",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
            ],
            unionMembers: null,
            enumValues: null,
            sourceFile: "/path/to/post.ts",
            description: null,
            deprecated: null,
          },
        ];

        const result = validateTypes(types);

        expect(result.diagnostics[0]?.location).toBeTruthy();
        expect(result.diagnostics[0]!.location!.file).toBe("/path/to/post.ts");
      });

      it("should validate union member references", () => {
        const types: GraphQLTypeInfo[] = [
          {
            name: "User",
            kind: "Object",
            fields: [],
            unionMembers: null,
            enumValues: null,
            sourceFile: "/path/to/user.ts",
            description: null,
            deprecated: null,
          },
          {
            name: "SearchResult",
            kind: "Union",
            fields: null,
            unionMembers: ["User", "Post"],
            enumValues: null,
            sourceFile: "/path/to/search.ts",
            description: null,
            deprecated: null,
          },
        ];

        const result = validateTypes(types);

        expect(result.valid).toBe(false);
        expect(result.diagnostics.some((d) => d.message.includes("Post"))).toBe(
          true,
        );
      });

      it("should collect all unresolved references", () => {
        const types: GraphQLTypeInfo[] = [
          {
            name: "Post",
            kind: "Object",
            fields: [
              {
                name: "author",
                type: {
                  typeName: "User",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
              {
                name: "category",
                type: {
                  typeName: "Category",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
            ],
            unionMembers: null,
            enumValues: null,
            sourceFile: "/path/to/post.ts",
            description: null,
            deprecated: null,
          },
        ];

        const result = validateTypes(types);

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(2);
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
                description: null,
                deprecated: null,
              },
            ],
            unionMembers: null,
            enumValues: null,
            sourceFile: "/path/to/blog.ts",
            description: null,
            deprecated: null,
          },
        ];

        const result = validateTypes(types);

        expect(result.valid).toBe(false);
        expect(result.diagnostics.some((d) => d.message.includes("Post"))).toBe(
          true,
        );
      });
    });
  });
});
