import { describe, expect, it } from "vitest";
import type { ExtractResolversResult } from "../../resolver-extractor/index.js";
import { convertToGraphQL } from "../../type-extractor/converter/graphql-converter.js";
import type { ExtractedTypeInfo } from "../../type-extractor/types/typescript.js";
import { generateSchema } from "../generate-schema.js";

describe("E2E: Schema Output Options", () => {
  function createTypesResult(types: ExtractedTypeInfo[]) {
    const conversionResult = convertToGraphQL(types);
    return {
      types: conversionResult.types,
      diagnostics: { errors: [], warnings: [] },
    };
  }

  describe("SDL output", () => {
    it("should generate valid SDL with complete schema", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "User",
            kind: "interface",
            sourceFile: "/src/gql/types/user.ts",
            exportKind: "named",
            description: "A user in the system",
          },
          fields: [
            {
              name: "id",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
              description: "Unique identifier",
            },
            {
              name: "name",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
              description: "Display name",
            },
            {
              name: "email",
              tsType: { kind: "primitive", name: "string", nullable: true },
              optional: true,
            },
          ],
        },
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
      ];

      const typesResult = createTypesResult(extractedTypes);

      const resolversResult: ExtractResolversResult = {
        queryFields: {
          fields: [
            {
              name: "user",
              type: { typeName: "User", nullable: true, list: false },
              args: [
                {
                  name: "id",
                  type: { typeName: "ID", nullable: false, list: false },
                },
              ],
              sourceLocation: {
                file: "/src/gql/resolvers/query.ts",
                line: 1,
                column: 1,
              },
              description: "Get a user by ID",
            },
            {
              name: "users",
              type: {
                typeName: "User",
                nullable: false,
                list: true,
                listItemNullable: false,
              },
              sourceLocation: {
                file: "/src/gql/resolvers/query.ts",
                line: 5,
                column: 1,
              },
            },
          ],
        },
        mutationFields: {
          fields: [
            {
              name: "createUser",
              type: { typeName: "User", nullable: false, list: false },
              args: [
                {
                  name: "name",
                  type: { typeName: "String", nullable: false, list: false },
                },
              ],
              sourceLocation: {
                file: "/src/gql/resolvers/mutation.ts",
                line: 1,
                column: 1,
              },
            },
          ],
        },
        typeExtensions: [
          {
            targetTypeName: "User",
            fields: [
              {
                name: "posts",
                type: {
                  typeName: "Post",
                  nullable: false,
                  list: true,
                  listItemNullable: false,
                },
                sourceLocation: {
                  file: "/src/gql/resolvers/user.ts",
                  line: 1,
                  column: 1,
                },
              },
            ],
          },
        ],
        diagnostics: { errors: [], warnings: [] },
      };

      const result = generateSchema({
        typesResult,
        resolversResult,
        outputDir: "/src/gqlkit/generated",
      });

      expect(!result.hasErrors);
      expect(result.sdlContent);

      expect(result.sdlContent.includes("type User"));
      expect(result.sdlContent.includes("type Post"));
      expect(result.sdlContent.includes("type Query"));
      expect(result.sdlContent.includes("type Mutation"));

      expect(result.sdlContent.includes("user(id: ID!): User"));
      expect(result.sdlContent.includes("users: [User!]!"));
      expect(result.sdlContent.includes("createUser(name: String!): User!"));

      expect(
        result.sdlContent.includes('"A user in the system"') ||
          result.sdlContent.includes('"""A user in the system"""'),
      );
    });

    it("should include deprecated directives in SDL", () => {
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
              name: "legacyId",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
              deprecated: { isDeprecated: true, reason: "Use id instead" },
            },
          ],
        },
      ];

      const typesResult = createTypesResult(extractedTypes);

      const resolversResult: ExtractResolversResult = {
        queryFields: {
          fields: [
            {
              name: "oldEndpoint",
              type: { typeName: "User", nullable: true, list: false },
              sourceLocation: {
                file: "/src/gql/resolvers/query.ts",
                line: 1,
                column: 1,
              },
              deprecated: { isDeprecated: true, reason: "Use newEndpoint" },
            },
          ],
        },
        mutationFields: { fields: [] },
        typeExtensions: [],
        diagnostics: { errors: [], warnings: [] },
      };

      const result = generateSchema({
        typesResult,
        resolversResult,
        outputDir: "/src/gqlkit/generated",
      });

      expect(!result.hasErrors);
      expect(result.sdlContent);
      expect(
        result.sdlContent.includes('@deprecated(reason: "Use id instead")'),
      );
      expect(
        result.sdlContent.includes('@deprecated(reason: "Use newEndpoint")'),
      );
    });

    it("should include custom scalars in SDL", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "Event",
            kind: "interface",
            sourceFile: "/src/gql/types/event.ts",
            exportKind: "named",
          },
          fields: [
            {
              name: "id",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
            },
          ],
        },
      ];

      const typesResult = createTypesResult(extractedTypes);

      const resolversResult: ExtractResolversResult = {
        queryFields: { fields: [] },
        mutationFields: { fields: [] },
        typeExtensions: [],
        diagnostics: { errors: [], warnings: [] },
      };

      const result = generateSchema({
        typesResult,
        resolversResult,
        outputDir: "/src/gqlkit/generated",
        customScalarNames: ["DateTime", "UUID"],
      });

      expect(!result.hasErrors);
      expect(result.sdlContent);
      expect(result.sdlContent.includes("scalar DateTime"));
      expect(result.sdlContent.includes("scalar UUID"));
    });
  });

  describe("Pruning", () => {
    it("should remove unused types when pruning is enabled", () => {
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
          ],
        },
        {
          metadata: {
            name: "UnusedType",
            kind: "interface",
            sourceFile: "/src/gql/types/unused.ts",
            exportKind: "named",
          },
          fields: [
            {
              name: "data",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
            },
          ],
        },
        {
          metadata: {
            name: "AnotherUnused",
            kind: "interface",
            sourceFile: "/src/gql/types/another.ts",
            exportKind: "named",
          },
          fields: [
            {
              name: "value",
              tsType: { kind: "primitive", name: "number", nullable: false },
              optional: false,
            },
          ],
        },
      ];

      const typesResult = createTypesResult(extractedTypes);

      const resolversResult: ExtractResolversResult = {
        queryFields: {
          fields: [
            {
              name: "user",
              type: { typeName: "User", nullable: true, list: false },
              sourceLocation: {
                file: "/src/gql/resolvers/query.ts",
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

      const result = generateSchema({
        typesResult,
        resolversResult,
        outputDir: "/src/gqlkit/generated",
        enablePruning: true,
      });

      expect(!result.hasErrors);
      expect(result.sdlContent);

      expect(result.sdlContent.includes("type User"));
      expect(!result.sdlContent.includes("UnusedType"));
      expect(!result.sdlContent.includes("AnotherUnused"));

      expect(result.prunedTypes);
      expect(result.prunedTypes.includes("UnusedType"));
      expect(result.prunedTypes.includes("AnotherUnused"));
    });

    it("should keep transitively referenced types", () => {
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
              name: "profile",
              tsType: { kind: "reference", name: "Profile", nullable: true },
              optional: true,
            },
          ],
        },
        {
          metadata: {
            name: "Profile",
            kind: "interface",
            sourceFile: "/src/gql/types/profile.ts",
            exportKind: "named",
          },
          fields: [
            {
              name: "bio",
              tsType: { kind: "primitive", name: "string", nullable: true },
              optional: true,
            },
          ],
        },
        {
          metadata: {
            name: "UnusedType",
            kind: "interface",
            sourceFile: "/src/gql/types/unused.ts",
            exportKind: "named",
          },
          fields: [
            {
              name: "data",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
            },
          ],
        },
      ];

      const typesResult = createTypesResult(extractedTypes);

      const resolversResult: ExtractResolversResult = {
        queryFields: {
          fields: [
            {
              name: "user",
              type: { typeName: "User", nullable: true, list: false },
              sourceLocation: {
                file: "/src/gql/resolvers/query.ts",
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

      const result = generateSchema({
        typesResult,
        resolversResult,
        outputDir: "/src/gqlkit/generated",
        enablePruning: true,
      });

      expect(!result.hasErrors);
      expect(result.sdlContent);

      expect(result.sdlContent.includes("type User"));
      expect(result.sdlContent.includes("type Profile"));
      expect(!result.sdlContent.includes("UnusedType"));

      expect(result.prunedTypes);
      expect(result.prunedTypes.includes("UnusedType"));
      expect(!result.prunedTypes.includes("Profile"));
    });

    it("should keep custom scalars when pruning", () => {
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
          ],
        },
      ];

      const typesResult = createTypesResult(extractedTypes);

      const resolversResult: ExtractResolversResult = {
        queryFields: {
          fields: [
            {
              name: "user",
              type: { typeName: "User", nullable: true, list: false },
              sourceLocation: {
                file: "/src/gql/resolvers/query.ts",
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

      const result = generateSchema({
        typesResult,
        resolversResult,
        outputDir: "/src/gqlkit/generated",
        customScalarNames: ["DateTime"],
        enablePruning: true,
      });

      expect(!result.hasErrors);
      expect(result.sdlContent);
      expect(result.sdlContent.includes("scalar DateTime"));
      expect(result.prunedTypes);
      expect(!result.prunedTypes.includes("DateTime"));
    });
  });

  describe("SDL and AST consistency", () => {
    it("should generate equivalent schemas in both formats", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "User",
            kind: "interface",
            sourceFile: "/src/gql/types/user.ts",
            exportKind: "named",
            description: "A user",
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
      ];

      const typesResult = createTypesResult(extractedTypes);

      const resolversResult: ExtractResolversResult = {
        queryFields: {
          fields: [
            {
              name: "user",
              type: { typeName: "User", nullable: true, list: false },
              sourceLocation: {
                file: "/src/gql/resolvers/query.ts",
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

      const result = generateSchema({
        typesResult,
        resolversResult,
        outputDir: "/src/gqlkit/generated",
      });

      expect(!result.hasErrors);
      expect(result.sdlContent);
      expect(result.typeDefsCode);

      expect(result.typeDefsCode.includes("User"));
      expect(result.sdlContent.includes("type User"));
    });
  });
});
