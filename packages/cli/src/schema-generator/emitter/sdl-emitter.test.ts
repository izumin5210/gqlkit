import { type DocumentNode, Kind } from "graphql";
import { describe, expect, it } from "vitest";
import { emitSdlContent } from "./sdl-emitter.js";

describe("SdlEmitter", () => {
  describe("emitSdlContent", () => {
    it("should emit simple object type", () => {
      const doc: DocumentNode = {
        kind: Kind.DOCUMENT,
        definitions: [
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
              {
                kind: Kind.FIELD_DEFINITION,
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

      const result = emitSdlContent(doc);

      expect(result.includes("type User"));
      expect(result.includes("id: ID!"));
      expect(result.includes("name: String!"));
    });

    it("should emit type with description", () => {
      const doc: DocumentNode = {
        kind: Kind.DOCUMENT,
        definitions: [
          {
            kind: Kind.OBJECT_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: "User" },
            description: {
              kind: Kind.STRING,
              value: "A user in the system",
              block: false,
            },
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

      const result = emitSdlContent(doc);

      expect(
        result.includes('"A user in the system"') ||
          result.includes('"""A user in the system"""'),
      );
      expect(result.includes("type User"));
    });

    it("should emit field with arguments", () => {
      const doc: DocumentNode = {
        kind: Kind.DOCUMENT,
        definitions: [
          {
            kind: Kind.OBJECT_TYPE_EXTENSION,
            name: { kind: Kind.NAME, value: "Query" },
            fields: [
              {
                kind: Kind.FIELD_DEFINITION,
                name: { kind: Kind.NAME, value: "user" },
                arguments: [
                  {
                    kind: Kind.INPUT_VALUE_DEFINITION,
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
                type: {
                  kind: Kind.NAMED_TYPE,
                  name: { kind: Kind.NAME, value: "User" },
                },
              },
            ],
          },
        ],
      };

      const result = emitSdlContent(doc);

      expect(result.includes("extend type Query"));
      expect(result.includes("user(id: ID!): User"));
    });

    it("should emit deprecated directive", () => {
      const doc: DocumentNode = {
        kind: Kind.DOCUMENT,
        definitions: [
          {
            kind: Kind.OBJECT_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: "User" },
            fields: [
              {
                kind: Kind.FIELD_DEFINITION,
                name: { kind: Kind.NAME, value: "oldField" },
                type: {
                  kind: Kind.NAMED_TYPE,
                  name: { kind: Kind.NAME, value: "String" },
                },
                directives: [
                  {
                    kind: Kind.DIRECTIVE,
                    name: { kind: Kind.NAME, value: "deprecated" },
                    arguments: [
                      {
                        kind: Kind.ARGUMENT,
                        name: { kind: Kind.NAME, value: "reason" },
                        value: {
                          kind: Kind.STRING,
                          value: "Use newField instead",
                          block: false,
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = emitSdlContent(doc);

      expect(result.includes("@deprecated"));
      expect(result.includes("Use newField instead"));
    });

    it("should emit scalar type definition", () => {
      const doc: DocumentNode = {
        kind: Kind.DOCUMENT,
        definitions: [
          {
            kind: Kind.SCALAR_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: "DateTime" },
          },
        ],
      };

      const result = emitSdlContent(doc);

      expect(result.includes("scalar DateTime"));
    });

    it("should emit enum type definition", () => {
      const doc: DocumentNode = {
        kind: Kind.DOCUMENT,
        definitions: [
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

      const result = emitSdlContent(doc);

      expect(result.includes("enum Status"));
      expect(result.includes("ACTIVE"));
      expect(result.includes("INACTIVE"));
    });

    it("should emit union type definition", () => {
      const doc: DocumentNode = {
        kind: Kind.DOCUMENT,
        definitions: [
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
        ],
      };

      const result = emitSdlContent(doc);

      expect(result.includes("union SearchResult = User | Post"));
    });

    it("should emit input object type definition", () => {
      const doc: DocumentNode = {
        kind: Kind.DOCUMENT,
        definitions: [
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

      const result = emitSdlContent(doc);

      expect(result.includes("input CreateUserInput"));
      expect(result.includes("name: String!"));
    });

    it("should emit list types correctly", () => {
      const doc: DocumentNode = {
        kind: Kind.DOCUMENT,
        definitions: [
          {
            kind: Kind.OBJECT_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: "User" },
            fields: [
              {
                kind: Kind.FIELD_DEFINITION,
                name: { kind: Kind.NAME, value: "tags" },
                type: {
                  kind: Kind.NON_NULL_TYPE,
                  type: {
                    kind: Kind.LIST_TYPE,
                    type: {
                      kind: Kind.NON_NULL_TYPE,
                      type: {
                        kind: Kind.NAMED_TYPE,
                        name: { kind: Kind.NAME, value: "String" },
                      },
                    },
                  },
                },
              },
            ],
          },
        ],
      };

      const result = emitSdlContent(doc);

      expect(result.includes("tags: [String!]!"));
    });
  });
});
