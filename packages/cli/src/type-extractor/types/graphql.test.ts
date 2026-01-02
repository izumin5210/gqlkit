import { describe, expect, it } from "vitest";
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
      expect(kind).toBe("Object");
    });

    it("should support Union kind", () => {
      const kind: GraphQLTypeKind = "Union";
      expect(kind).toBe("Union");
    });

    it("should support Enum kind", () => {
      const kind: GraphQLTypeKind = "Enum";
      expect(kind).toBe("Enum");
    });

    it("should support InputObject kind", () => {
      const kind: GraphQLTypeKind = "InputObject";
      expect(kind).toBe("InputObject");
    });
  });

  describe("GraphQLFieldType", () => {
    it("should have typeName and nullable properties", () => {
      const fieldType: GraphQLFieldType = {
        typeName: "String",
        nullable: false,
        list: false,
      };

      expect(fieldType.typeName).toBe("String");
      expect(fieldType.nullable).toBe(false);
      expect(fieldType.list).toBe(false);
    });

    it("should support nullable types", () => {
      const fieldType: GraphQLFieldType = {
        typeName: "Int",
        nullable: true,
        list: false,
      };

      expect(fieldType.nullable).toBe(true);
    });

    it("should support list types", () => {
      const fieldType: GraphQLFieldType = {
        typeName: "User",
        nullable: false,
        list: true,
      };

      expect(fieldType.list).toBe(true);
    });

    it("should support listItemNullable for list types", () => {
      const fieldType: GraphQLFieldType = {
        typeName: "Post",
        nullable: false,
        list: true,
        listItemNullable: true,
      };

      expect(fieldType.listItemNullable).toBe(true);
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

      expect(field.name).toBe("id");
      expect(field.type.typeName).toBe("String");
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

      expect(typeInfo.name).toBe("User");
      expect(typeInfo.kind).toBe("Object");
      expect(typeInfo.fields?.length).toBe(2);
      expect(typeInfo.sourceFile).toBe("/path/to/user.ts");
      expect(typeInfo.unionMembers).toBe(undefined);
    });

    it("should represent a Union type with members", () => {
      const typeInfo: GraphQLTypeInfo = {
        name: "SearchResult",
        kind: "Union",
        unionMembers: ["User", "Post"],
        sourceFile: "/path/to/search-result.ts",
      };

      expect(typeInfo.name).toBe("SearchResult");
      expect(typeInfo.kind).toBe("Union");
      expect(typeInfo.unionMembers).toEqual(["User", "Post"]);
      expect(typeInfo.fields).toBe(undefined);
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

      expect(typeInfo.name).toBe("Status");
      expect(typeInfo.kind).toBe("Enum");
      expect(typeInfo.enumValues?.length).toBe(2);
      expect(typeInfo.enumValues?.[0]?.name).toBe("ACTIVE");
      expect(typeInfo.enumValues?.[0]?.originalValue).toBe("active");
      expect(typeInfo.fields).toBe(undefined);
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

      expect(typeInfo.name).toBe("CreateUserInput");
      expect(typeInfo.kind).toBe("InputObject");
      expect(typeInfo.fields?.length).toBe(2);
      expect(typeInfo.sourceFile).toBe("/path/to/create-user-input.ts");
      expect(typeInfo.unionMembers).toBe(undefined);
    });
  });

  describe("EnumValueInfo", () => {
    it("should have name and originalValue properties", () => {
      const enumValue: EnumValueInfo = {
        name: "ACTIVE",
        originalValue: "active",
      };

      expect(enumValue.name).toBe("ACTIVE");
      expect(enumValue.originalValue).toBe("active");
    });

    it("should preserve original value for SCREAMING_SNAKE_CASE conversion", () => {
      const enumValue: EnumValueInfo = {
        name: "MY_STATUS",
        originalValue: "myStatus",
      };

      expect(enumValue.name).toBe("MY_STATUS");
      expect(enumValue.originalValue).toBe("myStatus");
    });
  });
});
