import assert from "node:assert";
import { describe, it } from "node:test";
import type {
  EnumValueInfo,
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

    it("should support Enum kind", () => {
      const kind: GraphQLTypeKind = "Enum";
      assert.strictEqual(kind, "Enum");
    });

    it("should support InputObject kind", () => {
      const kind: GraphQLTypeKind = "InputObject";
      assert.strictEqual(kind, "InputObject");
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

    it("should represent an Enum type with values", () => {
      const typeInfo: GraphQLTypeInfo = {
        name: "Status",
        kind: "Enum",
        enumValues: [
          { name: "ACTIVE", originalValue: "active" },
          { name: "INACTIVE", originalValue: "inactive" },
        ],
        sourceFile: "/path/to/status.ts",
      };

      assert.strictEqual(typeInfo.name, "Status");
      assert.strictEqual(typeInfo.kind, "Enum");
      assert.strictEqual(typeInfo.enumValues?.length, 2);
      assert.strictEqual(typeInfo.enumValues?.[0]?.name, "ACTIVE");
      assert.strictEqual(typeInfo.enumValues?.[0]?.originalValue, "active");
      assert.strictEqual(typeInfo.fields, undefined);
    });

    it("should represent an InputObject type with fields", () => {
      const typeInfo: GraphQLTypeInfo = {
        name: "CreateUserInput",
        kind: "InputObject",
        fields: [
          {
            name: "name",
            type: { typeName: "String", nullable: false, list: false },
          },
          {
            name: "email",
            type: { typeName: "String", nullable: true, list: false },
          },
        ],
        sourceFile: "/path/to/create-user-input.ts",
      };

      assert.strictEqual(typeInfo.name, "CreateUserInput");
      assert.strictEqual(typeInfo.kind, "InputObject");
      assert.strictEqual(typeInfo.fields?.length, 2);
      assert.strictEqual(typeInfo.sourceFile, "/path/to/create-user-input.ts");
      assert.strictEqual(typeInfo.unionMembers, undefined);
    });
  });

  describe("EnumValueInfo", () => {
    it("should have name and originalValue properties", () => {
      const enumValue: EnumValueInfo = {
        name: "ACTIVE",
        originalValue: "active",
      };

      assert.strictEqual(enumValue.name, "ACTIVE");
      assert.strictEqual(enumValue.originalValue, "active");
    });

    it("should preserve original value for SCREAMING_SNAKE_CASE conversion", () => {
      const enumValue: EnumValueInfo = {
        name: "MY_STATUS",
        originalValue: "myStatus",
      };

      assert.strictEqual(enumValue.name, "MY_STATUS");
      assert.strictEqual(enumValue.originalValue, "myStatus");
    });
  });
});
