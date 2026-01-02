import { describe, expect, it } from "vitest";
import type { IntegratedResult } from "../integrator/result-integrator.js";
import { collectResolverInfo } from "./resolver-collector.js";

describe("ResolverCollector", () => {
  describe("collectResolverInfo", () => {
    describe("basic structure", () => {
      it("should return ResolverInfo with expected shape", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [],
          inputTypes: [],
          typeExtensions: [],
          hasQuery: false,
          hasMutation: false,
          hasErrors: false,
          diagnostics: [],
        };

        const info = collectResolverInfo(integratedResult);

        expect(Array.isArray(info.types));
        expect(Array.isArray(info.sourceFiles));
      });

      it("should extract source files from type extensions", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [{ name: "Query", kind: "Object", fields: [] }],
          inputTypes: [],
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

        expect(info.sourceFiles.includes("/src/resolvers/query.ts"));
        expect(info.sourceFiles.length, 1);
      });
    });

    describe("resolver classification", () => {
      it("should classify Query fields into Query type", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [{ name: "Query", kind: "Object", fields: [] }],
          inputTypes: [],
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
        expect(queryType);
        expect(queryType.fields.length, 1);
        expect(queryType.fields[0]?.fieldName, "users");
      });

      it("should classify Mutation fields into Mutation type", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [{ name: "Mutation", kind: "Object", fields: [] }],
          inputTypes: [],
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
        expect(mutationType);
        expect(mutationType.fields.length, 1);
        expect(mutationType.fields[0]?.fieldName, "createUser");
      });

      it("should classify non-root type fields separately", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [{ name: "User", kind: "Object", fields: [] }],
          inputTypes: [],
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
        expect(userType);
        expect(userType.fields.length, 1);
        expect(userType.fields[0]?.fieldName, "posts");
      });

      it("should collect resolver values from source files", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [{ name: "Query", kind: "Object", fields: [] }],
          inputTypes: [],
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
        expect(queryType);
        expect(queryType.fields[0]?.sourceFile, "/src/resolvers/query.ts");
        expect(queryType.fields[0]?.resolverValueName, "queryResolver");
      });
    });

    describe("deterministic output", () => {
      it("should sort types by name", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [
            { name: "User", kind: "Object", fields: [] },
            { name: "Post", kind: "Object", fields: [] },
          ],
          inputTypes: [],
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

        expect(info.types[0]?.typeName, "Post");
        expect(info.types[1]?.typeName, "User");
      });

      it("should sort source files", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [{ name: "Query", kind: "Object", fields: [] }],
          inputTypes: [],
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

        expect(info.sourceFiles[0], "/src/resolvers/a-query.ts");
        expect(info.sourceFiles[1], "/src/resolvers/z-query.ts");
      });

      it("should sort fields within each type by name", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [{ name: "Query", kind: "Object", fields: [] }],
          inputTypes: [],
          typeExtensions: [
            {
              targetTypeName: "Query",
              fields: [
                {
                  name: "zebra",
                  type: { typeName: "String", nullable: false, list: false },
                  resolverSourceFile: "/src/resolvers/query.ts",
                  resolverExportName: "zebra",
                },
                {
                  name: "apple",
                  type: { typeName: "String", nullable: false, list: false },
                  resolverSourceFile: "/src/resolvers/query.ts",
                  resolverExportName: "apple",
                },
                {
                  name: "mango",
                  type: { typeName: "String", nullable: false, list: false },
                  resolverSourceFile: "/src/resolvers/query.ts",
                  resolverExportName: "mango",
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
        expect(queryType);
        expect(queryType.fields[0]?.fieldName, "apple");
        expect(queryType.fields[1]?.fieldName, "mango");
        expect(queryType.fields[2]?.fieldName, "zebra");
      });
    });

    describe("direct export handling", () => {
      it("should set isDirectExport to true when resolverExportName is provided", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [{ name: "Query", kind: "Object", fields: [] }],
          inputTypes: [],
          typeExtensions: [
            {
              targetTypeName: "Query",
              fields: [
                {
                  name: "users",
                  type: { typeName: "User", nullable: false, list: true },
                  resolverSourceFile: "/src/resolvers/query.ts",
                  resolverExportName: "users",
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
        expect(queryType);
        expect(queryType.fields[0]?.isDirectExport, true);
        expect(queryType.fields[0]?.resolverValueName, "users");
      });

      it("should set isDirectExport to false when resolverExportName is not provided", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [{ name: "Query", kind: "Object", fields: [] }],
          inputTypes: [],
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
        expect(queryType);
        expect(queryType.fields[0]?.isDirectExport, false);
        expect(queryType.fields[0]?.resolverValueName, "queryResolver");
      });

      it("should use resolverExportName as resolverValueName when available", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [{ name: "User", kind: "Object", fields: [] }],
          inputTypes: [],
          typeExtensions: [
            {
              targetTypeName: "User",
              fields: [
                {
                  name: "posts",
                  type: { typeName: "Post", nullable: false, list: true },
                  resolverSourceFile: "/src/resolvers/user-fields.ts",
                  resolverExportName: "posts_",
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
        expect(userType);
        expect(userType.fields[0]?.resolverValueName, "posts_");
        expect(userType.fields[0]?.isDirectExport, true);
      });

      it("should use fallback naming when resolverExportName is not provided", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [{ name: "User", kind: "Object", fields: [] }],
          inputTypes: [],
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
        expect(userType);
        expect(userType.fields[0]?.resolverValueName, "userResolver");
        expect(userType.fields[0]?.isDirectExport, false);
      });

      it("should handle mixed direct and indirect exports in same type", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [{ name: "Query", kind: "Object", fields: [] }],
          inputTypes: [],
          typeExtensions: [
            {
              targetTypeName: "Query",
              fields: [
                {
                  name: "directField",
                  type: { typeName: "String", nullable: false, list: false },
                  resolverSourceFile: "/src/resolvers/query.ts",
                  resolverExportName: "directField",
                },
                {
                  name: "indirectField",
                  type: { typeName: "String", nullable: false, list: false },
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
        expect(queryType);

        const directField = queryType.fields.find(
          (f) => f.fieldName === "directField",
        );
        expect(directField);
        expect(directField.isDirectExport, true);
        expect(directField.resolverValueName, "directField");

        const indirectField = queryType.fields.find(
          (f) => f.fieldName === "indirectField",
        );
        expect(indirectField);
        expect(indirectField.isDirectExport, false);
        expect(indirectField.resolverValueName, "queryResolver");
      });
    });
  });
});
