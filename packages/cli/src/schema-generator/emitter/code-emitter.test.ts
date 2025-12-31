import assert from "node:assert";
import { describe, it } from "node:test";
import type { IntegratedResult } from "../integrator/result-integrator.js";
import type { ResolverInfo } from "../resolver-collector/resolver-collector.js";
import { emitResolversCode, emitTypeDefsCode } from "./code-emitter.js";

describe("CodeEmitter", () => {
  describe("emitTypeDefsCode", () => {
    it("should generate typeDefs TypeScript code", () => {
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
        typeExtensions: [],
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
      };

      const code = emitTypeDefsCode(integratedResult);

      assert.ok(code.includes("import type { DocumentNode }"));
      assert.ok(code.includes("export const typeDefs: DocumentNode"));
      assert.ok(code.includes('"User"'));
    });

    it("should include all type definitions", () => {
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

      const code = emitTypeDefsCode(integratedResult);

      assert.ok(code.includes("Query"));
      assert.ok(code.includes("User"));
      assert.ok(code.includes("ObjectTypeExtension"));
    });

    it("should handle union types", () => {
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

      const code = emitTypeDefsCode(integratedResult);

      assert.ok(code.includes("UnionTypeDefinition"));
      assert.ok(code.includes("SearchResult"));
    });
  });

  describe("emitResolversCode", () => {
    describe("basic functionality", () => {
      it("should generate resolvers TypeScript code", () => {
        const resolverInfo: ResolverInfo = {
          types: [
            {
              typeName: "Query",
              fields: [
                {
                  fieldName: "users",
                  sourceFile: "/src/resolvers/query.ts",
                  resolverValueName: "queryResolver",
                  isDirectExport: false,
                },
              ],
            },
          ],
          sourceFiles: ["/src/resolvers/query.ts"],
        };

        const code = emitResolversCode(resolverInfo, "/src/gqlkit");

        assert.ok(code.includes("import"));
        assert.ok(code.includes("queryResolver"));
        assert.ok(code.includes("export const resolvers"));
      });

      it("should generate correct import paths", () => {
        const resolverInfo: ResolverInfo = {
          types: [
            {
              typeName: "Query",
              fields: [
                {
                  fieldName: "users",
                  sourceFile: "/src/resolvers/query.ts",
                  resolverValueName: "queryResolver",
                  isDirectExport: false,
                },
              ],
            },
          ],
          sourceFiles: ["/src/resolvers/query.ts"],
        };

        const code = emitResolversCode(resolverInfo, "/src/gqlkit");

        assert.ok(code.includes("../resolvers/query.js"));
      });

      it("should include all types in resolver map", () => {
        const resolverInfo: ResolverInfo = {
          types: [
            {
              typeName: "Query",
              fields: [
                {
                  fieldName: "users",
                  sourceFile: "/src/resolvers/query.ts",
                  resolverValueName: "queryResolver",
                  isDirectExport: false,
                },
              ],
            },
            {
              typeName: "User",
              fields: [
                {
                  fieldName: "posts",
                  sourceFile: "/src/resolvers/user.ts",
                  resolverValueName: "userResolver",
                  isDirectExport: false,
                },
              ],
            },
          ],
          sourceFiles: ["/src/resolvers/query.ts", "/src/resolvers/user.ts"],
        };

        const code = emitResolversCode(resolverInfo, "/src/gqlkit");

        assert.ok(code.includes("Query:"));
        assert.ok(code.includes("User:"));
      });
    });

    describe("indirect export (legacy) handling", () => {
      it("should reference field resolvers correctly for indirect exports", () => {
        const resolverInfo: ResolverInfo = {
          types: [
            {
              typeName: "Query",
              fields: [
                {
                  fieldName: "users",
                  sourceFile: "/src/resolvers/query.ts",
                  resolverValueName: "queryResolver",
                  isDirectExport: false,
                },
                {
                  fieldName: "user",
                  sourceFile: "/src/resolvers/query.ts",
                  resolverValueName: "queryResolver",
                  isDirectExport: false,
                },
              ],
            },
          ],
          sourceFiles: ["/src/resolvers/query.ts"],
        };

        const code = emitResolversCode(resolverInfo, "/src/gqlkit");

        assert.ok(code.includes("users: queryResolver.users"));
        assert.ok(code.includes("user: queryResolver.user"));
      });
    });

    describe("direct export (Define API) handling", () => {
      it("should use direct assignment for direct exports", () => {
        const resolverInfo: ResolverInfo = {
          types: [
            {
              typeName: "Query",
              fields: [
                {
                  fieldName: "users",
                  sourceFile: "/src/resolvers/queries.ts",
                  resolverValueName: "users",
                  isDirectExport: true,
                },
              ],
            },
          ],
          sourceFiles: ["/src/resolvers/queries.ts"],
        };

        const code = emitResolversCode(resolverInfo, "/src/gqlkit");

        assert.ok(code.includes("users: users,"));
        assert.ok(!code.includes("users: users.users"));
      });

      it("should import direct export names correctly", () => {
        const resolverInfo: ResolverInfo = {
          types: [
            {
              typeName: "Query",
              fields: [
                {
                  fieldName: "me",
                  sourceFile: "/src/resolvers/queries.ts",
                  resolverValueName: "me",
                  isDirectExport: true,
                },
                {
                  fieldName: "allUsers",
                  sourceFile: "/src/resolvers/queries.ts",
                  resolverValueName: "allUsers",
                  isDirectExport: true,
                },
              ],
            },
          ],
          sourceFiles: ["/src/resolvers/queries.ts"],
        };

        const code = emitResolversCode(resolverInfo, "/src/gqlkit");

        assert.ok(code.includes("import { allUsers, me }"));
      });

      it("should generate complete resolver map for Define API resolvers", () => {
        const resolverInfo: ResolverInfo = {
          types: [
            {
              typeName: "Mutation",
              fields: [
                {
                  fieldName: "createUser",
                  sourceFile: "/src/resolvers/mutations.ts",
                  resolverValueName: "createUser",
                  isDirectExport: true,
                },
              ],
            },
            {
              typeName: "Query",
              fields: [
                {
                  fieldName: "allUsers",
                  sourceFile: "/src/resolvers/queries.ts",
                  resolverValueName: "allUsers",
                  isDirectExport: true,
                },
                {
                  fieldName: "me",
                  sourceFile: "/src/resolvers/queries.ts",
                  resolverValueName: "me",
                  isDirectExport: true,
                },
              ],
            },
            {
              typeName: "User",
              fields: [
                {
                  fieldName: "displayName",
                  sourceFile: "/src/resolvers/user-fields.ts",
                  resolverValueName: "displayName",
                  isDirectExport: true,
                },
                {
                  fieldName: "posts_",
                  sourceFile: "/src/resolvers/user-fields.ts",
                  resolverValueName: "posts_",
                  isDirectExport: true,
                },
              ],
            },
          ],
          sourceFiles: [
            "/src/resolvers/mutations.ts",
            "/src/resolvers/queries.ts",
            "/src/resolvers/user-fields.ts",
          ],
        };

        const code = emitResolversCode(resolverInfo, "/src/gqlkit");

        assert.ok(
          code.includes(
            'import { createUser } from "../resolvers/mutations.js";',
          ),
        );
        assert.ok(
          code.includes(
            'import { allUsers, me } from "../resolvers/queries.js";',
          ),
        );
        assert.ok(
          code.includes(
            'import { displayName, posts_ } from "../resolvers/user-fields.js";',
          ),
        );

        assert.ok(code.includes("Mutation: {"));
        assert.ok(code.includes("createUser: createUser,"));
        assert.ok(code.includes("Query: {"));
        assert.ok(code.includes("allUsers: allUsers,"));
        assert.ok(code.includes("me: me,"));
        assert.ok(code.includes("User: {"));
        assert.ok(code.includes("displayName: displayName,"));
        assert.ok(code.includes("posts_: posts_,"));
      });
    });

    describe("import path handling", () => {
      it("should add ./ prefix when relative path does not start with .", () => {
        const resolverInfo: ResolverInfo = {
          types: [
            {
              typeName: "Query",
              fields: [
                {
                  fieldName: "users",
                  sourceFile: "/src/gqlkit/resolvers/query.ts",
                  resolverValueName: "users",
                  isDirectExport: true,
                },
              ],
            },
          ],
          sourceFiles: ["/src/gqlkit/resolvers/query.ts"],
        };

        const code = emitResolversCode(resolverInfo, "/src/gqlkit");

        assert.ok(code.includes('./resolvers/query.js"'));
      });

      it("should convert .ts extension to .js for ESM compatibility", () => {
        const resolverInfo: ResolverInfo = {
          types: [
            {
              typeName: "Query",
              fields: [
                {
                  fieldName: "users",
                  sourceFile: "/src/resolvers/query.ts",
                  resolverValueName: "users",
                  isDirectExport: true,
                },
              ],
            },
          ],
          sourceFiles: ["/src/resolvers/query.ts"],
        };

        const code = emitResolversCode(resolverInfo, "/src/gqlkit");

        assert.ok(code.includes(".js"));
        assert.ok(!code.includes(".ts"));
      });

      it("should combine multiple imports from same file", () => {
        const resolverInfo: ResolverInfo = {
          types: [
            {
              typeName: "Query",
              fields: [
                {
                  fieldName: "users",
                  sourceFile: "/src/resolvers/query.ts",
                  resolverValueName: "users",
                  isDirectExport: true,
                },
                {
                  fieldName: "posts",
                  sourceFile: "/src/resolvers/query.ts",
                  resolverValueName: "posts",
                  isDirectExport: true,
                },
              ],
            },
          ],
          sourceFiles: ["/src/resolvers/query.ts"],
        };

        const code = emitResolversCode(resolverInfo, "/src/gqlkit");

        const importMatches = code.match(
          /import \{.*\} from "\.\.\/resolvers\/query\.js";/g,
        );
        assert.strictEqual(importMatches?.length, 1);
        assert.ok(code.includes("import { posts, users }"));
      });

      it("should sort import statements by path", () => {
        const resolverInfo: ResolverInfo = {
          types: [
            {
              typeName: "Query",
              fields: [
                {
                  fieldName: "users",
                  sourceFile: "/src/resolvers/z-query.ts",
                  resolverValueName: "users",
                  isDirectExport: true,
                },
                {
                  fieldName: "posts",
                  sourceFile: "/src/resolvers/a-query.ts",
                  resolverValueName: "posts",
                  isDirectExport: true,
                },
              ],
            },
          ],
          sourceFiles: [
            "/src/resolvers/a-query.ts",
            "/src/resolvers/z-query.ts",
          ],
        };

        const code = emitResolversCode(resolverInfo, "/src/gqlkit");

        const aQueryIndex = code.indexOf("a-query.js");
        const zQueryIndex = code.indexOf("z-query.js");
        assert.ok(aQueryIndex < zQueryIndex);
      });
    });

    describe("deterministic output", () => {
      it("should produce same output for same input", () => {
        const resolverInfo: ResolverInfo = {
          types: [
            {
              typeName: "Query",
              fields: [
                {
                  fieldName: "users",
                  sourceFile: "/src/resolvers/queries.ts",
                  resolverValueName: "users",
                  isDirectExport: true,
                },
              ],
            },
          ],
          sourceFiles: ["/src/resolvers/queries.ts"],
        };

        const code1 = emitResolversCode(resolverInfo, "/src/gqlkit");
        const code2 = emitResolversCode(resolverInfo, "/src/gqlkit");

        assert.strictEqual(code1, code2);
      });
    });
  });
});
