import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type DocumentNode, Kind, print } from "graphql";
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

      assert.ok(sdl.includes("type Query"));
      assert.ok(sdl.includes("type User"));
      assert.deepEqual(result.removedTypes, []);
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

      assert.ok(sdl.includes("type Query"));
      assert.ok(!sdl.includes("UnusedType"));
      assert.ok(result.removedTypes.includes("UnusedType"));
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

      assert.ok(sdl.includes("type Mutation"));
      assert.ok(sdl.includes("type User"));
      assert.ok(sdl.includes("input CreateUserInput"));
      assert.deepEqual(result.removedTypes, []);
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

      assert.ok(sdl.includes("scalar DateTime"));
      assert.deepEqual(result.removedTypes, []);
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

      assert.ok(sdl.includes("type Query"));
      assert.ok(sdl.includes("type User"));
      assert.ok(sdl.includes("type Post"));
      assert.deepEqual(result.removedTypes, []);
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

      assert.ok(sdl.includes("Query"));
      assert.ok(sdl.includes("User"));
      assert.deepEqual(result.removedTypes, []);
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

      assert.ok(sdl.includes("enum Status"));
      assert.ok(sdl.includes("ACTIVE"));
      assert.deepEqual(result.removedTypes, []);
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

      assert.ok(sdl.includes("union SearchResult"));
      assert.ok(sdl.includes("type User"));
      assert.ok(sdl.includes("type Post"));
      assert.deepEqual(result.removedTypes, []);
    });
  });
});
