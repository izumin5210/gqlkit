import assert from "node:assert";
import { describe, it } from "node:test";
import type { IntegratedResult } from "../integrator/result-integrator.js";
import {
  collectResolverInfo,
  type ResolverInfo,
  type TypeResolvers,
} from "./resolver-collector.js";

describe("ResolverCollector", () => {
  describe("collectResolverInfo", () => {
    describe("basic structure", () => {
      it("should return ResolverInfo with expected shape", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [],
          typeExtensions: [],
          hasQuery: false,
          hasMutation: false,
          hasErrors: false,
          diagnostics: [],
        };

        const info = collectResolverInfo(integratedResult);

        assert.ok(Array.isArray(info.types));
        assert.ok(Array.isArray(info.sourceFiles));
      });

      it("should extract source files from type extensions", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [{ name: "Query", kind: "Object", fields: [] }],
          typeExtensions: [
            {
              targetTypeName: "Query",
              fields: [
                {
                  name: "users",
                  type: { typeName: "User", nullable: false, list: true },
                  resolverSourceFile: "/src/resolvers/query.ts",
                },
                {
                  name: "user",
                  type: { typeName: "User", nullable: true, list: false },
                  resolverSourceFile: "/src/resolvers/query.ts",
                },
              ],
            },
          ],
          hasQuery: true,
          hasMutation: false,
          hasErrors: false,
          diagnostics: [],
        };

        const info = collectResolverInfo(integratedResult);

        assert.ok(info.sourceFiles.includes("/src/resolvers/query.ts"));
        assert.strictEqual(info.sourceFiles.length, 1);
      });
    });

    describe("resolver classification", () => {
      it("should classify Query fields into Query type", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [{ name: "Query", kind: "Object", fields: [] }],
          typeExtensions: [
            {
              targetTypeName: "Query",
              fields: [
                {
                  name: "users",
                  type: { typeName: "User", nullable: false, list: true },
                  resolverSourceFile: "/src/resolvers/query.ts",
                },
              ],
            },
          ],
          hasQuery: true,
          hasMutation: false,
          hasErrors: false,
          diagnostics: [],
        };

        const info = collectResolverInfo(integratedResult);

        const queryType = info.types.find((t) => t.typeName === "Query");
        assert.ok(queryType);
        assert.strictEqual(queryType.fields.length, 1);
        assert.strictEqual(queryType.fields[0]?.fieldName, "users");
      });

      it("should classify Mutation fields into Mutation type", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [{ name: "Mutation", kind: "Object", fields: [] }],
          typeExtensions: [
            {
              targetTypeName: "Mutation",
              fields: [
                {
                  name: "createUser",
                  type: { typeName: "User", nullable: false, list: false },
                  resolverSourceFile: "/src/resolvers/mutation.ts",
                },
              ],
            },
          ],
          hasQuery: false,
          hasMutation: true,
          hasErrors: false,
          diagnostics: [],
        };

        const info = collectResolverInfo(integratedResult);

        const mutationType = info.types.find((t) => t.typeName === "Mutation");
        assert.ok(mutationType);
        assert.strictEqual(mutationType.fields.length, 1);
        assert.strictEqual(mutationType.fields[0]?.fieldName, "createUser");
      });

      it("should classify non-root type fields separately", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [{ name: "User", kind: "Object", fields: [] }],
          typeExtensions: [
            {
              targetTypeName: "User",
              fields: [
                {
                  name: "posts",
                  type: { typeName: "Post", nullable: false, list: true },
                  resolverSourceFile: "/src/resolvers/user.ts",
                },
              ],
            },
          ],
          hasQuery: false,
          hasMutation: false,
          hasErrors: false,
          diagnostics: [],
        };

        const info = collectResolverInfo(integratedResult);

        const userType = info.types.find((t) => t.typeName === "User");
        assert.ok(userType);
        assert.strictEqual(userType.fields.length, 1);
        assert.strictEqual(userType.fields[0]?.fieldName, "posts");
      });

      it("should collect resolver values from source files", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [{ name: "Query", kind: "Object", fields: [] }],
          typeExtensions: [
            {
              targetTypeName: "Query",
              fields: [
                {
                  name: "users",
                  type: { typeName: "User", nullable: false, list: true },
                  resolverSourceFile: "/src/resolvers/query.ts",
                },
              ],
            },
          ],
          hasQuery: true,
          hasMutation: false,
          hasErrors: false,
          diagnostics: [],
        };

        const info = collectResolverInfo(integratedResult);

        const queryType = info.types.find((t) => t.typeName === "Query");
        assert.ok(queryType);
        assert.strictEqual(
          queryType.fields[0]?.sourceFile,
          "/src/resolvers/query.ts",
        );
        assert.strictEqual(
          queryType.fields[0]?.resolverValueName,
          "queryResolver",
        );
      });
    });

    describe("deterministic output", () => {
      it("should sort types by name", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [
            { name: "User", kind: "Object", fields: [] },
            { name: "Post", kind: "Object", fields: [] },
          ],
          typeExtensions: [
            {
              targetTypeName: "User",
              fields: [
                {
                  name: "posts",
                  type: { typeName: "Post", nullable: false, list: true },
                  resolverSourceFile: "/src/resolvers/user.ts",
                },
              ],
            },
            {
              targetTypeName: "Post",
              fields: [
                {
                  name: "author",
                  type: { typeName: "User", nullable: false, list: false },
                  resolverSourceFile: "/src/resolvers/post.ts",
                },
              ],
            },
          ],
          hasQuery: false,
          hasMutation: false,
          hasErrors: false,
          diagnostics: [],
        };

        const info = collectResolverInfo(integratedResult);

        assert.strictEqual(info.types[0]?.typeName, "Post");
        assert.strictEqual(info.types[1]?.typeName, "User");
      });

      it("should sort source files", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [{ name: "Query", kind: "Object", fields: [] }],
          typeExtensions: [
            {
              targetTypeName: "Query",
              fields: [
                {
                  name: "users",
                  type: { typeName: "User", nullable: false, list: true },
                  resolverSourceFile: "/src/resolvers/z-query.ts",
                },
                {
                  name: "posts",
                  type: { typeName: "Post", nullable: false, list: true },
                  resolverSourceFile: "/src/resolvers/a-query.ts",
                },
              ],
            },
          ],
          hasQuery: true,
          hasMutation: false,
          hasErrors: false,
          diagnostics: [],
        };

        const info = collectResolverInfo(integratedResult);

        assert.strictEqual(info.sourceFiles[0], "/src/resolvers/a-query.ts");
        assert.strictEqual(info.sourceFiles[1], "/src/resolvers/z-query.ts");
      });
    });
  });
});
