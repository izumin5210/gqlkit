import assert from "node:assert";
import { describe, it } from "node:test";
import type {
  FieldInfo,
  GraphQLFieldType,
  GraphQLTypeInfo,
  GraphQLTypeKind,
} from "./graphql.js";

describe("GraphQL types", () => {
  describe("GraphQLTypeKind", () => {
    it("should support Object kind", () => {
      const kind: GraphQLTypeKind = "Object";
      assert.strictEqual(kind, "Object");
    });

    it("should support Union kind", () => {
      const kind: GraphQLTypeKind = "Union";
      assert.strictEqual(kind, "Union");
    });
  });

  describe("GraphQLFieldType", () => {
    it("should have typeName and nullable properties", () => {
      const fieldType: GraphQLFieldType = {
        typeName: "String",
        nullable: false,
        list: false,
      };

      assert.strictEqual(fieldType.typeName, "String");
      assert.strictEqual(fieldType.nullable, false);
      assert.strictEqual(fieldType.list, false);
    });

    it("should support nullable types", () => {
      const fieldType: GraphQLFieldType = {
        typeName: "Int",
        nullable: true,
        list: false,
      };

      assert.strictEqual(fieldType.nullable, true);
    });

    it("should support list types", () => {
      const fieldType: GraphQLFieldType = {
        typeName: "User",
        nullable: false,
        list: true,
      };

      assert.strictEqual(fieldType.list, true);
    });

    it("should support listItemNullable for list types", () => {
      const fieldType: GraphQLFieldType = {
        typeName: "Post",
        nullable: false,
        list: true,
        listItemNullable: true,
      };

      assert.strictEqual(fieldType.listItemNullable, true);
    });
  });

  describe("FieldInfo", () => {
    it("should have name and type properties", () => {
      const field: FieldInfo = {
        name: "id",
        type: {
          typeName: "String",
          nullable: false,
          list: false,
        },
      };

      assert.strictEqual(field.name, "id");
      assert.strictEqual(field.type.typeName, "String");
    });
  });

  describe("GraphQLTypeInfo", () => {
    it("should represent an Object type with fields", () => {
      const typeInfo: GraphQLTypeInfo = {
        name: "User",
        kind: "Object",
        fields: [
          {
            name: "id",
            type: { typeName: "String", nullable: false, list: false },
          },
          {
            name: "name",
            type: { typeName: "String", nullable: true, list: false },
          },
        ],
        sourceFile: "/path/to/user.ts",
      };

      assert.strictEqual(typeInfo.name, "User");
      assert.strictEqual(typeInfo.kind, "Object");
      assert.strictEqual(typeInfo.fields?.length, 2);
      assert.strictEqual(typeInfo.sourceFile, "/path/to/user.ts");
      assert.strictEqual(typeInfo.unionMembers, undefined);
    });

    it("should represent a Union type with members", () => {
      const typeInfo: GraphQLTypeInfo = {
        name: "SearchResult",
        kind: "Union",
        unionMembers: ["User", "Post"],
        sourceFile: "/path/to/search-result.ts",
      };

      assert.strictEqual(typeInfo.name, "SearchResult");
      assert.strictEqual(typeInfo.kind, "Union");
      assert.deepStrictEqual(typeInfo.unionMembers, ["User", "Post"]);
      assert.strictEqual(typeInfo.fields, undefined);
    });
  });
});
