import { Kind, print } from "graphql";
import { describe, expect, it } from "vitest";
import type { GraphQLInputValue } from "../../resolver-extractor/index.js";
import type {
  EnumValueInfo,
  GraphQLFieldType,
} from "../../type-extractor/types/index.js";
import type {
  BaseType,
  ExtensionField,
  InputType,
  IntegratedResult,
  TypeExtension,
} from "../integrator/result-integrator.js";
import {
  buildDocumentNode,
  buildEnumTypeDefinitionNode,
  buildEnumValueDefinitionNode,
  buildFieldDefinitionNode,
  buildFieldTypeNode,
  buildInputObjectTypeDefinitionNode,
  buildInputValueDefinitionNode,
  buildListTypeNode,
  buildNamedTypeNode,
  buildNameNode,
  buildNonNullTypeNode,
  buildObjectTypeDefinitionNode,
  buildObjectTypeExtensionNode,
  buildScalarTypeDefinitionNode,
  buildUnionTypeDefinitionNode,
} from "./ast-builder.js";

describe("ASTBuilder", () => {
  describe("buildNameNode", () => {
    it("should create a NameNode with given value", () => {
      const node = buildNameNode("User");

      expect(node.kind).toBe(Kind.NAME);
      expect(node.value).toBe("User");
    });
  });

  describe("buildNamedTypeNode", () => {
    it("should create a NamedTypeNode with given type name", () => {
      const node = buildNamedTypeNode("String");

      expect(node.kind).toBe(Kind.NAMED_TYPE);
      expect(node.name.kind).toBe(Kind.NAME);
      expect(node.name.value).toBe("String");
    });
  });

  describe("buildListTypeNode", () => {
    it("should wrap inner type in ListType", () => {
      const innerType = buildNamedTypeNode("User");
      const node = buildListTypeNode(innerType);

      expect(node.kind).toBe(Kind.LIST_TYPE);
      expect(node.type.kind).toBe(Kind.NAMED_TYPE);
    });
  });

  describe("buildNonNullTypeNode", () => {
    it("should wrap inner type in NonNullType", () => {
      const innerType = buildNamedTypeNode("String");
      const node = buildNonNullTypeNode(innerType);

      expect(node.kind).toBe(Kind.NON_NULL_TYPE);
      expect(node.type.kind).toBe(Kind.NAMED_TYPE);
    });
  });

  describe("buildInputValueDefinitionNode", () => {
    it("should create InputValueDefinitionNode with name and type", () => {
      const inputValue: GraphQLInputValue = {
        name: "id",
        type: {
          typeName: "ID",
          nullable: false,
          list: false,
          listItemNullable: null,
        },
        description: null,
        deprecated: null,
      };
      const node = buildInputValueDefinitionNode(inputValue);

      expect(node.kind).toBe(Kind.INPUT_VALUE_DEFINITION);
      expect(node.name.value).toBe("id");
      expect(node.type.kind).toBe(Kind.NON_NULL_TYPE);
    });

    it("should handle nullable type", () => {
      const inputValue: GraphQLInputValue = {
        name: "limit",
        type: {
          typeName: "Int",
          nullable: true,
          list: false,
          listItemNullable: null,
        },
        description: null,
        deprecated: null,
      };
      const node = buildInputValueDefinitionNode(inputValue);

      expect(node.type.kind).toBe(Kind.NAMED_TYPE);
    });

    it("should add description when provided", () => {
      const inputValue: GraphQLInputValue = {
        name: "id",
        type: {
          typeName: "ID",
          nullable: false,
          list: false,
          listItemNullable: null,
        },
        description: "The unique identifier",
        deprecated: null,
      };
      const node = buildInputValueDefinitionNode(inputValue);

      expect(node.description).toBeTruthy();
      expect(node.description?.kind).toBe(Kind.STRING);
      expect(node.description?.value).toBe("The unique identifier");
    });

    it("should not add description when not provided", () => {
      const inputValue: GraphQLInputValue = {
        name: "id",
        type: {
          typeName: "ID",
          nullable: false,
          list: false,
          listItemNullable: null,
        },
        description: null,
        deprecated: null,
      };
      const node = buildInputValueDefinitionNode(inputValue);

      expect(node.description).toBe(undefined);
    });

    it("should add @deprecated directive when provided", () => {
      const inputValue: GraphQLInputValue = {
        name: "id",
        type: {
          typeName: "ID",
          nullable: false,
          list: false,
          listItemNullable: null,
        },
        description: null,
        deprecated: { isDeprecated: true, reason: "Use uuid instead" },
      };
      const node = buildInputValueDefinitionNode(inputValue);

      expect(node.directives).toBeTruthy();
      expect(node.directives?.length).toBe(1);
      expect(node.directives?.[0]?.name.value).toBe("deprecated");
      expect(node.directives?.[0]?.arguments?.length).toBe(1);
      expect(node.directives?.[0]?.arguments?.[0]?.name.value).toBe("reason");
    });

    it("should add @deprecated directive without reason", () => {
      const inputValue: GraphQLInputValue = {
        name: "id",
        type: {
          typeName: "ID",
          nullable: false,
          list: false,
          listItemNullable: null,
        },
        description: null,
        deprecated: { isDeprecated: true, reason: null },
      };
      const node = buildInputValueDefinitionNode(inputValue);

      expect(node.directives).toBeTruthy();
      expect(node.directives?.length).toBe(1);
      expect(node.directives?.[0]?.name.value).toBe("deprecated");
      expect(node.directives?.[0]?.arguments?.length ?? 0).toBe(0);
    });

    it("should add both description and deprecated", () => {
      const inputValue: GraphQLInputValue = {
        name: "id",
        type: {
          typeName: "ID",
          nullable: false,
          list: false,
          listItemNullable: null,
        },
        description: "The unique identifier",
        deprecated: { isDeprecated: true, reason: "Use uuid instead" },
      };
      const node = buildInputValueDefinitionNode(inputValue);

      expect(node.description).toBeTruthy();
      expect(node.description?.value).toBe("The unique identifier");
      expect(node.directives).toBeTruthy();
      expect(node.directives?.length).toBe(1);
    });
  });

  describe("buildFieldTypeNode", () => {
    it("should create NonNullType for non-nullable scalar", () => {
      const fieldType: GraphQLFieldType = {
        typeName: "String",
        nullable: false,
        list: false,
        listItemNullable: null,
      };
      const node = buildFieldTypeNode(fieldType);

      expect(node.kind).toBe(Kind.NON_NULL_TYPE);
      if (node.kind === Kind.NON_NULL_TYPE) {
        expect(node.type.kind).toBe(Kind.NAMED_TYPE);
      }
    });

    it("should create NamedType for nullable scalar", () => {
      const fieldType: GraphQLFieldType = {
        typeName: "String",
        nullable: true,
        list: false,
        listItemNullable: null,
      };
      const node = buildFieldTypeNode(fieldType);

      expect(node.kind).toBe(Kind.NAMED_TYPE);
    });

    it("should create non-null list with non-null items [Type!]!", () => {
      const fieldType: GraphQLFieldType = {
        typeName: "User",
        nullable: false,
        list: true,
        listItemNullable: false,
      };
      const node = buildFieldTypeNode(fieldType);

      expect(node.kind).toBe(Kind.NON_NULL_TYPE);
      if (node.kind === Kind.NON_NULL_TYPE) {
        expect(node.type.kind).toBe(Kind.LIST_TYPE);
      }
    });

    it("should create nullable list with non-null items [Type!]", () => {
      const fieldType: GraphQLFieldType = {
        typeName: "User",
        nullable: true,
        list: true,
        listItemNullable: false,
      };
      const node = buildFieldTypeNode(fieldType);

      expect(node.kind).toBe(Kind.LIST_TYPE);
    });

    it("should create non-null list with nullable items [Type]!", () => {
      const fieldType: GraphQLFieldType = {
        typeName: "User",
        nullable: false,
        list: true,
        listItemNullable: true,
      };
      const node = buildFieldTypeNode(fieldType);

      expect(node.kind).toBe(Kind.NON_NULL_TYPE);
      if (node.kind === Kind.NON_NULL_TYPE) {
        const listType = node.type;
        expect(listType.kind).toBe(Kind.LIST_TYPE);
        if (listType.kind === Kind.LIST_TYPE) {
          expect(listType.type.kind).toBe(Kind.NAMED_TYPE);
        }
      }
    });

    it("should create nullable list with nullable items [Type]", () => {
      const fieldType: GraphQLFieldType = {
        typeName: "User",
        nullable: true,
        list: true,
        listItemNullable: true,
      };
      const node = buildFieldTypeNode(fieldType);

      expect(node.kind).toBe(Kind.LIST_TYPE);
      if (node.kind === Kind.LIST_TYPE) {
        expect(node.type.kind).toBe(Kind.NAMED_TYPE);
      }
    });
  });

  describe("buildFieldDefinitionNode", () => {
    it("should create FieldDefinitionNode from ExtensionField", () => {
      const field: ExtensionField = {
        name: "posts",
        type: {
          typeName: "Post",
          nullable: false,
          list: true,
          listItemNullable: false,
        },
        args: null,
        resolverSourceFile: "/path/to/resolver.ts",
        resolverExportName: null,
        description: null,
        deprecated: null,
      };
      const node = buildFieldDefinitionNode(field);

      expect(node.kind).toBe(Kind.FIELD_DEFINITION);
      expect(node.name.value).toBe("posts");
      expect(node.type.kind).toBe(Kind.NON_NULL_TYPE);
    });

    it("should include arguments when present", () => {
      const field: ExtensionField = {
        name: "user",
        type: {
          typeName: "User",
          nullable: true,
          list: false,
          listItemNullable: null,
        },
        args: [
          {
            name: "id",
            type: {
              typeName: "ID",
              nullable: false,
              list: false,
              listItemNullable: null,
            },
            description: null,
            deprecated: null,
          },
        ],
        resolverSourceFile: "/path/to/resolver.ts",
        resolverExportName: null,
        description: null,
        deprecated: null,
      };
      const node = buildFieldDefinitionNode(field);

      expect(node.arguments?.length).toBe(1);
      expect(node.arguments?.[0]?.name.value).toBe("id");
    });

    it("should have empty arguments array when no args", () => {
      const field: ExtensionField = {
        name: "users",
        type: {
          typeName: "User",
          nullable: false,
          list: true,
          listItemNullable: null,
        },
        args: null,
        resolverSourceFile: "/path/to/resolver.ts",
        resolverExportName: null,
        description: null,
        deprecated: null,
      };
      const node = buildFieldDefinitionNode(field);

      expect(node.arguments?.length ?? 0).toBe(0);
    });

    it("should handle multiple arguments with different nullability", () => {
      const field: ExtensionField = {
        name: "searchUsers",
        type: {
          typeName: "User",
          nullable: false,
          list: true,
          listItemNullable: null,
        },
        args: [
          {
            name: "query",
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
            name: "limit",
            type: {
              typeName: "Int",
              nullable: true,
              list: false,
              listItemNullable: null,
            },
            description: null,
            deprecated: null,
          },
        ],
        resolverSourceFile: "/path/to/resolver.ts",
        resolverExportName: null,
        description: null,
        deprecated: null,
      };
      const node = buildFieldDefinitionNode(field);

      expect(node.arguments?.length).toBe(2);

      const queryArg = node.arguments?.[0];
      expect(queryArg?.name.value).toBe("query");
      expect(queryArg?.type.kind).toBe(Kind.NON_NULL_TYPE);

      const limitArg = node.arguments?.[1];
      expect(limitArg?.name.value).toBe("limit");
      expect(limitArg?.type.kind).toBe(Kind.NAMED_TYPE);
    });

    it("should handle list argument types", () => {
      const field: ExtensionField = {
        name: "getUsersByIds",
        type: {
          typeName: "User",
          nullable: false,
          list: true,
          listItemNullable: null,
        },
        args: [
          {
            name: "ids",
            type: {
              typeName: "ID",
              nullable: false,
              list: true,
              listItemNullable: false,
            },
            description: null,
            deprecated: null,
          },
        ],
        resolverSourceFile: "/path/to/resolver.ts",
        resolverExportName: null,
        description: null,
        deprecated: null,
      };
      const node = buildFieldDefinitionNode(field);

      expect(node.arguments?.length).toBe(1);
      const idsArg = node.arguments?.[0];
      expect(idsArg?.type.kind).toBe(Kind.NON_NULL_TYPE);
      if (idsArg?.type.kind === Kind.NON_NULL_TYPE) {
        expect(idsArg.type.type.kind).toBe(Kind.LIST_TYPE);
      }
    });

    it("should handle Input Object type arguments", () => {
      const field: ExtensionField = {
        name: "createUser",
        type: {
          typeName: "User",
          nullable: false,
          list: false,
          listItemNullable: null,
        },
        args: [
          {
            name: "input",
            type: {
              typeName: "CreateUserInput",
              nullable: false,
              list: false,
              listItemNullable: null,
            },
            description: null,
            deprecated: null,
          },
        ],
        resolverSourceFile: "/path/to/resolver.ts",
        resolverExportName: null,
        description: null,
        deprecated: null,
      };
      const node = buildFieldDefinitionNode(field);

      expect(node.arguments?.length).toBe(1);
      const inputArg = node.arguments?.[0];
      expect(inputArg?.name.value).toBe("input");
      expect(inputArg?.type.kind).toBe(Kind.NON_NULL_TYPE);
      if (inputArg?.type.kind === Kind.NON_NULL_TYPE) {
        const namedType = inputArg.type.type;
        if (namedType.kind === Kind.NAMED_TYPE) {
          expect(namedType.name.value).toBe("CreateUserInput");
        }
      }
    });

    it("should handle Enum type arguments", () => {
      const field: ExtensionField = {
        name: "usersByStatus",
        type: {
          typeName: "User",
          nullable: false,
          list: true,
          listItemNullable: null,
        },
        args: [
          {
            name: "status",
            type: {
              typeName: "Status",
              nullable: false,
              list: false,
              listItemNullable: null,
            },
            description: null,
            deprecated: null,
          },
        ],
        resolverSourceFile: "/path/to/resolver.ts",
        resolverExportName: null,
        description: null,
        deprecated: null,
      };
      const node = buildFieldDefinitionNode(field);

      expect(node.arguments?.length).toBe(1);
      const statusArg = node.arguments?.[0];
      expect(statusArg?.name.value).toBe("status");
      expect(statusArg?.type.kind).toBe(Kind.NON_NULL_TYPE);
      if (statusArg?.type.kind === Kind.NON_NULL_TYPE) {
        const namedType = statusArg.type.type;
        if (namedType.kind === Kind.NAMED_TYPE) {
          expect(namedType.name.value).toBe("Status");
        }
      }
    });

    it("should handle all scalar types in arguments", () => {
      const field: ExtensionField = {
        name: "query",
        type: {
          typeName: "Result",
          nullable: false,
          list: false,
          listItemNullable: null,
        },
        args: [
          {
            name: "text",
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
            name: "count",
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
            name: "price",
            type: {
              typeName: "Float",
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
          {
            name: "id",
            type: {
              typeName: "ID",
              nullable: false,
              list: false,
              listItemNullable: null,
            },
            description: null,
            deprecated: null,
          },
        ],
        resolverSourceFile: "/path/to/resolver.ts",
        resolverExportName: null,
        description: null,
        deprecated: null,
      };
      const node = buildFieldDefinitionNode(field);

      expect(node.arguments?.length).toBe(5);
      const argTypeNames = node.arguments?.map((arg) => {
        if (
          arg.type.kind === Kind.NON_NULL_TYPE &&
          arg.type.type.kind === Kind.NAMED_TYPE
        ) {
          return arg.type.type.name.value;
        }
        return null;
      });
      expect(argTypeNames).toEqual(["String", "Int", "Float", "Boolean", "ID"]);
    });
  });

  describe("buildObjectTypeDefinitionNode", () => {
    it("should create ObjectTypeDefinitionNode from BaseType", () => {
      const baseType: BaseType = {
        name: "User",
        kind: "Object",
        fields: [
          {
            name: "id",
            type: {
              typeName: "ID",
              nullable: false,
              list: false,
              listItemNullable: null,
            },
            description: null,
            deprecated: null,
          },
          {
            name: "name",
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
        description: null,
        deprecated: null,
      };
      const node = buildObjectTypeDefinitionNode(baseType);

      expect(node.kind).toBe(Kind.OBJECT_TYPE_DEFINITION);
      expect(node.name.value).toBe("User");
      expect(node.fields?.length).toBe(2);
    });

    it("should create empty fields for Query base type", () => {
      const baseType: BaseType = {
        name: "Query",
        kind: "Object",
        fields: [],
        unionMembers: null,
        enumValues: null,
        description: null,
        deprecated: null,
      };
      const node = buildObjectTypeDefinitionNode(baseType);

      expect(node.kind).toBe(Kind.OBJECT_TYPE_DEFINITION);
      expect(node.name.value).toBe("Query");
      expect(node.fields?.length).toBe(0);
    });
  });

  describe("buildUnionTypeDefinitionNode", () => {
    it("should create UnionTypeDefinitionNode from BaseType with sorted members", () => {
      const baseType: BaseType = {
        name: "SearchResult",
        kind: "Union",
        fields: null,
        unionMembers: ["User", "Post"],
        enumValues: null,
        description: null,
        deprecated: null,
      };
      const node = buildUnionTypeDefinitionNode(baseType);

      expect(node.kind).toBe(Kind.UNION_TYPE_DEFINITION);
      expect(node.name.value).toBe("SearchResult");
      expect(node.types?.length).toBe(2);
      expect(node.types?.[0]?.name.value).toBe("Post");
      expect(node.types?.[1]?.name.value).toBe("User");
    });
  });

  describe("buildEnumValueDefinitionNode", () => {
    it("should create EnumValueDefinitionNode from EnumValueInfo", () => {
      const enumValue: EnumValueInfo = {
        name: "ACTIVE",
        originalValue: "active",
        description: null,
        deprecated: null,
      };
      const node = buildEnumValueDefinitionNode(enumValue);

      expect(node.kind).toBe(Kind.ENUM_VALUE_DEFINITION);
      expect(node.name.value).toBe("ACTIVE");
    });
  });

  describe("buildScalarTypeDefinitionNode", () => {
    it("should create ScalarTypeDefinitionNode with name only", () => {
      const node = buildScalarTypeDefinitionNode("DateTime");

      expect(node.kind).toBe(Kind.SCALAR_TYPE_DEFINITION);
      expect(node.name.value).toBe("DateTime");
      expect(node.description).toBe(undefined);
    });

    it("should create ScalarTypeDefinitionNode with description", () => {
      const node = buildScalarTypeDefinitionNode(
        "DateTime",
        "An ISO-8601 encoded datetime",
      );

      expect(node.kind).toBe(Kind.SCALAR_TYPE_DEFINITION);
      expect(node.name.value).toBe("DateTime");
      expect(node.description).toBeTruthy();
      expect(node.description?.value).toBe("An ISO-8601 encoded datetime");
    });
  });

  describe("buildEnumTypeDefinitionNode", () => {
    it("should create EnumTypeDefinitionNode from BaseType", () => {
      const baseType: BaseType = {
        name: "Status",
        kind: "Enum",
        fields: null,
        unionMembers: null,
        enumValues: [
          {
            name: "ACTIVE",
            originalValue: "active",
            description: null,
            deprecated: null,
          },
          {
            name: "INACTIVE",
            originalValue: "inactive",
            description: null,
            deprecated: null,
          },
        ],
        description: null,
        deprecated: null,
      };
      const node = buildEnumTypeDefinitionNode(baseType);

      expect(node.kind).toBe(Kind.ENUM_TYPE_DEFINITION);
      expect(node.name.value).toBe("Status");
      expect(node.values?.length).toBe(2);
      expect(node.values?.[0]?.name.value).toBe("ACTIVE");
      expect(node.values?.[1]?.name.value).toBe("INACTIVE");
    });

    it("should preserve enum value order", () => {
      const baseType: BaseType = {
        name: "Priority",
        kind: "Enum",
        fields: null,
        unionMembers: null,
        enumValues: [
          {
            name: "LOW",
            originalValue: "low",
            description: null,
            deprecated: null,
          },
          {
            name: "HIGH",
            originalValue: "high",
            description: null,
            deprecated: null,
          },
          {
            name: "MEDIUM",
            originalValue: "medium",
            description: null,
            deprecated: null,
          },
        ],
        description: null,
        deprecated: null,
      };
      const node = buildEnumTypeDefinitionNode(baseType);

      expect(node.values?.[0]?.name.value).toBe("LOW");
      expect(node.values?.[1]?.name.value).toBe("HIGH");
      expect(node.values?.[2]?.name.value).toBe("MEDIUM");
    });
  });

  describe("buildInputObjectTypeDefinitionNode", () => {
    it("should create InputObjectTypeDefinitionNode from InputType", () => {
      const inputType: InputType = {
        name: "CreateUserInput",
        fields: [
          {
            name: "name",
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
            name: "email",
            type: {
              typeName: "String",
              nullable: true,
              list: false,
              listItemNullable: null,
            },
            description: null,
            deprecated: null,
          },
        ],
        sourceFile: "/path/to/input.ts",
        description: null,
      };
      const node = buildInputObjectTypeDefinitionNode(inputType);

      expect(node.kind).toBe(Kind.INPUT_OBJECT_TYPE_DEFINITION);
      expect(node.name.value).toBe("CreateUserInput");
      expect(node.fields?.length).toBe(2);
    });

    it("should sort fields by name alphabetically", () => {
      const inputType: InputType = {
        name: "TestInput",
        fields: [
          {
            name: "zulu",
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
            name: "alpha",
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
            name: "bravo",
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
        sourceFile: "/path/to/input.ts",
        description: null,
      };
      const node = buildInputObjectTypeDefinitionNode(inputType);

      const fieldNames = node.fields?.map((f) => f.name.value);
      expect(fieldNames).toEqual(["alpha", "bravo", "zulu"]);
    });

    it("should handle non-nullable fields correctly", () => {
      const inputType: InputType = {
        name: "RequiredFieldsInput",
        fields: [
          {
            name: "required",
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
        sourceFile: "/path/to/input.ts",
        description: null,
      };
      const node = buildInputObjectTypeDefinitionNode(inputType);

      expect(node.fields?.[0]?.type.kind).toBe(Kind.NON_NULL_TYPE);
    });

    it("should handle nullable fields correctly", () => {
      const inputType: InputType = {
        name: "OptionalFieldsInput",
        fields: [
          {
            name: "optional",
            type: {
              typeName: "String",
              nullable: true,
              list: false,
              listItemNullable: null,
            },
            description: null,
            deprecated: null,
          },
        ],
        sourceFile: "/path/to/input.ts",
        description: null,
      };
      const node = buildInputObjectTypeDefinitionNode(inputType);

      expect(node.fields?.[0]?.type.kind).toBe(Kind.NAMED_TYPE);
    });

    it("should handle list fields correctly", () => {
      const inputType: InputType = {
        name: "ListFieldsInput",
        fields: [
          {
            name: "tags",
            type: {
              typeName: "String",
              nullable: false,
              list: true,
              listItemNullable: false,
            },
            description: null,
            deprecated: null,
          },
        ],
        sourceFile: "/path/to/input.ts",
        description: null,
      };
      const node = buildInputObjectTypeDefinitionNode(inputType);

      expect(node.fields?.[0]?.type.kind).toBe(Kind.NON_NULL_TYPE);
      if (node.fields?.[0]?.type.kind === Kind.NON_NULL_TYPE) {
        expect(node.fields[0].type.type.kind).toBe(Kind.LIST_TYPE);
      }
    });

    it("should handle nested Input type references", () => {
      const inputType: InputType = {
        name: "CreatePostInput",
        fields: [
          {
            name: "title",
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
            name: "author",
            type: {
              typeName: "AuthorInput",
              nullable: false,
              list: false,
              listItemNullable: null,
            },
            description: null,
            deprecated: null,
          },
        ],
        sourceFile: "/path/to/input.ts",
        description: null,
      };
      const node = buildInputObjectTypeDefinitionNode(inputType);

      const authorField = node.fields?.find((f) => f.name.value === "author");
      expect(authorField).toBeTruthy();
      if (authorField?.type.kind === Kind.NON_NULL_TYPE) {
        const namedType = authorField.type.type;
        if (namedType.kind === Kind.NAMED_TYPE) {
          expect(namedType.name.value).toBe("AuthorInput");
        }
      }
    });

    it("should handle Enum type fields in Input Object", () => {
      const inputType: InputType = {
        name: "UpdateUserInput",
        fields: [
          {
            name: "status",
            type: {
              typeName: "Status",
              nullable: false,
              list: false,
              listItemNullable: null,
            },
            description: null,
            deprecated: null,
          },
          {
            name: "role",
            type: {
              typeName: "Role",
              nullable: true,
              list: false,
              listItemNullable: null,
            },
            description: null,
            deprecated: null,
          },
        ],
        sourceFile: "/path/to/input.ts",
        description: null,
      };
      const node = buildInputObjectTypeDefinitionNode(inputType);

      const statusField = node.fields?.find((f) => f.name.value === "status");
      expect(statusField).toBeTruthy();
      expect(statusField?.type.kind).toBe(Kind.NON_NULL_TYPE);
      if (statusField?.type.kind === Kind.NON_NULL_TYPE) {
        const namedType = statusField.type.type;
        if (namedType.kind === Kind.NAMED_TYPE) {
          expect(namedType.name.value).toBe("Status");
        }
      }

      const roleField = node.fields?.find((f) => f.name.value === "role");
      expect(roleField).toBeTruthy();
      expect(roleField?.type.kind).toBe(Kind.NAMED_TYPE);
      if (roleField?.type.kind === Kind.NAMED_TYPE) {
        expect(roleField.type.name.value).toBe("Role");
      }
    });
  });

  describe("buildObjectTypeExtensionNode", () => {
    it("should create ObjectTypeExtensionNode from TypeExtension", () => {
      const typeExtension: TypeExtension = {
        targetTypeName: "User",
        fields: [
          {
            name: "posts",
            type: {
              typeName: "Post",
              nullable: false,
              list: true,
              listItemNullable: null,
            },
            args: null,
            resolverSourceFile: "/path/to/resolver.ts",
            resolverExportName: null,
            description: null,
            deprecated: null,
          },
        ],
      };
      const node = buildObjectTypeExtensionNode(typeExtension);

      expect(node.kind).toBe(Kind.OBJECT_TYPE_EXTENSION);
      expect(node.name.value).toBe("User");
      expect(node.fields?.length).toBe(1);
      expect(node.fields?.[0]?.name.value).toBe("posts");
    });

    it("should handle multiple fields with args and sort by name", () => {
      const typeExtension: TypeExtension = {
        targetTypeName: "Query",
        fields: [
          {
            name: "users",
            type: {
              typeName: "User",
              nullable: false,
              list: true,
              listItemNullable: null,
            },
            args: null,
            resolverSourceFile: "/path/to/resolver.ts",
            resolverExportName: null,
            description: null,
            deprecated: null,
          },
          {
            name: "user",
            type: {
              typeName: "User",
              nullable: true,
              list: false,
              listItemNullable: null,
            },
            args: [
              {
                name: "id",
                type: {
                  typeName: "ID",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
            ],
            resolverSourceFile: "/path/to/resolver.ts",
            resolverExportName: null,
            description: null,
            deprecated: null,
          },
        ],
      };
      const node = buildObjectTypeExtensionNode(typeExtension);

      expect(node.fields?.length).toBe(2);
      expect(node.fields?.[0]?.name.value).toBe("user");
      expect(node.fields?.[0]?.arguments?.length).toBe(1);
      expect(node.fields?.[1]?.name.value).toBe("users");
    });
  });

  describe("buildDocumentNode", () => {
    it("should create DocumentNode from IntegratedResult", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "User",
            kind: "Object",
            fields: [
              {
                name: "id",
                type: {
                  typeName: "ID",
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
            description: null,
            deprecated: null,
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);

      expect(doc.kind).toBe(Kind.DOCUMENT);
      expect(doc.definitions.length).toBe(1);
      expect(doc.definitions[0]?.kind).toBe(Kind.OBJECT_TYPE_DEFINITION);
    });

    it("should include both base types and type extensions", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "Query",
            kind: "Object",
            fields: [],
            unionMembers: null,
            enumValues: null,
            description: null,
            deprecated: null,
          },
          {
            name: "User",
            kind: "Object",
            fields: [
              {
                name: "id",
                type: {
                  typeName: "ID",
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
            description: null,
            deprecated: null,
          },
        ],
        inputTypes: [],
        typeExtensions: [
          {
            targetTypeName: "Query",
            fields: [
              {
                name: "users",
                type: {
                  typeName: "User",
                  nullable: false,
                  list: true,
                  listItemNullable: null,
                },
                args: null,
                resolverSourceFile: "/path/to/resolver.ts",
                resolverExportName: null,
                description: null,
                deprecated: null,
              },
            ],
          },
        ],
        customScalarNames: null,
        hasQuery: true,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);

      expect(doc.definitions.length).toBe(3);
    });

    it("should sort base types by name", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "Zebra",
            kind: "Object",
            fields: [],
            unionMembers: null,
            enumValues: null,
            description: null,
            deprecated: null,
          },
          {
            name: "Apple",
            kind: "Object",
            fields: [],
            unionMembers: null,
            enumValues: null,
            description: null,
            deprecated: null,
          },
          {
            name: "Mango",
            kind: "Object",
            fields: [],
            unionMembers: null,
            enumValues: null,
            description: null,
            deprecated: null,
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const names = doc.definitions.map((d) => {
        if (d.kind === Kind.OBJECT_TYPE_DEFINITION) {
          return d.name.value;
        }
        return "";
      });

      expect(names).toEqual(["Apple", "Mango", "Zebra"]);
    });

    it("should sort type extensions by name", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "Apple",
            kind: "Object",
            fields: [],
            unionMembers: null,
            enumValues: null,
            description: null,
            deprecated: null,
          },
          {
            name: "Zebra",
            kind: "Object",
            fields: [],
            unionMembers: null,
            enumValues: null,
            description: null,
            deprecated: null,
          },
        ],
        inputTypes: [],
        typeExtensions: [
          {
            targetTypeName: "Zebra",
            fields: [
              {
                name: "field",
                type: {
                  typeName: "String",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                args: null,
                resolverSourceFile: "/a.ts",
                resolverExportName: null,
                description: null,
                deprecated: null,
              },
            ],
          },
          {
            targetTypeName: "Apple",
            fields: [
              {
                name: "field",
                type: {
                  typeName: "String",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                args: null,
                resolverSourceFile: "/b.ts",
                resolverExportName: null,
                description: null,
                deprecated: null,
              },
            ],
          },
        ],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const extensions = doc.definitions.filter(
        (d) => d.kind === Kind.OBJECT_TYPE_EXTENSION,
      );
      const names = extensions.map((d) => {
        if (d.kind === Kind.OBJECT_TYPE_EXTENSION) {
          return d.name.value;
        }
        return "";
      });

      expect(names).toEqual(["Apple", "Zebra"]);
    });

    it("should sort fields within types by name", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "User",
            kind: "Object",
            fields: [
              {
                name: "zulu",
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
                name: "alpha",
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
            description: null,
            deprecated: null,
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const typeDef = doc.definitions[0];
      if (typeDef?.kind === Kind.OBJECT_TYPE_DEFINITION) {
        const fieldNames = typeDef.fields?.map((f) => f.name.value);
        expect(fieldNames).toEqual(["alpha", "zulu"]);
      } else {
        expect.fail("Expected ObjectTypeDefinitionNode");
      }
    });

    it("should handle Union types", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "SearchResult",
            kind: "Union",
            fields: null,
            unionMembers: ["User", "Post"],
            enumValues: null,
            description: null,
            deprecated: null,
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);

      expect(doc.definitions.length).toBe(1);
      expect(doc.definitions[0]?.kind).toBe(Kind.UNION_TYPE_DEFINITION);
    });

    it("should handle Enum types", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "Status",
            kind: "Enum",
            fields: null,
            unionMembers: null,
            enumValues: [
              {
                name: "ACTIVE",
                originalValue: "active",
                description: null,
                deprecated: null,
              },
              {
                name: "INACTIVE",
                originalValue: "inactive",
                description: null,
                deprecated: null,
              },
            ],
            description: null,
            deprecated: null,
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);

      expect(doc.definitions.length).toBe(1);
      expect(doc.definitions[0]?.kind).toBe(Kind.ENUM_TYPE_DEFINITION);
    });

    it("should produce valid GraphQL SDL with enum", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "Status",
            kind: "Enum",
            fields: null,
            unionMembers: null,
            enumValues: [
              {
                name: "ACTIVE",
                originalValue: "active",
                description: null,
                deprecated: null,
              },
              {
                name: "PENDING",
                originalValue: "pending",
                description: null,
                deprecated: null,
              },
            ],
            description: null,
            deprecated: null,
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes("enum Status")).toBeTruthy();
      expect(sdl.includes("ACTIVE")).toBeTruthy();
      expect(sdl.includes("PENDING")).toBeTruthy();
    });

    it("should produce valid GraphQL SDL", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "Query",
            kind: "Object",
            fields: [],
            unionMembers: null,
            enumValues: null,
            description: null,
            deprecated: null,
          },
          {
            name: "User",
            kind: "Object",
            fields: [
              {
                name: "id",
                type: {
                  typeName: "ID",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
              {
                name: "name",
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
            description: null,
            deprecated: null,
          },
        ],
        inputTypes: [],
        typeExtensions: [
          {
            targetTypeName: "Query",
            fields: [
              {
                name: "users",
                type: {
                  typeName: "User",
                  nullable: false,
                  list: true,
                  listItemNullable: false,
                },
                args: null,
                resolverSourceFile: "/path/to/resolver.ts",
                resolverExportName: null,
                description: null,
                deprecated: null,
              },
            ],
          },
        ],
        customScalarNames: null,
        hasQuery: true,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes("type Query")).toBeTruthy();
      expect(sdl.includes("type User")).toBeTruthy();
      expect(sdl.includes("extend type Query")).toBeTruthy();
      expect(sdl.includes("users: [User!]!")).toBeTruthy();
    });

    it("should include Input Object types in DocumentNode", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "User",
            kind: "Object",
            fields: [
              {
                name: "id",
                type: {
                  typeName: "ID",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
              {
                name: "name",
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
            description: null,
            deprecated: null,
          },
        ],
        inputTypes: [
          {
            name: "CreateUserInput",
            fields: [
              {
                name: "name",
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
                name: "email",
                type: {
                  typeName: "String",
                  nullable: true,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
            ],
            sourceFile: "/path/to/input.ts",
            description: null,
          },
        ],
        typeExtensions: [],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes("input CreateUserInput")).toBeTruthy();
      expect(sdl.includes("name: String!")).toBeTruthy();
      expect(sdl.includes("email: String")).toBeTruthy();
    });

    it("should sort Input Object types alphabetically", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [],
        inputTypes: [
          {
            name: "ZInput",
            fields: [
              {
                name: "value",
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
            sourceFile: "/path/to/z.ts",
            description: null,
          },
          {
            name: "AInput",
            fields: [
              {
                name: "value",
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
            sourceFile: "/path/to/a.ts",
            description: null,
          },
        ],
        typeExtensions: [],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const inputTypes = doc.definitions.filter(
        (d) => d.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION,
      );

      expect(inputTypes.length).toBe(2);
      if (
        inputTypes[0]?.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION &&
        inputTypes[1]?.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION
      ) {
        expect(inputTypes[0].name.value).toBe("AInput");
        expect(inputTypes[1].name.value).toBe("ZInput");
      }
    });

    it("should produce complete schema with Input types and arguments", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "Mutation",
            kind: "Object",
            fields: [],
            unionMembers: null,
            enumValues: null,
            description: null,
            deprecated: null,
          },
          {
            name: "User",
            kind: "Object",
            fields: [
              {
                name: "id",
                type: {
                  typeName: "ID",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
              {
                name: "name",
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
            description: null,
            deprecated: null,
          },
        ],
        inputTypes: [
          {
            name: "CreateUserInput",
            fields: [
              {
                name: "name",
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
            sourceFile: "/path/to/input.ts",
            description: null,
          },
        ],
        typeExtensions: [
          {
            targetTypeName: "Mutation",
            fields: [
              {
                name: "createUser",
                type: {
                  typeName: "User",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                args: [
                  {
                    name: "input",
                    type: {
                      typeName: "CreateUserInput",
                      nullable: false,
                      list: false,
                      listItemNullable: null,
                    },
                    description: null,
                    deprecated: null,
                  },
                ],
                resolverSourceFile: "/path/to/mutation.ts",
                resolverExportName: null,
                description: null,
                deprecated: null,
              },
            ],
          },
        ],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: true,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes("input CreateUserInput")).toBeTruthy();
      expect(sdl.includes("type Mutation")).toBeTruthy();
      expect(sdl.includes("type User")).toBeTruthy();
      expect(sdl.includes("extend type Mutation")).toBeTruthy();
      expect(sdl.includes("createUser(input: CreateUserInput!): User!"));
    });
  });

  describe("description and deprecated support", () => {
    it("should add description to type definition", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "User",
            kind: "Object",
            description: "A user in the system",
            fields: [
              {
                name: "id",
                type: {
                  typeName: "ID",
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
            deprecated: null,
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes('"A user in the system"')).toBeTruthy();
      expect(sdl.includes("type User")).toBeTruthy();
    });

    it("should add description to field definition", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "User",
            kind: "Object",
            fields: [
              {
                name: "id",
                type: {
                  typeName: "ID",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: "The unique identifier",
                deprecated: null,
              },
            ],
            unionMembers: null,
            enumValues: null,
            description: null,
            deprecated: null,
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes('"The unique identifier"')).toBeTruthy();
    });

    it("should add @deprecated directive to type definition", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "User",
            kind: "Object",
            deprecated: { isDeprecated: true, reason: "Use Member instead" },
            fields: [],
            unionMembers: null,
            enumValues: null,
            description: null,
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes('@deprecated(reason: "Use Member instead")'));
    });

    it("should add @deprecated directive without reason", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "User",
            kind: "Object",
            deprecated: { isDeprecated: true, reason: null },
            fields: [],
            unionMembers: null,
            enumValues: null,
            description: null,
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes("@deprecated")).toBeTruthy();
    });

    it("should add @deprecated directive to field definition", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "User",
            kind: "Object",
            fields: [
              {
                name: "id",
                type: {
                  typeName: "ID",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: { isDeprecated: true, reason: "Use uuid instead" },
              },
            ],
            unionMembers: null,
            enumValues: null,
            description: null,
            deprecated: null,
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes('@deprecated(reason: "Use uuid instead")'));
    });

    it("should add description to enum type", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "Status",
            kind: "Enum",
            description: "The status of an item",
            enumValues: [
              {
                name: "ACTIVE",
                originalValue: "active",
                description: null,
                deprecated: null,
              },
            ],
            fields: null,
            unionMembers: null,
            deprecated: null,
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes('"The status of an item"')).toBeTruthy();
    });

    it("should add description to enum value", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "Status",
            kind: "Enum",
            enumValues: [
              {
                name: "ACTIVE",
                originalValue: "active",
                description: "The item is active",
                deprecated: null,
              },
            ],
            fields: null,
            unionMembers: null,
            description: null,
            deprecated: null,
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes('"The item is active"')).toBeTruthy();
    });

    it("should add @deprecated directive to enum value", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "Status",
            kind: "Enum",
            enumValues: [
              {
                name: "INACTIVE",
                originalValue: "inactive",
                description: null,
                deprecated: { isDeprecated: true, reason: "Use SUSPENDED" },
              },
            ],
            fields: null,
            unionMembers: null,
            description: null,
            deprecated: null,
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes('@deprecated(reason: "Use SUSPENDED")'));
    });

    it("should add description to extension field", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "Query",
            kind: "Object",
            fields: [],
            unionMembers: null,
            enumValues: null,
            description: null,
            deprecated: null,
          },
        ],
        inputTypes: [],
        typeExtensions: [
          {
            targetTypeName: "Query",
            fields: [
              {
                name: "me",
                type: {
                  typeName: "User",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: "Get the current user",
                args: null,
                resolverSourceFile: "/path/to/resolver.ts",
                resolverExportName: null,
                deprecated: null,
              },
            ],
          },
        ],
        customScalarNames: null,
        hasQuery: true,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes('"Get the current user"')).toBeTruthy();
    });

    it("should add @deprecated directive to extension field", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "Query",
            kind: "Object",
            fields: [],
            unionMembers: null,
            enumValues: null,
            description: null,
            deprecated: null,
          },
        ],
        inputTypes: [],
        typeExtensions: [
          {
            targetTypeName: "Query",
            fields: [
              {
                name: "me",
                type: {
                  typeName: "User",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: { isDeprecated: true, reason: "Use currentUser" },
                args: null,
                resolverSourceFile: "/path/to/resolver.ts",
                resolverExportName: null,
              },
            ],
          },
        ],
        customScalarNames: null,
        hasQuery: true,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes('@deprecated(reason: "Use currentUser")'));
    });

    it("should add description to input type", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [],
        inputTypes: [
          {
            name: "CreateUserInput",
            description: "Input for creating a user",
            fields: [
              {
                name: "name",
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
            sourceFile: "/path/to/input.ts",
          },
        ],
        typeExtensions: [],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes('"Input for creating a user"')).toBeTruthy();
    });
  });

  describe("custom scalar support", () => {
    it("should include custom scalar definitions in DocumentNode", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "User",
            kind: "Object",
            fields: [
              {
                name: "createdAt",
                type: {
                  typeName: "DateTime",
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
            description: null,
            deprecated: null,
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: ["DateTime"],
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes("scalar DateTime")).toBeTruthy();
      expect(sdl.includes("type User")).toBeTruthy();
    });

    it("should sort custom scalar definitions alphabetically", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: ["UUID", "DateTime", "URL"],
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const scalarDefs = doc.definitions.filter(
        (d) => d.kind === Kind.SCALAR_TYPE_DEFINITION,
      );

      expect(scalarDefs.length).toBe(3);
      if (
        scalarDefs[0]?.kind === Kind.SCALAR_TYPE_DEFINITION &&
        scalarDefs[1]?.kind === Kind.SCALAR_TYPE_DEFINITION &&
        scalarDefs[2]?.kind === Kind.SCALAR_TYPE_DEFINITION
      ) {
        expect(scalarDefs[0].name.value).toBe("DateTime");
        expect(scalarDefs[1].name.value).toBe("URL");
        expect(scalarDefs[2].name.value).toBe("UUID");
      }
    });

    it("should place custom scalar definitions before other types", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "User",
            kind: "Object",
            fields: [
              {
                name: "id",
                type: {
                  typeName: "ID",
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
            description: null,
            deprecated: null,
            sourceFile: "/project/src/types/user.ts",
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: ["DateTime"],
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);

      expect(doc.definitions[0]?.kind).toBe(Kind.SCALAR_TYPE_DEFINITION);
      expect(doc.definitions[1]?.kind).toBe(Kind.OBJECT_TYPE_DEFINITION);
    });
  });

  describe("source file location in description", () => {
    it("should add source file location to type description when sourceRoot is provided", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "User",
            kind: "Object",
            fields: [
              {
                name: "id",
                type: {
                  typeName: "ID",
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
            description: "A user in the system",
            deprecated: null,
            sourceFile: "/project/src/gql/types/user.ts",
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult, {
        sourceRoot: "/project",
      });
      const sdl = print(doc);

      expect(sdl).toContain("A user in the system");
      expect(sdl).toContain("Defined in: src/gql/types/user.ts");
    });

    it("should add source file location even when description is null", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "User",
            kind: "Object",
            fields: [
              {
                name: "id",
                type: {
                  typeName: "ID",
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
            description: null,
            deprecated: null,
            sourceFile: "/project/src/gql/types/user.ts",
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult, {
        sourceRoot: "/project",
      });
      const sdl = print(doc);

      expect(sdl).toContain("Defined in: src/gql/types/user.ts");
    });

    it("should add source file location to extension field description", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "Query",
            kind: "Object",
            fields: [],
            unionMembers: null,
            enumValues: null,
            description: null,
            deprecated: null,
            sourceFile: null,
          },
        ],
        inputTypes: [],
        typeExtensions: [
          {
            targetTypeName: "Query",
            fields: [
              {
                name: "me",
                type: {
                  typeName: "User",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                args: null,
                resolverSourceFile: "/project/src/gql/resolvers/me.ts",
                resolverExportName: "me",
                description: "Get the current user",
                deprecated: null,
              },
            ],
          },
        ],
        customScalarNames: null,
        hasQuery: true,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult, {
        sourceRoot: "/project",
      });
      const sdl = print(doc);

      expect(sdl).toContain("Get the current user");
      expect(sdl).toContain("Defined in: src/gql/resolvers/me.ts");
    });

    it("should add source file location to input type description", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [],
        inputTypes: [
          {
            name: "CreateUserInput",
            fields: [
              {
                name: "name",
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
            sourceFile: "/project/src/gql/types/create-user-input.ts",
            description: "Input for creating a user",
          },
        ],
        typeExtensions: [],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult, {
        sourceRoot: "/project",
      });
      const sdl = print(doc);

      expect(sdl).toContain("Input for creating a user");
      expect(sdl).toContain("Defined in: src/gql/types/create-user-input.ts");
    });

    it("should not add source file location when sourceRoot is not provided", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "User",
            kind: "Object",
            fields: [],
            unionMembers: null,
            enumValues: null,
            description: "A user in the system",
            deprecated: null,
            sourceFile: "/project/src/gql/types/user.ts",
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl).toContain("A user in the system");
      expect(sdl).not.toContain("Defined in:");
    });

    it("should add source file location to union type description", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "SearchResult",
            kind: "Union",
            fields: null,
            unionMembers: ["User", "Post"],
            enumValues: null,
            description: "Search result union",
            deprecated: null,
            sourceFile: "/project/src/gql/types/search-result.ts",
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult, {
        sourceRoot: "/project",
      });
      const sdl = print(doc);

      expect(sdl).toContain("Search result union");
      expect(sdl).toContain("Defined in: src/gql/types/search-result.ts");
    });

    it("should add source file location to enum type description", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "Status",
            kind: "Enum",
            fields: null,
            unionMembers: null,
            enumValues: [
              {
                name: "ACTIVE",
                originalValue: "active",
                description: null,
                deprecated: null,
              },
            ],
            description: "Status enum",
            deprecated: null,
            sourceFile: "/project/src/gql/types/status.ts",
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult, {
        sourceRoot: "/project",
      });
      const sdl = print(doc);

      expect(sdl).toContain("Status enum");
      expect(sdl).toContain("Defined in: src/gql/types/status.ts");
    });
  });
});
