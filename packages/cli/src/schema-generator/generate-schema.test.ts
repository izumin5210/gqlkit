import { describe, expect, it } from "vitest";
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
        customScalarNames: null,
        enablePruning: null,
      };

      const result = generateSchema(input);

      expect(typeof result.typeDefsCode).toBe("string");
      expect(typeof result.resolversCode).toBe("string");
      expect(Array.isArray(result.diagnostics));
      expect(typeof result.hasErrors).toBe("boolean");
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
        customScalarNames: null,
        enablePruning: null,
      };

      const result = generateSchema(input);

      expect(result.typeDefsCode.includes("typeDefs")).toBeTruthy();
      expect(result.typeDefsCode.includes("User")).toBeTruthy();
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
                type: {
                  typeName: "User",
                  nullable: false,
                  list: true,
                  listItemNullable: false,
                },
                args: null,
                sourceLocation: {
                  file: "/src/resolvers/query.ts",
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
        },
        outputDir: "/src/gqlkit",
        customScalarNames: null,
        enablePruning: null,
      };

      const result = generateSchema(input);

      expect(result.resolversCode.includes("resolvers")).toBeTruthy();
      expect(result.resolversCode.includes("queryResolver")).toBeTruthy();
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
                location: null,
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
        customScalarNames: null,
        enablePruning: null,
      };

      const result = generateSchema(input);

      expect(result.hasErrors).toBe(true);
      expect(result.diagnostics.length).toBe(1);
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
                location: null,
              },
            ],
            warnings: [],
          },
        },
        outputDir: "/src/gqlkit",
        customScalarNames: null,
        enablePruning: null,
      };

      const result = generateSchema(input);

      expect(result.hasErrors).toBe(true);
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
                  type: {
                    typeName: "String",
                    nullable: false,
                    list: false,
                    listItemNullable: null,
                  },
                  args: null,
                  sourceLocation: {
                    file: "/src/resolver.ts",
                    line: 1,
                    column: 1,
                  },
                  resolverExportName: null,
                  description: null,
                  deprecated: null,
                },
              ],
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        },
        outputDir: "/src/gqlkit",
        customScalarNames: null,
        enablePruning: null,
      };

      const result = generateSchema(input);

      expect(result.hasErrors).toBe(true);
      expect(result.diagnostics.some((d) => d.code === "UNKNOWN_TARGET_TYPE"));
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
              sourceFile: "/src/types/user.ts",
            },
          ],
          diagnostics: {
            errors: [
              {
                code: "UNRESOLVED_REFERENCE",
                message: "Some error",
                severity: "error",
                location: null,
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
        customScalarNames: null,
        enablePruning: null,
      };

      const result = generateSchema(input);

      expect(result.hasErrors).toBe(true);
      expect(result.typeDefsCode.length > 0).toBeTruthy();
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
              sourceFile: "/src/types/user.ts",
            },
            {
              name: "Post",
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
              ],
              unionMembers: null,
              enumValues: null,
              description: null,
              deprecated: null,
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
                args: null,
                sourceLocation: {
                  file: "/src/resolvers/query.ts",
                  line: 1,
                  column: 1,
                },
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
                sourceLocation: {
                  file: "/src/resolvers/query.ts",
                  line: 5,
                  column: 1,
                },
                resolverExportName: null,
                description: null,
                deprecated: null,
              },
            ],
          },
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
                sourceLocation: {
                  file: "/src/resolvers/mutation.ts",
                  line: 1,
                  column: 1,
                },
                resolverExportName: null,
                description: null,
                deprecated: null,
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
                  args: null,
                  sourceLocation: {
                    file: "/src/resolvers/user.ts",
                    line: 1,
                    column: 1,
                  },
                  resolverExportName: null,
                  description: null,
                  deprecated: null,
                },
              ],
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        },
        outputDir: "/src/gqlkit",
        customScalarNames: null,
        enablePruning: null,
      };

      const result = generateSchema(input);

      expect(result.hasErrors).toBe(false);
      expect(result.typeDefsCode.includes("Query")).toBeTruthy();
      expect(result.typeDefsCode.includes("Mutation")).toBeTruthy();
      expect(result.typeDefsCode.includes("User")).toBeTruthy();
      expect(result.typeDefsCode.includes("Post")).toBeTruthy();
      expect(result.resolversCode.includes("queryResolver")).toBeTruthy();
      expect(result.resolversCode.includes("mutationResolver")).toBeTruthy();
      expect(result.resolversCode.includes("userResolver")).toBeTruthy();
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
              sourceFile: "/src/types/zebra.ts",
            },
            {
              name: "Apple",
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
        customScalarNames: null,
        enablePruning: null,
      };

      const result1 = generateSchema(input);
      const result2 = generateSchema(input);

      expect(result1.typeDefsCode).toBe(result2.typeDefsCode);
      expect(result1.resolversCode).toBe(result2.resolversCode);

      const appleIndex = result1.typeDefsCode.indexOf("Apple");
      const zebraIndex = result1.typeDefsCode.indexOf("Zebra");
      expect(appleIndex < zebraIndex).toBeTruthy();
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
                type: {
                  typeName: "User",
                  nullable: true,
                  list: false,
                  listItemNullable: null,
                },
                args: null,
                sourceLocation: {
                  file: "/src/resolvers/query.ts",
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
        },
        outputDir: "/src/gqlkit",
        customScalarNames: null,
        enablePruning: null,
      };

      const result = generateSchema(input);

      expect(result.sdlContent).toBeTruthy();
      expect(result.sdlContent.includes("type User")).toBeTruthy();
      expect(result.sdlContent.includes("type Query")).toBeTruthy();
      expect(result.sdlContent.includes("id: ID!")).toBeTruthy();
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
                  type: {
                    typeName: "ID",
                    nullable: false,
                    list: false,
                    listItemNullable: null,
                  },
                  description: "Unique identifier",
                  deprecated: null,
                },
              ],
              unionMembers: null,
              enumValues: null,
              deprecated: null,
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
        customScalarNames: null,
        enablePruning: null,
      };

      const result = generateSchema(input);

      expect(result.sdlContent).toBeTruthy();
      expect(
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
              sourceFile: "/src/types/user.ts",
            },
            {
              name: "UnusedType",
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
                type: {
                  typeName: "User",
                  nullable: true,
                  list: false,
                  listItemNullable: null,
                },
                args: null,
                sourceLocation: {
                  file: "/src/resolvers/query.ts",
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
        },
        outputDir: "/src/gqlkit",
        customScalarNames: null,
        enablePruning: null,
      };

      const result = generateSchema(input);

      expect(result.sdlContent?.includes("UnusedType")).toBeTruthy();
      expect(result.prunedTypes == null).toBeTruthy();
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
              sourceFile: "/src/types/user.ts",
            },
            {
              name: "UnusedType",
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
                type: {
                  typeName: "User",
                  nullable: true,
                  list: false,
                  listItemNullable: null,
                },
                args: null,
                sourceLocation: {
                  file: "/src/resolvers/query.ts",
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
        },
        outputDir: "/src/gqlkit",
        customScalarNames: null,
        enablePruning: true,
      };

      const result = generateSchema(input);

      expect(result.sdlContent).toBeTruthy();
      expect(!result.sdlContent.includes("UnusedType")).toBeTruthy();
      expect(result.prunedTypes).toBeTruthy();
      expect(result.prunedTypes?.includes("UnusedType")).toBeTruthy();
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
                type: {
                  typeName: "User",
                  nullable: true,
                  list: false,
                  listItemNullable: null,
                },
                args: null,
                sourceLocation: {
                  file: "/src/resolvers/query.ts",
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
        },
        outputDir: "/src/gqlkit",
        customScalarNames: ["DateTime"],
        enablePruning: true,
      };

      const result = generateSchema(input);

      expect(result.sdlContent?.includes("scalar DateTime")).toBeTruthy();
    });
  });
});
