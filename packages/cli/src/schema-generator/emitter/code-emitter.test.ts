import assert from "node:assert";
import { describe, it } from "node:test";
import { Kind } from "graphql";
import type { IntegratedResult } from "../integrator/result-integrator.js";
import type { ResolverInfo } from "../resolver-collector/resolver-collector.js";
import {
  type CodeEmitterResult,
  emitResolversCode,
  emitTypeDefsCode,
} from "./code-emitter.js";

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

    it("should reference field resolvers correctly", () => {
      const resolverInfo: ResolverInfo = {
        types: [
          {
            typeName: "Query",
            fields: [
              {
                fieldName: "users",
                sourceFile: "/src/resolvers/query.ts",
                resolverValueName: "queryResolver",
              },
              {
                fieldName: "user",
                sourceFile: "/src/resolvers/query.ts",
                resolverValueName: "queryResolver",
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
});
