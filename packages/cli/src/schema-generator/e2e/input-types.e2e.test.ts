import { print } from "graphql";
import { describe, expect, it } from "vitest";
import type { ExtractResolversResult } from "../../resolver-extractor/index.js";
import { convertToGraphQL } from "../../type-extractor/converter/graphql-converter.js";
import type { ExtractedTypeInfo } from "../../type-extractor/types/index.js";
import { buildDocumentNode } from "../builder/ast-builder.js";
import { integrate } from "../integrator/result-integrator.js";

describe("E2E: Input Types and Resolver Arguments", () => {
  describe("Full pipeline with Input types", () => {
    it("should generate schema with Input Object types", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "User",
            kind: "interface",
            sourceFile: "/src/gql/types/user.ts",
            exportKind: "named",
            description: null,
            deprecated: null,
          },
          fields: [
            {
              name: "id",
              tsType: {
                kind: "primitive",
                name: "string",
                nullable: false,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: false,
              description: null,
              deprecated: null,
            },
            {
              name: "name",
              tsType: {
                kind: "primitive",
                name: "string",
                nullable: false,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: false,
              description: null,
              deprecated: null,
            },
          ],
          unionMembers: null,
          enumMembers: null,
        },
        {
          metadata: {
            name: "CreateUserInput",
            kind: "interface",
            sourceFile: "/src/gql/types/create-user-input.ts",
            exportKind: "named",
            description: null,
            deprecated: null,
          },
          fields: [
            {
              name: "name",
              tsType: {
                kind: "primitive",
                name: "string",
                nullable: false,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: false,
              description: null,
              deprecated: null,
            },
            {
              name: "email",
              tsType: {
                kind: "primitive",
                name: "string",
                nullable: true,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: true,
              description: null,
              deprecated: null,
            },
          ],
          unionMembers: null,
          enumMembers: null,
        },
      ];

      const conversionResult = convertToGraphQL(extractedTypes);

      expect(conversionResult.diagnostics.length).toBe(0);
      expect(conversionResult.types.length).toBe(2);
      expect(
        conversionResult.types.some(
          (t) => t.kind === "Object" && t.name === "User",
        ),
      );
      expect(
        conversionResult.types.some(
          (t) => t.kind === "InputObject" && t.name === "CreateUserInput",
        ),
      );

      const resolversResult: ExtractResolversResult = {
        queryFields: { fields: [] },
        mutationFields: {
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
              sourceLocation: {
                file: "/src/gql/resolvers/mutations.ts",
                line: 1,
                column: 1,
              },
              resolverExportName: null,
              description: null,
              deprecated: null,
            },
          ],
        },
        typeExtensions: [],
        diagnostics: { errors: [], warnings: [] },
      };

      const integratedResult = integrate(
        {
          types: conversionResult.types,
          diagnostics: { errors: [], warnings: [] },
        },
        resolversResult,
        null,
      );

      expect(integratedResult.baseTypes.length).toBe(2);
      expect(integratedResult.inputTypes.length).toBe(1);
      expect(integratedResult.hasErrors).toBe(false);

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes("type User")).toBeTruthy();
      expect(sdl.includes("type Mutation")).toBeTruthy();
      expect(sdl.includes("input CreateUserInput")).toBeTruthy();
      expect(sdl.includes("createUser(input: CreateUserInput!): User!"));
      expect(sdl.includes("name: String!")).toBeTruthy();
      expect(sdl.includes("email: String")).toBeTruthy();
    });

    it("should generate schema with nested Input types", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "Post",
            kind: "interface",
            sourceFile: "/src/gql/types/post.ts",
            exportKind: "named",
            description: null,
            deprecated: null,
          },
          fields: [
            {
              name: "id",
              tsType: {
                kind: "primitive",
                name: "string",
                nullable: false,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: false,
              description: null,
              deprecated: null,
            },
            {
              name: "title",
              tsType: {
                kind: "primitive",
                name: "string",
                nullable: false,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: false,
              description: null,
              deprecated: null,
            },
          ],
          unionMembers: null,
          enumMembers: null,
        },
        {
          metadata: {
            name: "CreatePostInput",
            kind: "interface",
            sourceFile: "/src/gql/types/create-post-input.ts",
            exportKind: "named",
            description: null,
            deprecated: null,
          },
          fields: [
            {
              name: "title",
              tsType: {
                kind: "primitive",
                name: "string",
                nullable: false,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: false,
              description: null,
              deprecated: null,
            },
            {
              name: "tags",
              tsType: {
                kind: "array",
                name: null,
                elementType: {
                  kind: "primitive",
                  name: "string",
                  nullable: false,
                  elementType: null,
                  members: null,
                  scalarInfo: null,
                },
                members: null,
                nullable: false,
                scalarInfo: null,
              },
              optional: false,
              description: null,
              deprecated: null,
            },
            {
              name: "metadata",
              tsType: {
                kind: "reference",
                name: "MetadataInput",
                nullable: true,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: true,
              description: null,
              deprecated: null,
            },
          ],
          unionMembers: null,
          enumMembers: null,
        },
        {
          metadata: {
            name: "MetadataInput",
            kind: "interface",
            sourceFile: "/src/gql/types/metadata-input.ts",
            exportKind: "named",
            description: null,
            deprecated: null,
          },
          fields: [
            {
              name: "key",
              tsType: {
                kind: "primitive",
                name: "string",
                nullable: false,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: false,
              description: null,
              deprecated: null,
            },
            {
              name: "value",
              tsType: {
                kind: "primitive",
                name: "string",
                nullable: false,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: false,
              description: null,
              deprecated: null,
            },
          ],
          unionMembers: null,
          enumMembers: null,
        },
      ];

      const conversionResult = convertToGraphQL(extractedTypes);
      expect(conversionResult.diagnostics.length).toBe(0);

      const resolversResult: ExtractResolversResult = {
        queryFields: { fields: [] },
        mutationFields: {
          fields: [
            {
              name: "createPost",
              type: {
                typeName: "Post",
                nullable: false,
                list: false,
                listItemNullable: null,
              },
              args: [
                {
                  name: "input",
                  type: {
                    typeName: "CreatePostInput",
                    nullable: false,
                    list: false,
                    listItemNullable: null,
                  },
                  description: null,
                  deprecated: null,
                },
              ],
              sourceLocation: {
                file: "/src/gql/resolvers/mutations.ts",
                line: 1,
                column: 1,
              },
              resolverExportName: null,
              description: null,
              deprecated: null,
            },
          ],
        },
        typeExtensions: [],
        diagnostics: { errors: [], warnings: [] },
      };

      const integratedResult = integrate(
        {
          types: conversionResult.types,
          diagnostics: { errors: [], warnings: [] },
        },
        resolversResult,
        null,
      );

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes("input CreatePostInput")).toBeTruthy();
      expect(sdl.includes("input MetadataInput")).toBeTruthy();
      expect(sdl.includes("metadata: MetadataInput")).toBeTruthy();
      expect(sdl.includes("tags: [String!]!")).toBeTruthy();
    });

    it("should handle Enum types in Input fields and arguments", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "Status",
            kind: "enum",
            sourceFile: "/src/gql/types/status.ts",
            exportKind: "named",
            description: null,
            deprecated: null,
          },
          fields: [],
          unionMembers: null,
          enumMembers: [
            {
              name: "ACTIVE",
              value: "active",
              description: null,
              deprecated: null,
            },
            {
              name: "INACTIVE",
              value: "inactive",
              description: null,
              deprecated: null,
            },
          ],
        },
        {
          metadata: {
            name: "User",
            kind: "interface",
            sourceFile: "/src/gql/types/user.ts",
            exportKind: "named",
            description: null,
            deprecated: null,
          },
          fields: [
            {
              name: "id",
              tsType: {
                kind: "primitive",
                name: "string",
                nullable: false,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: false,
              description: null,
              deprecated: null,
            },
            {
              name: "status",
              tsType: {
                kind: "reference",
                name: "Status",
                nullable: false,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: false,
              description: null,
              deprecated: null,
            },
          ],
          unionMembers: null,
          enumMembers: null,
        },
        {
          metadata: {
            name: "UpdateUserInput",
            kind: "interface",
            sourceFile: "/src/gql/types/update-user-input.ts",
            exportKind: "named",
            description: null,
            deprecated: null,
          },
          fields: [
            {
              name: "status",
              tsType: {
                kind: "reference",
                name: "Status",
                nullable: true,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: true,
              description: null,
              deprecated: null,
            },
          ],
          unionMembers: null,
          enumMembers: null,
        },
      ];

      const conversionResult = convertToGraphQL(extractedTypes);
      expect(conversionResult.diagnostics.length).toBe(0);

      const resolversResult: ExtractResolversResult = {
        queryFields: {
          fields: [
            {
              name: "usersByStatus",
              type: {
                typeName: "User",
                nullable: false,
                list: true,
                listItemNullable: false,
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
              sourceLocation: {
                file: "/src/gql/resolvers/queries.ts",
                line: 1,
                column: 1,
              },
              resolverExportName: null,
              description: null,
              deprecated: null,
            },
          ],
        },
        mutationFields: { fields: [] },
        typeExtensions: [],
        diagnostics: { errors: [], warnings: [] },
      };

      const integratedResult = integrate(
        {
          types: conversionResult.types,
          diagnostics: { errors: [], warnings: [] },
        },
        resolversResult,
        null,
      );

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes("enum Status")).toBeTruthy();
      expect(sdl.includes("ACTIVE")).toBeTruthy();
      expect(sdl.includes("INACTIVE")).toBeTruthy();
      expect(sdl.includes("input UpdateUserInput")).toBeTruthy();
      expect(sdl.includes("usersByStatus(status: Status!): [User!]!"));
    });
  });

  describe("Error detection", () => {
    it("should detect union type with *Input suffix", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "ResultInput",
            kind: "union",
            sourceFile: "/src/gql/types/result-input.ts",
            exportKind: "named",
            description: null,
            deprecated: null,
          },
          fields: [],
          unionMembers: ["Success", "Error"],
          enumMembers: null,
        },
      ];

      const conversionResult = convertToGraphQL(extractedTypes);

      expect(
        conversionResult.diagnostics.some(
          (d) => d.code === "INVALID_INPUT_TYPE",
        ),
      );
    });

    it("should detect enum type with *Input suffix", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "StatusInput",
            kind: "enum",
            sourceFile: "/src/gql/types/status-input.ts",
            exportKind: "named",
            description: null,
            deprecated: null,
          },
          fields: [],
          unionMembers: null,
          enumMembers: [
            { name: "A", value: "a", description: null, deprecated: null },
            { name: "B", value: "b", description: null, deprecated: null },
          ],
        },
      ];

      const conversionResult = convertToGraphQL(extractedTypes);

      expect(
        conversionResult.diagnostics.some(
          (d) => d.code === "INVALID_INPUT_TYPE",
        ),
      );
    });
  });
});
