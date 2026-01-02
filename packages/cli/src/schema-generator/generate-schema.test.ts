import assert from "node:assert";
import { describe, it } from "node:test";
import { type GenerateSchemaInput, generateSchema } from "./generate-schema.js";

describe("generateSchema", () => {
  describe("basic functionality", () => {
    it("should return GenerateSchemaResult with expected shape", () => {
      const input: GenerateSchemaInput = {
        typesResult: {
          types: [],
          diagnostics: { errors: [], warnings: [] },
        },
        resolversResult: {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        },
        outputDir: "/src/gqlkit",
      };

      const result = generateSchema(input);

      assert.strictEqual(typeof result.typeDefsCode, "string");
      assert.strictEqual(typeof result.resolversCode, "string");
      assert.ok(Array.isArray(result.diagnostics));
      assert.strictEqual(typeof result.hasErrors, "boolean");
    });

    it("should generate typeDefs code", () => {
      const input: GenerateSchemaInput = {
        typesResult: {
          types: [
            {
              name: "User",
              kind: "Object",
              fields: [
                {
                  name: "id",
                  type: { typeName: "ID", nullable: false, list: false },
                },
              ],
              sourceFile: "/src/types/user.ts",
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        },
        resolversResult: {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        },
        outputDir: "/src/gqlkit",
      };

      const result = generateSchema(input);

      assert.ok(result.typeDefsCode.includes("typeDefs"));
      assert.ok(result.typeDefsCode.includes("User"));
    });

    it("should generate resolvers code", () => {
      const input: GenerateSchemaInput = {
        typesResult: {
          types: [],
          diagnostics: { errors: [], warnings: [] },
        },
        resolversResult: {
          queryFields: {
            fields: [
              {
                name: "users",
                type: { typeName: "User", nullable: false, list: true },
                sourceLocation: {
                  file: "/src/resolvers/query.ts",
                  line: 1,
                  column: 1,
                },
              },
            ],
          },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        },
        outputDir: "/src/gqlkit",
      };

      const result = generateSchema(input);

      assert.ok(result.resolversCode.includes("resolvers"));
      assert.ok(result.resolversCode.includes("queryResolver"));
    });
  });

  describe("error handling", () => {
    it("should report hasErrors when type errors exist", () => {
      const input: GenerateSchemaInput = {
        typesResult: {
          types: [],
          diagnostics: {
            errors: [
              {
                code: "UNRESOLVED_REFERENCE",
                message: "Type error",
                severity: "error",
              },
            ],
            warnings: [],
          },
        },
        resolversResult: {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        },
        outputDir: "/src/gqlkit",
      };

      const result = generateSchema(input);

      assert.strictEqual(result.hasErrors, true);
      assert.strictEqual(result.diagnostics.length, 1);
    });

    it("should report hasErrors when resolver errors exist", () => {
      const input: GenerateSchemaInput = {
        typesResult: {
          types: [],
          diagnostics: { errors: [], warnings: [] },
        },
        resolversResult: {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: {
            errors: [
              {
                code: "INVALID_RESOLVER_SIGNATURE",
                message: "Resolver error",
                severity: "error",
              },
            ],
            warnings: [],
          },
        },
        outputDir: "/src/gqlkit",
      };

      const result = generateSchema(input);

      assert.strictEqual(result.hasErrors, true);
    });

    it("should report UNKNOWN_TARGET_TYPE for invalid type extensions", () => {
      const input: GenerateSchemaInput = {
        typesResult: {
          types: [],
          diagnostics: { errors: [], warnings: [] },
        },
        resolversResult: {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [
            {
              targetTypeName: "NonExistentType",
              fields: [
                {
                  name: "field",
                  type: { typeName: "String", nullable: false, list: false },
                  sourceLocation: {
                    file: "/src/resolver.ts",
                    line: 1,
                    column: 1,
                  },
                },
              ],
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        },
        outputDir: "/src/gqlkit",
      };

      const result = generateSchema(input);

      assert.strictEqual(result.hasErrors, true);
      assert.ok(
        result.diagnostics.some((d) => d.code === "UNKNOWN_TARGET_TYPE"),
      );
    });

    it("should still generate code even with errors", () => {
      const input: GenerateSchemaInput = {
        typesResult: {
          types: [
            {
              name: "User",
              kind: "Object",
              fields: [
                {
                  name: "id",
                  type: { typeName: "ID", nullable: false, list: false },
                },
              ],
              sourceFile: "/src/types/user.ts",
            },
          ],
          diagnostics: {
            errors: [
              {
                code: "UNRESOLVED_REFERENCE",
                message: "Some error",
                severity: "error",
              },
            ],
            warnings: [],
          },
        },
        resolversResult: {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        },
        outputDir: "/src/gqlkit",
      };

      const result = generateSchema(input);

      assert.strictEqual(result.hasErrors, true);
      assert.ok(result.typeDefsCode.length > 0);
    });
  });

  describe("integration", () => {
    it("should generate complete schema from types and resolvers", () => {
      const input: GenerateSchemaInput = {
        typesResult: {
          types: [
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
              sourceFile: "/src/types/user.ts",
            },
            {
              name: "Post",
              kind: "Object",
              fields: [
                {
                  name: "id",
                  type: { typeName: "ID", nullable: false, list: false },
                },
                {
                  name: "title",
                  type: { typeName: "String", nullable: false, list: false },
                },
              ],
              sourceFile: "/src/types/post.ts",
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        },
        resolversResult: {
          queryFields: {
            fields: [
              {
                name: "users",
                type: {
                  typeName: "User",
                  nullable: false,
                  list: true,
                  listItemNullable: false,
                },
                sourceLocation: {
                  file: "/src/resolvers/query.ts",
                  line: 1,
                  column: 1,
                },
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
                sourceLocation: {
                  file: "/src/resolvers/query.ts",
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
                  file: "/src/resolvers/mutation.ts",
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
                    file: "/src/resolvers/user.ts",
                    line: 1,
                    column: 1,
                  },
                },
              ],
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        },
        outputDir: "/src/gqlkit",
      };

      const result = generateSchema(input);

      assert.strictEqual(result.hasErrors, false);
      assert.ok(result.typeDefsCode.includes("Query"));
      assert.ok(result.typeDefsCode.includes("Mutation"));
      assert.ok(result.typeDefsCode.includes("User"));
      assert.ok(result.typeDefsCode.includes("Post"));
      assert.ok(result.resolversCode.includes("queryResolver"));
      assert.ok(result.resolversCode.includes("mutationResolver"));
      assert.ok(result.resolversCode.includes("userResolver"));
    });

    it("should produce deterministic output", () => {
      const input: GenerateSchemaInput = {
        typesResult: {
          types: [
            {
              name: "Zebra",
              kind: "Object",
              fields: [
                {
                  name: "id",
                  type: { typeName: "ID", nullable: false, list: false },
                },
              ],
              sourceFile: "/src/types/zebra.ts",
            },
            {
              name: "Apple",
              kind: "Object",
              fields: [
                {
                  name: "id",
                  type: { typeName: "ID", nullable: false, list: false },
                },
              ],
              sourceFile: "/src/types/apple.ts",
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        },
        resolversResult: {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        },
        outputDir: "/src/gqlkit",
      };

      const result1 = generateSchema(input);
      const result2 = generateSchema(input);

      assert.strictEqual(result1.typeDefsCode, result2.typeDefsCode);
      assert.strictEqual(result1.resolversCode, result2.resolversCode);

      const appleIndex = result1.typeDefsCode.indexOf("Apple");
      const zebraIndex = result1.typeDefsCode.indexOf("Zebra");
      assert.ok(appleIndex < zebraIndex);
    });
  });

  describe("SDL output", () => {
    it("should generate sdlContent in result", () => {
      const input: GenerateSchemaInput = {
        typesResult: {
          types: [
            {
              name: "User",
              kind: "Object",
              fields: [
                {
                  name: "id",
                  type: { typeName: "ID", nullable: false, list: false },
                },
              ],
              sourceFile: "/src/types/user.ts",
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        },
        resolversResult: {
          queryFields: {
            fields: [
              {
                name: "user",
                type: { typeName: "User", nullable: true, list: false },
                sourceLocation: {
                  file: "/src/resolvers/query.ts",
                  line: 1,
                  column: 1,
                },
              },
            ],
          },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        },
        outputDir: "/src/gqlkit",
      };

      const result = generateSchema(input);

      assert.ok(result.sdlContent);
      assert.ok(result.sdlContent.includes("type User"));
      assert.ok(result.sdlContent.includes("type Query"));
      assert.ok(result.sdlContent.includes("id: ID!"));
    });

    it("should include descriptions in SDL", () => {
      const input: GenerateSchemaInput = {
        typesResult: {
          types: [
            {
              name: "User",
              kind: "Object",
              description: "A user in the system",
              fields: [
                {
                  name: "id",
                  type: { typeName: "ID", nullable: false, list: false },
                  description: "Unique identifier",
                },
              ],
              sourceFile: "/src/types/user.ts",
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        },
        resolversResult: {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        },
        outputDir: "/src/gqlkit",
      };

      const result = generateSchema(input);

      assert.ok(result.sdlContent);
      assert.ok(
        result.sdlContent.includes("A user in the system") ||
          result.sdlContent.includes('"A user in the system"'),
      );
    });
  });

  describe("pruning", () => {
    it("should not prune by default", () => {
      const input: GenerateSchemaInput = {
        typesResult: {
          types: [
            {
              name: "User",
              kind: "Object",
              fields: [
                {
                  name: "id",
                  type: { typeName: "ID", nullable: false, list: false },
                },
              ],
              sourceFile: "/src/types/user.ts",
            },
            {
              name: "UnusedType",
              kind: "Object",
              fields: [
                {
                  name: "id",
                  type: { typeName: "ID", nullable: false, list: false },
                },
              ],
              sourceFile: "/src/types/unused.ts",
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        },
        resolversResult: {
          queryFields: {
            fields: [
              {
                name: "user",
                type: { typeName: "User", nullable: true, list: false },
                sourceLocation: {
                  file: "/src/resolvers/query.ts",
                  line: 1,
                  column: 1,
                },
              },
            ],
          },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        },
        outputDir: "/src/gqlkit",
      };

      const result = generateSchema(input);

      assert.ok(result.sdlContent?.includes("UnusedType"));
      assert.strictEqual(result.prunedTypes, undefined);
    });

    it("should prune unused types when enablePruning is true", () => {
      const input: GenerateSchemaInput = {
        typesResult: {
          types: [
            {
              name: "User",
              kind: "Object",
              fields: [
                {
                  name: "id",
                  type: { typeName: "ID", nullable: false, list: false },
                },
              ],
              sourceFile: "/src/types/user.ts",
            },
            {
              name: "UnusedType",
              kind: "Object",
              fields: [
                {
                  name: "id",
                  type: { typeName: "ID", nullable: false, list: false },
                },
              ],
              sourceFile: "/src/types/unused.ts",
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        },
        resolversResult: {
          queryFields: {
            fields: [
              {
                name: "user",
                type: { typeName: "User", nullable: true, list: false },
                sourceLocation: {
                  file: "/src/resolvers/query.ts",
                  line: 1,
                  column: 1,
                },
              },
            ],
          },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        },
        outputDir: "/src/gqlkit",
        enablePruning: true,
      };

      const result = generateSchema(input);

      assert.ok(result.sdlContent);
      assert.ok(!result.sdlContent.includes("UnusedType"));
      assert.ok(result.prunedTypes);
      assert.ok(result.prunedTypes.includes("UnusedType"));
    });

    it("should keep custom scalars when pruning", () => {
      const input: GenerateSchemaInput = {
        typesResult: {
          types: [
            {
              name: "User",
              kind: "Object",
              fields: [
                {
                  name: "id",
                  type: { typeName: "ID", nullable: false, list: false },
                },
              ],
              sourceFile: "/src/types/user.ts",
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        },
        resolversResult: {
          queryFields: {
            fields: [
              {
                name: "user",
                type: { typeName: "User", nullable: true, list: false },
                sourceLocation: {
                  file: "/src/resolvers/query.ts",
                  line: 1,
                  column: 1,
                },
              },
            ],
          },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        },
        outputDir: "/src/gqlkit",
        customScalarNames: ["DateTime"],
        enablePruning: true,
      };

      const result = generateSchema(input);

      assert.ok(result.sdlContent?.includes("scalar DateTime"));
    });
  });
});
