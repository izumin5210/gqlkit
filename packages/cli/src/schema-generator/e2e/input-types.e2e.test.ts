import assert from "node:assert";
import { describe, it } from "node:test";
import { print } from "graphql";
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
          },
          fields: [
            {
              name: "id",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
            },
            {
              name: "name",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
            },
          ],
        },
        {
          metadata: {
            name: "CreateUserInput",
            kind: "interface",
            sourceFile: "/src/gql/types/create-user-input.ts",
            exportKind: "named",
          },
          fields: [
            {
              name: "name",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
            },
            {
              name: "email",
              tsType: { kind: "primitive", name: "string", nullable: true },
              optional: true,
            },
          ],
        },
      ];

      const conversionResult = convertToGraphQL(extractedTypes);

      assert.strictEqual(conversionResult.diagnostics.length, 0);
      assert.strictEqual(conversionResult.types.length, 2);
      assert.ok(
        conversionResult.types.some(
          (t) => t.kind === "Object" && t.name === "User",
        ),
      );
      assert.ok(
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
              sourceLocation: {
                file: "/src/gql/resolvers/mutations.ts",
                line: 1,
                column: 1,
              },
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
      );

      assert.strictEqual(integratedResult.baseTypes.length, 2);
      assert.strictEqual(integratedResult.inputTypes.length, 1);
      assert.strictEqual(integratedResult.hasErrors, false);

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      assert.ok(sdl.includes("type User"));
      assert.ok(sdl.includes("type Mutation"));
      assert.ok(sdl.includes("input CreateUserInput"));
      assert.ok(sdl.includes("createUser(input: CreateUserInput!): User!"));
      assert.ok(sdl.includes("name: String!"));
      assert.ok(sdl.includes("email: String"));
    });

    it("should generate schema with nested Input types", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "Post",
            kind: "interface",
            sourceFile: "/src/gql/types/post.ts",
            exportKind: "named",
          },
          fields: [
            {
              name: "id",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
            },
            {
              name: "title",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
            },
          ],
        },
        {
          metadata: {
            name: "CreatePostInput",
            kind: "interface",
            sourceFile: "/src/gql/types/create-post-input.ts",
            exportKind: "named",
          },
          fields: [
            {
              name: "title",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
            },
            {
              name: "tags",
              tsType: {
                kind: "array",
                elementType: {
                  kind: "primitive",
                  name: "string",
                  nullable: false,
                },
                nullable: false,
              },
              optional: false,
            },
            {
              name: "metadata",
              tsType: {
                kind: "reference",
                name: "MetadataInput",
                nullable: true,
              },
              optional: true,
            },
          ],
        },
        {
          metadata: {
            name: "MetadataInput",
            kind: "interface",
            sourceFile: "/src/gql/types/metadata-input.ts",
            exportKind: "named",
          },
          fields: [
            {
              name: "key",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
            },
            {
              name: "value",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
            },
          ],
        },
      ];

      const conversionResult = convertToGraphQL(extractedTypes);
      assert.strictEqual(conversionResult.diagnostics.length, 0);

      const resolversResult: ExtractResolversResult = {
        queryFields: { fields: [] },
        mutationFields: {
          fields: [
            {
              name: "createPost",
              type: { typeName: "Post", nullable: false, list: false },
              args: [
                {
                  name: "input",
                  type: {
                    typeName: "CreatePostInput",
                    nullable: false,
                    list: false,
                  },
                },
              ],
              sourceLocation: {
                file: "/src/gql/resolvers/mutations.ts",
                line: 1,
                column: 1,
              },
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
      );

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      assert.ok(sdl.includes("input CreatePostInput"));
      assert.ok(sdl.includes("input MetadataInput"));
      assert.ok(sdl.includes("metadata: MetadataInput"));
      assert.ok(sdl.includes("tags: [String!]!"));
    });

    it("should handle Enum types in Input fields and arguments", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "Status",
            kind: "enum",
            sourceFile: "/src/gql/types/status.ts",
            exportKind: "named",
          },
          fields: [],
          enumMembers: [
            { name: "ACTIVE", value: "active" },
            { name: "INACTIVE", value: "inactive" },
          ],
        },
        {
          metadata: {
            name: "User",
            kind: "interface",
            sourceFile: "/src/gql/types/user.ts",
            exportKind: "named",
          },
          fields: [
            {
              name: "id",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
            },
            {
              name: "status",
              tsType: { kind: "reference", name: "Status", nullable: false },
              optional: false,
            },
          ],
        },
        {
          metadata: {
            name: "UpdateUserInput",
            kind: "interface",
            sourceFile: "/src/gql/types/update-user-input.ts",
            exportKind: "named",
          },
          fields: [
            {
              name: "status",
              tsType: { kind: "reference", name: "Status", nullable: true },
              optional: true,
            },
          ],
        },
      ];

      const conversionResult = convertToGraphQL(extractedTypes);
      assert.strictEqual(conversionResult.diagnostics.length, 0);

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
                  type: { typeName: "Status", nullable: false, list: false },
                },
              ],
              sourceLocation: {
                file: "/src/gql/resolvers/queries.ts",
                line: 1,
                column: 1,
              },
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
      );

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      assert.ok(sdl.includes("enum Status"));
      assert.ok(sdl.includes("ACTIVE"));
      assert.ok(sdl.includes("INACTIVE"));
      assert.ok(sdl.includes("input UpdateUserInput"));
      assert.ok(sdl.includes("usersByStatus(status: Status!): [User!]!"));
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
          },
          fields: [],
          unionMembers: ["Success", "Error"],
        },
      ];

      const conversionResult = convertToGraphQL(extractedTypes);

      assert.ok(
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
          },
          fields: [],
          enumMembers: [
            { name: "A", value: "a" },
            { name: "B", value: "b" },
          ],
        },
      ];

      const conversionResult = convertToGraphQL(extractedTypes);

      assert.ok(
        conversionResult.diagnostics.some(
          (d) => d.code === "INVALID_INPUT_TYPE",
        ),
      );
    });
  });
});
