import assert from "node:assert";
import { describe, it } from "node:test";
import { Kind, print } from "graphql";
import type { GraphQLInputValue } from "../../resolver-extractor/index.js";
import type { GraphQLFieldType } from "../../type-extractor/types/index.js";
import type {
  BaseType,
  ExtensionField,
  IntegratedResult,
  TypeExtension,
} from "../integrator/result-integrator.js";
import {
  buildDocumentNode,
  buildFieldDefinitionNode,
  buildFieldTypeNode,
  buildInputValueDefinitionNode,
  buildListTypeNode,
  buildNamedTypeNode,
  buildNameNode,
  buildNonNullTypeNode,
  buildObjectTypeDefinitionNode,
  buildObjectTypeExtensionNode,
  buildUnionTypeDefinitionNode,
} from "./ast-builder.js";

describe("ASTBuilder", () => {
  describe("buildNameNode", () => {
    it("should create a NameNode with given value", () => {
      const node = buildNameNode("User");

      assert.strictEqual(node.kind, Kind.NAME);
      assert.strictEqual(node.value, "User");
    });
  });

  describe("buildNamedTypeNode", () => {
    it("should create a NamedTypeNode with given type name", () => {
      const node = buildNamedTypeNode("String");

      assert.strictEqual(node.kind, Kind.NAMED_TYPE);
      assert.strictEqual(node.name.kind, Kind.NAME);
      assert.strictEqual(node.name.value, "String");
    });
  });

  describe("buildListTypeNode", () => {
    it("should wrap inner type in ListType", () => {
      const innerType = buildNamedTypeNode("User");
      const node = buildListTypeNode(innerType);

      assert.strictEqual(node.kind, Kind.LIST_TYPE);
      assert.strictEqual(node.type.kind, Kind.NAMED_TYPE);
    });
  });

  describe("buildNonNullTypeNode", () => {
    it("should wrap inner type in NonNullType", () => {
      const innerType = buildNamedTypeNode("String");
      const node = buildNonNullTypeNode(innerType);

      assert.strictEqual(node.kind, Kind.NON_NULL_TYPE);
      assert.strictEqual(node.type.kind, Kind.NAMED_TYPE);
    });
  });

  describe("buildInputValueDefinitionNode", () => {
    it("should create InputValueDefinitionNode with name and type", () => {
      const inputValue: GraphQLInputValue = {
        name: "id",
        type: { typeName: "ID", nullable: false, list: false },
      };
      const node = buildInputValueDefinitionNode(inputValue);

      assert.strictEqual(node.kind, Kind.INPUT_VALUE_DEFINITION);
      assert.strictEqual(node.name.value, "id");
      assert.strictEqual(node.type.kind, Kind.NON_NULL_TYPE);
    });

    it("should handle nullable type", () => {
      const inputValue: GraphQLInputValue = {
        name: "limit",
        type: { typeName: "Int", nullable: true, list: false },
      };
      const node = buildInputValueDefinitionNode(inputValue);

      assert.strictEqual(node.type.kind, Kind.NAMED_TYPE);
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

      assert.strictEqual(node.kind, Kind.NON_NULL_TYPE);
      if (node.kind === Kind.NON_NULL_TYPE) {
        assert.strictEqual(node.type.kind, Kind.NAMED_TYPE);
      }
    });

    it("should create NamedType for nullable scalar", () => {
      const fieldType: GraphQLFieldType = {
        typeName: "String",
        nullable: true,
        list: false,
      };
      const node = buildFieldTypeNode(fieldType);

      assert.strictEqual(node.kind, Kind.NAMED_TYPE);
    });

    it("should create non-null list with non-null items [Type!]!", () => {
      const fieldType: GraphQLFieldType = {
        typeName: "User",
        nullable: false,
        list: true,
        listItemNullable: false,
      };
      const node = buildFieldTypeNode(fieldType);

      assert.strictEqual(node.kind, Kind.NON_NULL_TYPE);
      if (node.kind === Kind.NON_NULL_TYPE) {
        assert.strictEqual(node.type.kind, Kind.LIST_TYPE);
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

      assert.strictEqual(node.kind, Kind.LIST_TYPE);
    });

    it("should create non-null list with nullable items [Type]!", () => {
      const fieldType: GraphQLFieldType = {
        typeName: "User",
        nullable: false,
        list: true,
        listItemNullable: true,
      };
      const node = buildFieldTypeNode(fieldType);

      assert.strictEqual(node.kind, Kind.NON_NULL_TYPE);
      if (node.kind === Kind.NON_NULL_TYPE) {
        const listType = node.type;
        assert.strictEqual(listType.kind, Kind.LIST_TYPE);
        if (listType.kind === Kind.LIST_TYPE) {
          assert.strictEqual(listType.type.kind, Kind.NAMED_TYPE);
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

      assert.strictEqual(node.kind, Kind.LIST_TYPE);
      if (node.kind === Kind.LIST_TYPE) {
        assert.strictEqual(node.type.kind, Kind.NAMED_TYPE);
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

      assert.strictEqual(node.kind, Kind.FIELD_DEFINITION);
      assert.strictEqual(node.name.value, "posts");
      assert.strictEqual(node.type.kind, Kind.NON_NULL_TYPE);
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

      assert.strictEqual(node.arguments?.length, 1);
      assert.strictEqual(node.arguments?.[0]?.name.value, "id");
    });

    it("should have empty arguments array when no args", () => {
      const field: ExtensionField = {
        name: "users",
        type: { typeName: "User", nullable: false, list: true },
        resolverSourceFile: "/path/to/resolver.ts",
      };
      const node = buildFieldDefinitionNode(field);

      assert.strictEqual(node.arguments?.length ?? 0, 0);
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

      assert.strictEqual(node.kind, Kind.OBJECT_TYPE_DEFINITION);
      assert.strictEqual(node.name.value, "User");
      assert.strictEqual(node.fields?.length, 2);
    });

    it("should create empty fields for Query base type", () => {
      const baseType: BaseType = {
        name: "Query",
        kind: "Object",
        fields: [],
      };
      const node = buildObjectTypeDefinitionNode(baseType);

      assert.strictEqual(node.kind, Kind.OBJECT_TYPE_DEFINITION);
      assert.strictEqual(node.name.value, "Query");
      assert.strictEqual(node.fields?.length, 0);
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

      assert.strictEqual(node.kind, Kind.UNION_TYPE_DEFINITION);
      assert.strictEqual(node.name.value, "SearchResult");
      assert.strictEqual(node.types?.length, 2);
      assert.strictEqual(node.types?.[0]?.name.value, "Post");
      assert.strictEqual(node.types?.[1]?.name.value, "User");
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

      assert.strictEqual(node.kind, Kind.OBJECT_TYPE_EXTENSION);
      assert.strictEqual(node.name.value, "User");
      assert.strictEqual(node.fields?.length, 1);
      assert.strictEqual(node.fields?.[0]?.name.value, "posts");
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

      assert.strictEqual(node.fields?.length, 2);
      assert.strictEqual(node.fields?.[0]?.name.value, "user");
      assert.strictEqual(node.fields?.[0]?.arguments?.length, 1);
      assert.strictEqual(node.fields?.[1]?.name.value, "users");
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
        typeExtensions: [],
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);

      assert.strictEqual(doc.kind, Kind.DOCUMENT);
      assert.strictEqual(doc.definitions.length, 1);
      assert.strictEqual(doc.definitions[0]?.kind, Kind.OBJECT_TYPE_DEFINITION);
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

      assert.strictEqual(doc.definitions.length, 3);
    });

    it("should sort base types by name", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          { name: "Zebra", kind: "Object", fields: [] },
          { name: "Apple", kind: "Object", fields: [] },
          { name: "Mango", kind: "Object", fields: [] },
        ],
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

      assert.deepStrictEqual(names, ["Apple", "Mango", "Zebra"]);
    });

    it("should sort type extensions by name", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [
          { name: "Apple", kind: "Object", fields: [] },
          { name: "Zebra", kind: "Object", fields: [] },
        ],
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

      assert.deepStrictEqual(names, ["Apple", "Zebra"]);
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
        assert.deepStrictEqual(fieldNames, ["alpha", "zulu"]);
      } else {
        assert.fail("Expected ObjectTypeDefinitionNode");
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
        typeExtensions: [],
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const doc = buildDocumentNode(integratedResult);

      assert.strictEqual(doc.definitions.length, 1);
      assert.strictEqual(doc.definitions[0]?.kind, Kind.UNION_TYPE_DEFINITION);
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

      assert.ok(sdl.includes("type Query"));
      assert.ok(sdl.includes("type User"));
      assert.ok(sdl.includes("extend type Query"));
      assert.ok(sdl.includes("users: [User!]!"));
    });
  });
});
