import { type DocumentNode, Kind, print } from "graphql";
import { describe, expect, it } from "vitest";
import { pruneDocumentNode } from "./schema-pruner.js";

describe("SchemaPruner", () => {
  describe("pruneDocumentNode", () => {
    it("should keep types referenced from Query", () => {
      const doc: DocumentNode = {
        kind: Kind.DOCUMENT,
        definitions: [
          {
            kind: Kind.OBJECT_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: "Query" },
            fields: [
              {
                kind: Kind.FIELD_DEFINITION,
                name: { kind: Kind.NAME, value: "user" },
                type: {
                  kind: Kind.NAMED_TYPE,
                  name: { kind: Kind.NAME, value: "User" },
                },
              },
            ],
          },
          {
            kind: Kind.OBJECT_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: "User" },
            fields: [
              {
                kind: Kind.FIELD_DEFINITION,
                name: { kind: Kind.NAME, value: "id" },
                type: {
                  kind: Kind.NON_NULL_TYPE,
                  type: {
                    kind: Kind.NAMED_TYPE,
                    name: { kind: Kind.NAME, value: "ID" },
                  },
                },
              },
            ],
          },
        ],
      };

      const result = pruneDocumentNode({ documentNode: doc });
      const sdl = print(result.documentNode);

      expect(sdl).toContain("type Query");
      expect(sdl).toContain("type User");
      expect(result.removedTypes).toEqual([]);
    });

    it("should remove types not referenced from root types", () => {
      const doc: DocumentNode = {
        kind: Kind.DOCUMENT,
        definitions: [
          {
            kind: Kind.OBJECT_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: "Query" },
            fields: [
              {
                kind: Kind.FIELD_DEFINITION,
                name: { kind: Kind.NAME, value: "hello" },
                type: {
                  kind: Kind.NAMED_TYPE,
                  name: { kind: Kind.NAME, value: "String" },
                },
              },
            ],
          },
          {
            kind: Kind.OBJECT_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: "UnusedType" },
            fields: [
              {
                kind: Kind.FIELD_DEFINITION,
                name: { kind: Kind.NAME, value: "id" },
                type: {
                  kind: Kind.NAMED_TYPE,
                  name: { kind: Kind.NAME, value: "ID" },
                },
              },
            ],
          },
        ],
      };

      const result = pruneDocumentNode({ documentNode: doc });
      const sdl = print(result.documentNode);

      expect(sdl).toContain("type Query");
      expect(sdl).not.toContain("UnusedType");
      expect(result.removedTypes).toContain("UnusedType");
    });

    it("should keep types referenced from Mutation", () => {
      const doc: DocumentNode = {
        kind: Kind.DOCUMENT,
        definitions: [
          {
            kind: Kind.OBJECT_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: "Mutation" },
            fields: [
              {
                kind: Kind.FIELD_DEFINITION,
                name: { kind: Kind.NAME, value: "createUser" },
                arguments: [
                  {
                    kind: Kind.INPUT_VALUE_DEFINITION,
                    name: { kind: Kind.NAME, value: "input" },
                    type: {
                      kind: Kind.NON_NULL_TYPE,
                      type: {
                        kind: Kind.NAMED_TYPE,
                        name: { kind: Kind.NAME, value: "CreateUserInput" },
                      },
                    },
                  },
                ],
                type: {
                  kind: Kind.NAMED_TYPE,
                  name: { kind: Kind.NAME, value: "User" },
                },
              },
            ],
          },
          {
            kind: Kind.OBJECT_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: "User" },
            fields: [
              {
                kind: Kind.FIELD_DEFINITION,
                name: { kind: Kind.NAME, value: "id" },
                type: {
                  kind: Kind.NAMED_TYPE,
                  name: { kind: Kind.NAME, value: "ID" },
                },
              },
            ],
          },
          {
            kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: "CreateUserInput" },
            fields: [
              {
                kind: Kind.INPUT_VALUE_DEFINITION,
                name: { kind: Kind.NAME, value: "name" },
                type: {
                  kind: Kind.NON_NULL_TYPE,
                  type: {
                    kind: Kind.NAMED_TYPE,
                    name: { kind: Kind.NAME, value: "String" },
                  },
                },
              },
            ],
          },
        ],
      };

      const result = pruneDocumentNode({ documentNode: doc });
      const sdl = print(result.documentNode);

      expect(sdl).toContain("type Mutation");
      expect(sdl).toContain("type User");
      expect(sdl).toContain("input CreateUserInput");
      expect(result.removedTypes).toEqual([]);
    });

    it("should keep custom scalars when specified", () => {
      const doc: DocumentNode = {
        kind: Kind.DOCUMENT,
        definitions: [
          {
            kind: Kind.OBJECT_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: "Query" },
            fields: [
              {
                kind: Kind.FIELD_DEFINITION,
                name: { kind: Kind.NAME, value: "hello" },
                type: {
                  kind: Kind.NAMED_TYPE,
                  name: { kind: Kind.NAME, value: "String" },
                },
              },
            ],
          },
          {
            kind: Kind.SCALAR_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: "DateTime" },
          },
        ],
      };

      const result = pruneDocumentNode({
        documentNode: doc,
        customScalarNames: ["DateTime"],
      });
      const sdl = print(result.documentNode);

      expect(sdl).toContain("scalar DateTime");
      expect(result.removedTypes).toEqual([]);
    });

    it("should keep transitively referenced types", () => {
      const doc: DocumentNode = {
        kind: Kind.DOCUMENT,
        definitions: [
          {
            kind: Kind.OBJECT_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: "Query" },
            fields: [
              {
                kind: Kind.FIELD_DEFINITION,
                name: { kind: Kind.NAME, value: "user" },
                type: {
                  kind: Kind.NAMED_TYPE,
                  name: { kind: Kind.NAME, value: "User" },
                },
              },
            ],
          },
          {
            kind: Kind.OBJECT_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: "User" },
            fields: [
              {
                kind: Kind.FIELD_DEFINITION,
                name: { kind: Kind.NAME, value: "posts" },
                type: {
                  kind: Kind.LIST_TYPE,
                  type: {
                    kind: Kind.NAMED_TYPE,
                    name: { kind: Kind.NAME, value: "Post" },
                  },
                },
              },
            ],
          },
          {
            kind: Kind.OBJECT_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: "Post" },
            fields: [
              {
                kind: Kind.FIELD_DEFINITION,
                name: { kind: Kind.NAME, value: "title" },
                type: {
                  kind: Kind.NAMED_TYPE,
                  name: { kind: Kind.NAME, value: "String" },
                },
              },
            ],
          },
        ],
      };

      const result = pruneDocumentNode({ documentNode: doc });
      const sdl = print(result.documentNode);

      expect(sdl).toContain("type Query");
      expect(sdl).toContain("type User");
      expect(sdl).toContain("type Post");
      expect(result.removedTypes).toEqual([]);
    });

    it("should handle type extensions with Query", () => {
      const doc: DocumentNode = {
        kind: Kind.DOCUMENT,
        definitions: [
          {
            kind: Kind.OBJECT_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: "Query" },
            fields: [],
          },
          {
            kind: Kind.OBJECT_TYPE_EXTENSION,
            name: { kind: Kind.NAME, value: "Query" },
            fields: [
              {
                kind: Kind.FIELD_DEFINITION,
                name: { kind: Kind.NAME, value: "user" },
                type: {
                  kind: Kind.NAMED_TYPE,
                  name: { kind: Kind.NAME, value: "User" },
                },
              },
            ],
          },
          {
            kind: Kind.OBJECT_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: "User" },
            fields: [
              {
                kind: Kind.FIELD_DEFINITION,
                name: { kind: Kind.NAME, value: "id" },
                type: {
                  kind: Kind.NAMED_TYPE,
                  name: { kind: Kind.NAME, value: "ID" },
                },
              },
            ],
          },
        ],
      };

      const result = pruneDocumentNode({ documentNode: doc });
      const sdl = print(result.documentNode);

      expect(sdl).toContain("Query");
      expect(sdl).toContain("User");
      expect(result.removedTypes).toEqual([]);
    });

    it("should keep enum types referenced from fields", () => {
      const doc: DocumentNode = {
        kind: Kind.DOCUMENT,
        definitions: [
          {
            kind: Kind.OBJECT_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: "Query" },
            fields: [
              {
                kind: Kind.FIELD_DEFINITION,
                name: { kind: Kind.NAME, value: "status" },
                type: {
                  kind: Kind.NAMED_TYPE,
                  name: { kind: Kind.NAME, value: "Status" },
                },
              },
            ],
          },
          {
            kind: Kind.ENUM_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: "Status" },
            values: [
              {
                kind: Kind.ENUM_VALUE_DEFINITION,
                name: { kind: Kind.NAME, value: "ACTIVE" },
              },
              {
                kind: Kind.ENUM_VALUE_DEFINITION,
                name: { kind: Kind.NAME, value: "INACTIVE" },
              },
            ],
          },
        ],
      };

      const result = pruneDocumentNode({ documentNode: doc });
      const sdl = print(result.documentNode);

      expect(sdl).toContain("enum Status");
      expect(sdl).toContain("ACTIVE");
      expect(result.removedTypes).toEqual([]);
    });

    it("should keep union types and their members", () => {
      const doc: DocumentNode = {
        kind: Kind.DOCUMENT,
        definitions: [
          {
            kind: Kind.OBJECT_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: "Query" },
            fields: [
              {
                kind: Kind.FIELD_DEFINITION,
                name: { kind: Kind.NAME, value: "search" },
                type: {
                  kind: Kind.NAMED_TYPE,
                  name: { kind: Kind.NAME, value: "SearchResult" },
                },
              },
            ],
          },
          {
            kind: Kind.UNION_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: "SearchResult" },
            types: [
              {
                kind: Kind.NAMED_TYPE,
                name: { kind: Kind.NAME, value: "User" },
              },
              {
                kind: Kind.NAMED_TYPE,
                name: { kind: Kind.NAME, value: "Post" },
              },
            ],
          },
          {
            kind: Kind.OBJECT_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: "User" },
            fields: [
              {
                kind: Kind.FIELD_DEFINITION,
                name: { kind: Kind.NAME, value: "id" },
                type: {
                  kind: Kind.NAMED_TYPE,
                  name: { kind: Kind.NAME, value: "ID" },
                },
              },
            ],
          },
          {
            kind: Kind.OBJECT_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: "Post" },
            fields: [
              {
                kind: Kind.FIELD_DEFINITION,
                name: { kind: Kind.NAME, value: "id" },
                type: {
                  kind: Kind.NAMED_TYPE,
                  name: { kind: Kind.NAME, value: "ID" },
                },
              },
            ],
          },
        ],
      };

      const result = pruneDocumentNode({ documentNode: doc });
      const sdl = print(result.documentNode);

      expect(sdl).toContain("union SearchResult");
      expect(sdl).toContain("type User");
      expect(sdl).toContain("type Post");
      expect(result.removedTypes).toEqual([]);
    });
  });
});
