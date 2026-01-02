import { describe, expect, it } from "vitest";
import { Kind, print } from "graphql";
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

      expect(node.kind, Kind.NAME);
      expect(node.value, "User");
    });
  });

  describe("buildNamedTypeNode", () => {
    it("should create a NamedTypeNode with given type name", () => {
      const node = buildNamedTypeNode("String");

      expect(node.kind, Kind.NAMED_TYPE);
      expect(node.name.kind, Kind.NAME);
      expect(node.name.value, "String");
    });
  });

  describe("buildListTypeNode", () => {
    it("should wrap inner type in ListType", () => {
      const innerType = buildNamedTypeNode("User");
      const node = buildListTypeNode(innerType);

      expect(node.kind, Kind.LIST_TYPE);
      expect(node.type.kind, Kind.NAMED_TYPE);
    });
  });

  describe("buildNonNullTypeNode", () => {
    it("should wrap inner type in NonNullType", () => {
      const innerType = buildNamedTypeNode("String");
      const node = buildNonNullTypeNode(innerType);

      expect(node.kind, Kind.NON_NULL_TYPE);
      expect(node.type.kind, Kind.NAMED_TYPE);
    });
  });

  describe("buildInputValueDefinitionNode", () => {
    it("should create InputValueDefinitionNode with name and type", () => {
      const inputValue: GraphQLInputValue = {
        name: "id",
        type: { typeName: "ID", nullable: false, list: false },
      };
      const node = buildInputValueDefinitionNode(inputValue);

      expect(node.kind, Kind.INPUT_VALUE_DEFINITION);
      expect(node.name.value, "id");
      expect(node.type.kind, Kind.NON_NULL_TYPE);
    });

    it("should handle nullable type", () => {
      const inputValue: GraphQLInputValue = {
        name: "limit",
        type: { typeName: "Int", nullable: true, list: false },
      };
      const node = buildInputValueDefinitionNode(inputValue);

      expect(node.type.kind, Kind.NAMED_TYPE);
    });

    it("should add description when provided", () => {
      const inputValue: GraphQLInputValue = {
        name: "id",
        type: { typeName: "ID", nullable: false, list: false },
        description: "The unique identifier",
      };
      const node = buildInputValueDefinitionNode(inputValue);

      expect(node.description);
      expect(node.description.kind, Kind.STRING);
      expect(node.description.value, "The unique identifier");
    });

    it("should not add description when not provided", () => {
      const inputValue: GraphQLInputValue = {
        name: "id",
        type: { typeName: "ID", nullable: false, list: false },
      };
      const node = buildInputValueDefinitionNode(inputValue);

      expect(node.description, undefined);
    });

    it("should add @deprecated directive when provided", () => {
      const inputValue: GraphQLInputValue = {
        name: "id",
        type: { typeName: "ID", nullable: false, list: false },
        deprecated: { isDeprecated: true, reason: "Use uuid instead" },
      };
      const node = buildInputValueDefinitionNode(inputValue);

      expect(node.directives);
      expect(node.directives.length, 1);
      expect(node.directives[0]?.name.value, "deprecated");
      expect(node.directives[0]?.arguments?.length, 1);
      expect(
        node.directives[0]?.arguments?.[0]?.name.value,
        "reason",
      );
    });

    it("should add @deprecated directive without reason", () => {
      const inputValue: GraphQLInputValue = {
        name: "id",
        type: { typeName: "ID", nullable: false, list: false },
        deprecated: { isDeprecated: true },
      };
      const node = buildInputValueDefinitionNode(inputValue);

      expect(node.directives);
      expect(node.directives.length, 1);
      expect(node.directives[0]?.name.value, "deprecated");
      expect(node.directives[0]?.arguments?.length ?? 0, 0);
    });

    it("should add both description and deprecated", () => {
      const inputValue: GraphQLInputValue = {
        name: "id",
        type: { typeName: "ID", nullable: false, list: false },
        description: "The unique identifier",
        deprecated: { isDeprecated: true, reason: "Use uuid instead" },
      };
      const node = buildInputValueDefinitionNode(inputValue);

      expect(node.description);
      expect(node.description.value, "The unique identifier");
      expect(node.directives);
      expect(node.directives.length, 1);
    });
  });

  describe("buildFieldTypeNode", () => {
    it("should create NonNullType for non-nullable scalar", () => {
      const fieldType: GraphQLFieldType = {
        typeName: "String",
        nullable: false,
        list: false,
      };
      const node = buildFieldTypeNode(fieldType);

      expect(node.kind, Kind.NON_NULL_TYPE);
      if (node.kind === Kind.NON_NULL_TYPE) {
        expect(node.type.kind, Kind.NAMED_TYPE);
      }
    });

    it("should create NamedType for nullable scalar", () => {
      const fieldType: GraphQLFieldType = {
        typeName: "String",
        nullable: true,
        list: false,
      };
      const node = buildFieldTypeNode(fieldType);

      expect(node.kind, Kind.NAMED_TYPE);
    });

    it("should create non-null list with non-null items [Type!]!", () => {
      const fieldType: GraphQLFieldType = {
        typeName: "User",
        nullable: false,
        list: true,
        listItemNullable: false,
      };
      const node = buildFieldTypeNode(fieldType);

      expect(node.kind, Kind.NON_NULL_TYPE);
      if (node.kind === Kind.NON_NULL_TYPE) {
        expect(node.type.kind, Kind.LIST_TYPE);
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

      expect(node.kind, Kind.LIST_TYPE);
    });

    it("should create non-null list with nullable items [Type]!", () => {
      const fieldType: GraphQLFieldType = {
        typeName: "User",
        nullable: false,
        list: true,
        listItemNullable: true,
      };
      const node = buildFieldTypeNode(fieldType);

      expect(node.kind, Kind.NON_NULL_TYPE);
      if (node.kind === Kind.NON_NULL_TYPE) {
        const listType = node.type;
        expect(listType.kind, Kind.LIST_TYPE);
        if (listType.kind === Kind.LIST_TYPE) {
          expect(listType.type.kind, Kind.NAMED_TYPE);
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

      expect(node.kind, Kind.LIST_TYPE);
      if (node.kind === Kind.LIST_TYPE) {
        expect(node.type.kind, Kind.NAMED_TYPE);
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
        resolverSourceFile: "/path/to/resolver.ts",
      };
      const node = buildFieldDefinitionNode(field);

      expect(node.kind, Kind.FIELD_DEFINITION);
      expect(node.name.value, "posts");
      expect(node.type.kind, Kind.NON_NULL_TYPE);
    });

    it("should include arguments when present", () => {
      const field: ExtensionField = {
        name: "user",
        type: { typeName: "User", nullable: true, list: false },
        args: [
          {
            name: "id",
            type: { typeName: "ID", nullable: false, list: false },
          },
        ],
        resolverSourceFile: "/path/to/resolver.ts",
      };
      const node = buildFieldDefinitionNode(field);

      expect(node.arguments?.length, 1);
      expect(node.arguments?.[0]?.name.value, "id");
    });

    it("should have empty arguments array when no args", () => {
      const field: ExtensionField = {
        name: "users",
        type: { typeName: "User", nullable: false, list: true },
        resolverSourceFile: "/path/to/resolver.ts",
      };
      const node = buildFieldDefinitionNode(field);

      expect(node.arguments?.length ?? 0, 0);
    });

    it("should handle multiple arguments with different nullability", () => {
      const field: ExtensionField = {
        name: "searchUsers",
        type: { typeName: "User", nullable: false, list: true },
        args: [
          {
            name: "query",
            type: { typeName: "String", nullable: false, list: false },
          },
          {
            name: "limit",
            type: { typeName: "Int", nullable: true, list: false },
          },
        ],
        resolverSourceFile: "/path/to/resolver.ts",
      };
      const node = buildFieldDefinitionNode(field);

      expect(node.arguments?.length, 2);

      const queryArg = node.arguments?.[0];
      expect(queryArg?.name.value, "query");
      expect(queryArg?.type.kind, Kind.NON_NULL_TYPE);

      const limitArg = node.arguments?.[1];
      expect(limitArg?.name.value, "limit");
      expect(limitArg?.type.kind, Kind.NAMED_TYPE);
    });

    it("should handle list argument types", () => {
      const field: ExtensionField = {
        name: "getUsersByIds",
        type: { typeName: "User", nullable: false, list: true },
        args: [
          {
            name: "ids",
            type: {
              typeName: "ID",
              nullable: false,
              list: true,
              listItemNullable: false,
            },
          },
        ],
        resolverSourceFile: "/path/to/resolver.ts",
      };
      const node = buildFieldDefinitionNode(field);

      expect(node.arguments?.length, 1);
      const idsArg = node.arguments?.[0];
      expect(idsArg?.type.kind, Kind.NON_NULL_TYPE);
      if (idsArg?.type.kind === Kind.NON_NULL_TYPE) {
        expect(idsArg.type.type.kind, Kind.LIST_TYPE);
      }
    });

    it("should handle Input Object type arguments", () => {
      const field: ExtensionField = {
        name: "createUser",
        type: { typeName: "User", nullable: false, list: false },
        args: [
          {
            name: "input",
            type: { typeName: "CreateUserInput", nullable: false, list: false },
          },
        ],
        resolverSourceFile: "/path/to/resolver.ts",
      };
      const node = buildFieldDefinitionNode(field);

      expect(node.arguments?.length, 1);
      const inputArg = node.arguments?.[0];
      expect(inputArg?.name.value, "input");
      expect(inputArg?.type.kind, Kind.NON_NULL_TYPE);
      if (inputArg?.type.kind === Kind.NON_NULL_TYPE) {
        const namedType = inputArg.type.type;
        if (namedType.kind === Kind.NAMED_TYPE) {
          expect(namedType.name.value, "CreateUserInput");
        }
      }
    });

    it("should handle Enum type arguments", () => {
      const field: ExtensionField = {
        name: "usersByStatus",
        type: { typeName: "User", nullable: false, list: true },
        args: [
          {
            name: "status",
            type: { typeName: "Status", nullable: false, list: false },
          },
        ],
        resolverSourceFile: "/path/to/resolver.ts",
      };
      const node = buildFieldDefinitionNode(field);

      expect(node.arguments?.length, 1);
      const statusArg = node.arguments?.[0];
      expect(statusArg?.name.value, "status");
      expect(statusArg?.type.kind, Kind.NON_NULL_TYPE);
      if (statusArg?.type.kind === Kind.NON_NULL_TYPE) {
        const namedType = statusArg.type.type;
        if (namedType.kind === Kind.NAMED_TYPE) {
          expect(namedType.name.value, "Status");
        }
      }
    });

    it("should handle all scalar types in arguments", () => {
      const field: ExtensionField = {
        name: "query",
        type: { typeName: "Result", nullable: false, list: false },
        args: [
          {
            name: "text",
            type: { typeName: "String", nullable: false, list: false },
          },
          {
            name: "count",
            type: { typeName: "Int", nullable: false, list: false },
          },
          {
            name: "price",
            type: { typeName: "Float", nullable: false, list: false },
          },
          {
            name: "active",
            type: { typeName: "Boolean", nullable: false, list: false },
          },
          {
            name: "id",
            type: { typeName: "ID", nullable: false, list: false },
          },
        ],
        resolverSourceFile: "/path/to/resolver.ts",
      };
      const node = buildFieldDefinitionNode(field);

      expect(node.arguments?.length, 5);
      const argTypeNames = node.arguments?.map((arg) => {
        if (
          arg.type.kind === Kind.NON_NULL_TYPE &&
          arg.type.type.kind === Kind.NAMED_TYPE
        ) {
          return arg.type.type.name.value;
        }
        return null;
      });
      expect(argTypeNames, [
        "String",
        "Int",
        "Float",
        "Boolean",
        "ID",
      ]);
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
            type: { typeName: "ID", nullable: false, list: false },
          },
          {
            name: "name",
            type: { typeName: "String", nullable: false, list: false },
          },
        ],
      };
      const node = buildObjectTypeDefinitionNode(baseType);

      expect(node.kind, Kind.OBJECT_TYPE_DEFINITION);
      expect(node.name.value, "User");
      expect(node.fields?.length, 2);
    });

    it("should create empty fields for Query base type", () => {
      const baseType: BaseType = {
        name: "Query",
        kind: "Object",
        fields: [],
      };
      const node = buildObjectTypeDefinitionNode(baseType);

      expect(node.kind, Kind.OBJECT_TYPE_DEFINITION);
      expect(node.name.value, "Query");
      expect(node.fields?.length, 0);
    });
  });

  describe("buildUnionTypeDefinitionNode", () => {
    it("should create UnionTypeDefinitionNode from BaseType with sorted members", () => {
      const baseType: BaseType = {
        name: "SearchResult",
        kind: "Union",
        unionMembers: ["User", "Post"],
      };
      const node = buildUnionTypeDefinitionNode(baseType);

      expect(node.kind, Kind.UNION_TYPE_DEFINITION);
      expect(node.name.value, "SearchResult");
      expect(node.types?.length, 2);
      expect(node.types?.[0]?.name.value, "Post");
      expect(node.types?.[1]?.name.value, "User");
    });
  });

  describe("buildEnumValueDefinitionNode", () => {
    it("should create EnumValueDefinitionNode from EnumValueInfo", () => {
      const enumValue: EnumValueInfo = {
        name: "ACTIVE",
        originalValue: "active",
      };
      const node = buildEnumValueDefinitionNode(enumValue);

      expect(node.kind, Kind.ENUM_VALUE_DEFINITION);
      expect(node.name.value, "ACTIVE");
    });
  });

  describe("buildScalarTypeDefinitionNode", () => {
    it("should create ScalarTypeDefinitionNode with name only", () => {
      const node = buildScalarTypeDefinitionNode("DateTime");

      expect(node.kind, Kind.SCALAR_TYPE_DEFINITION);
      expect(node.name.value, "DateTime");
      expect(node.description, undefined);
    });

    it("should create ScalarTypeDefinitionNode with description", () => {
      const node = buildScalarTypeDefinitionNode(
        "DateTime",
        "An ISO-8601 encoded datetime",
      );

      expect(node.kind, Kind.SCALAR_TYPE_DEFINITION);
      expect(node.name.value, "DateTime");
      expect(node.description);
      expect(
        node.description.value,
        "An ISO-8601 encoded datetime",
      );
    });
  });

  describe("buildEnumTypeDefinitionNode", () => {
    it("should create EnumTypeDefinitionNode from BaseType", () => {
      const baseType: BaseType = {
        name: "Status",
        kind: "Enum",
        enumValues: [
          { name: "ACTIVE", originalValue: "active" },
          { name: "INACTIVE", originalValue: "inactive" },
        ],
      };
      const node = buildEnumTypeDefinitionNode(baseType);

      expect(node.kind, Kind.ENUM_TYPE_DEFINITION);
      expect(node.name.value, "Status");
      expect(node.values?.length, 2);
      expect(node.values?.[0]?.name.value, "ACTIVE");
      expect(node.values?.[1]?.name.value, "INACTIVE");
    });

    it("should preserve enum value order", () => {
      const baseType: BaseType = {
        name: "Priority",
        kind: "Enum",
        enumValues: [
          { name: "LOW", originalValue: "low" },
          { name: "HIGH", originalValue: "high" },
          { name: "MEDIUM", originalValue: "medium" },
        ],
      };
      const node = buildEnumTypeDefinitionNode(baseType);

      expect(node.values?.[0]?.name.value, "LOW");
      expect(node.values?.[1]?.name.value, "HIGH");
      expect(node.values?.[2]?.name.value, "MEDIUM");
    });
  });

  describe("buildInputObjectTypeDefinitionNode", () => {
    it("should create InputObjectTypeDefinitionNode from InputType", () => {
      const inputType: InputType = {
        name: "CreateUserInput",
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
        sourceFile: "/path/to/input.ts",
      };
      const node = buildInputObjectTypeDefinitionNode(inputType);

      expect(node.kind, Kind.INPUT_OBJECT_TYPE_DEFINITION);
      expect(node.name.value, "CreateUserInput");
      expect(node.fields?.length, 2);
    });

    it("should sort fields by name alphabetically", () => {
      const inputType: InputType = {
        name: "TestInput",
        fields: [
          {
            name: "zulu",
            type: { typeName: "String", nullable: false, list: false },
          },
          {
            name: "alpha",
            type: { typeName: "String", nullable: false, list: false },
          },
          {
            name: "bravo",
            type: { typeName: "String", nullable: false, list: false },
          },
        ],
        sourceFile: "/path/to/input.ts",
      };
      const node = buildInputObjectTypeDefinitionNode(inputType);

      const fieldNames = node.fields?.map((f) => f.name.value);
      expect(fieldNames, ["alpha", "bravo", "zulu"]);
    });

    it("should handle non-nullable fields correctly", () => {
      const inputType: InputType = {
        name: "RequiredFieldsInput",
        fields: [
          {
            name: "required",
            type: { typeName: "String", nullable: false, list: false },
          },
        ],
        sourceFile: "/path/to/input.ts",
      };
      const node = buildInputObjectTypeDefinitionNode(inputType);

      expect(node.fields?.[0]?.type.kind, Kind.NON_NULL_TYPE);
    });

    it("should handle nullable fields correctly", () => {
      const inputType: InputType = {
        name: "OptionalFieldsInput",
        fields: [
          {
            name: "optional",
            type: { typeName: "String", nullable: true, list: false },
          },
        ],
        sourceFile: "/path/to/input.ts",
      };
      const node = buildInputObjectTypeDefinitionNode(inputType);

      expect(node.fields?.[0]?.type.kind, Kind.NAMED_TYPE);
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
          },
        ],
        sourceFile: "/path/to/input.ts",
      };
      const node = buildInputObjectTypeDefinitionNode(inputType);

      expect(node.fields?.[0]?.type.kind, Kind.NON_NULL_TYPE);
      if (node.fields?.[0]?.type.kind === Kind.NON_NULL_TYPE) {
        expect(node.fields[0].type.type.kind, Kind.LIST_TYPE);
      }
    });

    it("should handle nested Input type references", () => {
      const inputType: InputType = {
        name: "CreatePostInput",
        fields: [
          {
            name: "title",
            type: { typeName: "String", nullable: false, list: false },
          },
          {
            name: "author",
            type: { typeName: "AuthorInput", nullable: false, list: false },
          },
        ],
        sourceFile: "/path/to/input.ts",
      };
      const node = buildInputObjectTypeDefinitionNode(inputType);

      const authorField = node.fields?.find((f) => f.name.value === "author");
      expect(authorField);
      if (authorField?.type.kind === Kind.NON_NULL_TYPE) {
        const namedType = authorField.type.type;
        if (namedType.kind === Kind.NAMED_TYPE) {
          expect(namedType.name.value, "AuthorInput");
        }
      }
    });

    it("should handle Enum type fields in Input Object", () => {
      const inputType: InputType = {
        name: "UpdateUserInput",
        fields: [
          {
            name: "status",
            type: { typeName: "Status", nullable: false, list: false },
          },
          {
            name: "role",
            type: { typeName: "Role", nullable: true, list: false },
          },
        ],
        sourceFile: "/path/to/input.ts",
      };
      const node = buildInputObjectTypeDefinitionNode(inputType);

      const statusField = node.fields?.find((f) => f.name.value === "status");
      expect(statusField);
      expect(statusField?.type.kind, Kind.NON_NULL_TYPE);
      if (statusField?.type.kind === Kind.NON_NULL_TYPE) {
        const namedType = statusField.type.type;
        if (namedType.kind === Kind.NAMED_TYPE) {
          expect(namedType.name.value, "Status");
        }
      }

      const roleField = node.fields?.find((f) => f.name.value === "role");
      expect(roleField);
      expect(roleField?.type.kind, Kind.NAMED_TYPE);
      if (roleField?.type.kind === Kind.NAMED_TYPE) {
        expect(roleField.type.name.value, "Role");
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
            type: { typeName: "Post", nullable: false, list: true },
            resolverSourceFile: "/path/to/resolver.ts",
          },
        ],
      };
      const node = buildObjectTypeExtensionNode(typeExtension);

      expect(node.kind, Kind.OBJECT_TYPE_EXTENSION);
      expect(node.name.value, "User");
      expect(node.fields?.length, 1);
      expect(node.fields?.[0]?.name.value, "posts");
    });

    it("should handle multiple fields with args and sort by name", () => {
      const typeExtension: TypeExtension = {
        targetTypeName: "Query",
        fields: [
          {
            name: "users",
            type: { typeName: "User", nullable: false, list: true },
            resolverSourceFile: "/path/to/resolver.ts",
          },
          {
            name: "user",
            type: { typeName: "User", nullable: true, list: false },
            args: [
              {
                name: "id",
                type: { typeName: "ID", nullable: false, list: false },
              },
            ],
            resolverSourceFile: "/path/to/resolver.ts",
          },
        ],
      };
      const node = buildObjectTypeExtensionNode(typeExtension);

      expect(node.fields?.length, 2);
      expect(node.fields?.[0]?.name.value, "user");
      expect(node.fields?.[0]?.arguments?.length, 1);
      expect(node.fields?.[1]?.name.value, "users");
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
                type: { typeName: "ID", nullable: false, list: false },
              },
            ],
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);

      expect(doc.kind, Kind.DOCUMENT);
      expect(doc.definitions.length, 1);
      expect(doc.definitions[0]?.kind, Kind.OBJECT_TYPE_DEFINITION);
    });

    it("should include both base types and type extensions", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "Query",
            kind: "Object",
            fields: [],
          },
          {
            name: "User",
            kind: "Object",
            fields: [
              {
                name: "id",
                type: { typeName: "ID", nullable: false, list: false },
              },
            ],
          },
        ],
        inputTypes: [],
        typeExtensions: [
          {
            targetTypeName: "Query",
            fields: [
              {
                name: "users",
                type: { typeName: "User", nullable: false, list: true },
                resolverSourceFile: "/path/to/resolver.ts",
              },
            ],
          },
        ],
        hasQuery: true,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);

      expect(doc.definitions.length, 3);
    });

    it("should sort base types by name", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          { name: "Zebra", kind: "Object", fields: [] },
          { name: "Apple", kind: "Object", fields: [] },
          { name: "Mango", kind: "Object", fields: [] },
        ],
        inputTypes: [],
        typeExtensions: [],
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

      expect(names, ["Apple", "Mango", "Zebra"]);
    });

    it("should sort type extensions by name", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          { name: "Apple", kind: "Object", fields: [] },
          { name: "Zebra", kind: "Object", fields: [] },
        ],
        inputTypes: [],
        typeExtensions: [
          {
            targetTypeName: "Zebra",
            fields: [
              {
                name: "field",
                type: { typeName: "String", nullable: false, list: false },
                resolverSourceFile: "/a.ts",
              },
            ],
          },
          {
            targetTypeName: "Apple",
            fields: [
              {
                name: "field",
                type: { typeName: "String", nullable: false, list: false },
                resolverSourceFile: "/b.ts",
              },
            ],
          },
        ],
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

      expect(names, ["Apple", "Zebra"]);
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
                type: { typeName: "String", nullable: false, list: false },
              },
              {
                name: "alpha",
                type: { typeName: "String", nullable: false, list: false },
              },
            ],
          },
        ],
        inputTypes: [],
        typeExtensions: [],
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
            unionMembers: ["User", "Post"],
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);

      expect(doc.definitions.length, 1);
      expect(doc.definitions[0]?.kind, Kind.UNION_TYPE_DEFINITION);
    });

    it("should handle Enum types", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "Status",
            kind: "Enum",
            enumValues: [
              { name: "ACTIVE", originalValue: "active" },
              { name: "INACTIVE", originalValue: "inactive" },
            ],
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);

      expect(doc.definitions.length, 1);
      expect(doc.definitions[0]?.kind, Kind.ENUM_TYPE_DEFINITION);
    });

    it("should produce valid GraphQL SDL with enum", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "Status",
            kind: "Enum",
            enumValues: [
              { name: "ACTIVE", originalValue: "active" },
              { name: "PENDING", originalValue: "pending" },
            ],
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes("enum Status"));
      expect(sdl.includes("ACTIVE"));
      expect(sdl.includes("PENDING"));
    });

    it("should produce valid GraphQL SDL", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "Query",
            kind: "Object",
            fields: [],
          },
          {
            name: "User",
            kind: "Object",
            fields: [
              {
                name: "id",
                type: { typeName: "ID", nullable: false, list: false },
              },
              {
                name: "name",
                type: { typeName: "String", nullable: false, list: false },
              },
            ],
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
                resolverSourceFile: "/path/to/resolver.ts",
              },
            ],
          },
        ],
        hasQuery: true,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes("type Query"));
      expect(sdl.includes("type User"));
      expect(sdl.includes("extend type Query"));
      expect(sdl.includes("users: [User!]!"));
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
                type: { typeName: "ID", nullable: false, list: false },
              },
              {
                name: "name",
                type: { typeName: "String", nullable: false, list: false },
              },
            ],
          },
        ],
        inputTypes: [
          {
            name: "CreateUserInput",
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
            sourceFile: "/path/to/input.ts",
          },
        ],
        typeExtensions: [],
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes("input CreateUserInput"));
      expect(sdl.includes("name: String!"));
      expect(sdl.includes("email: String"));
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
                type: { typeName: "String", nullable: false, list: false },
              },
            ],
            sourceFile: "/path/to/z.ts",
          },
          {
            name: "AInput",
            fields: [
              {
                name: "value",
                type: { typeName: "String", nullable: false, list: false },
              },
            ],
            sourceFile: "/path/to/a.ts",
          },
        ],
        typeExtensions: [],
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const inputTypes = doc.definitions.filter(
        (d) => d.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION,
      );

      expect(inputTypes.length, 2);
      if (
        inputTypes[0]?.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION &&
        inputTypes[1]?.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION
      ) {
        expect(inputTypes[0].name.value, "AInput");
        expect(inputTypes[1].name.value, "ZInput");
      }
    });

    it("should produce complete schema with Input types and arguments", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "Mutation",
            kind: "Object",
            fields: [],
          },
          {
            name: "User",
            kind: "Object",
            fields: [
              {
                name: "id",
                type: { typeName: "ID", nullable: false, list: false },
              },
              {
                name: "name",
                type: { typeName: "String", nullable: false, list: false },
              },
            ],
          },
        ],
        inputTypes: [
          {
            name: "CreateUserInput",
            fields: [
              {
                name: "name",
                type: { typeName: "String", nullable: false, list: false },
              },
            ],
            sourceFile: "/path/to/input.ts",
          },
        ],
        typeExtensions: [
          {
            targetTypeName: "Mutation",
            fields: [
              {
                name: "createUser",
                type: { typeName: "User", nullable: false, list: false },
                args: [
                  {
                    name: "input",
                    type: {
                      typeName: "CreateUserInput",
                      nullable: false,
                      list: false,
                    },
                  },
                ],
                resolverSourceFile: "/path/to/mutation.ts",
              },
            ],
          },
        ],
        hasQuery: false,
        hasMutation: true,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes("input CreateUserInput"));
      expect(sdl.includes("type Mutation"));
      expect(sdl.includes("type User"));
      expect(sdl.includes("extend type Mutation"));
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
                type: { typeName: "ID", nullable: false, list: false },
              },
            ],
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes('"A user in the system"'));
      expect(sdl.includes("type User"));
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
                type: { typeName: "ID", nullable: false, list: false },
                description: "The unique identifier",
              },
            ],
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes('"The unique identifier"'));
    });

    it("should add @deprecated directive to type definition", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          {
            name: "User",
            kind: "Object",
            deprecated: { isDeprecated: true, reason: "Use Member instead" },
            fields: [],
          },
        ],
        inputTypes: [],
        typeExtensions: [],
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
            deprecated: { isDeprecated: true },
            fields: [],
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes("@deprecated"));
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
                type: { typeName: "ID", nullable: false, list: false },
                deprecated: { isDeprecated: true, reason: "Use uuid instead" },
              },
            ],
          },
        ],
        inputTypes: [],
        typeExtensions: [],
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
            enumValues: [{ name: "ACTIVE", originalValue: "active" }],
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes('"The status of an item"'));
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
              },
            ],
          },
        ],
        inputTypes: [],
        typeExtensions: [],
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes('"The item is active"'));
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
                deprecated: { isDeprecated: true, reason: "Use SUSPENDED" },
              },
            ],
          },
        ],
        inputTypes: [],
        typeExtensions: [],
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
        baseTypes: [{ name: "Query", kind: "Object", fields: [] }],
        inputTypes: [],
        typeExtensions: [
          {
            targetTypeName: "Query",
            fields: [
              {
                name: "me",
                type: { typeName: "User", nullable: false, list: false },
                description: "Get the current user",
                resolverSourceFile: "/path/to/resolver.ts",
              },
            ],
          },
        ],
        hasQuery: true,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes('"Get the current user"'));
    });

    it("should add @deprecated directive to extension field", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [{ name: "Query", kind: "Object", fields: [] }],
        inputTypes: [],
        typeExtensions: [
          {
            targetTypeName: "Query",
            fields: [
              {
                name: "me",
                type: { typeName: "User", nullable: false, list: false },
                deprecated: { isDeprecated: true, reason: "Use currentUser" },
                resolverSourceFile: "/path/to/resolver.ts",
              },
            ],
          },
        ],
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
                type: { typeName: "String", nullable: false, list: false },
              },
            ],
            sourceFile: "/path/to/input.ts",
          },
        ],
        typeExtensions: [],
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes('"Input for creating a user"'));
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
                type: { typeName: "DateTime", nullable: false, list: false },
              },
            ],
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

      expect(sdl.includes("scalar DateTime"));
      expect(sdl.includes("type User"));
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

      expect(scalarDefs.length, 3);
      if (
        scalarDefs[0]?.kind === Kind.SCALAR_TYPE_DEFINITION &&
        scalarDefs[1]?.kind === Kind.SCALAR_TYPE_DEFINITION &&
        scalarDefs[2]?.kind === Kind.SCALAR_TYPE_DEFINITION
      ) {
        expect(scalarDefs[0].name.value, "DateTime");
        expect(scalarDefs[1].name.value, "URL");
        expect(scalarDefs[2].name.value, "UUID");
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
                type: { typeName: "ID", nullable: false, list: false },
              },
            ],
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

      expect(doc.definitions[0]?.kind, Kind.SCALAR_TYPE_DEFINITION);
      expect(doc.definitions[1]?.kind, Kind.OBJECT_TYPE_DEFINITION);
    });
  });
});
