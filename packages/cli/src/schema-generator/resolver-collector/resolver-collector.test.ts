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
          customScalarNames: null,
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
          baseTypes: [
            {
              name: "Query",
              kind: "Object",
              fields: [],
              unionMembers: null,
              enumValues: null,
              description: null,
              deprecated: null,
              sourceFile: null,
            },
          ],
          inputTypes: [],
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
                  args: null,
                  resolverSourceFile: "/src/resolvers/query.ts",
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
                  args: null,
                  resolverSourceFile: "/src/resolvers/query.ts",
                  resolverExportName: null,
                  description: null,
                  deprecated: null,
                },
              ],
            },
          ],
          customScalarNames: null,
          hasQuery: true,
          hasMutation: false,
          hasErrors: false,
          diagnostics: [],
        };

        const info = collectResolverInfo(integratedResult);

        expect(
          info.sourceFiles.includes("/src/resolvers/query.ts"),
        ).toBeTruthy();
        expect(info.sourceFiles.length).toBe(1);
      });
    });

    describe("resolver classification", () => {
      it("should classify Query fields into Query type", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [
            {
              name: "Query",
              kind: "Object",
              fields: [],
              unionMembers: null,
              enumValues: null,
              description: null,
              deprecated: null,
              sourceFile: null,
            },
          ],
          inputTypes: [],
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
                  args: null,
                  resolverSourceFile: "/src/resolvers/query.ts",
                  resolverExportName: null,
                  description: null,
                  deprecated: null,
                },
              ],
            },
          ],
          customScalarNames: null,
          hasQuery: true,
          hasMutation: false,
          hasErrors: false,
          diagnostics: [],
        };

        const info = collectResolverInfo(integratedResult);

        const queryType = info.types.find((t) => t.typeName === "Query");
        expect(queryType).toBeTruthy();
        expect(queryType!.fields.length).toBe(1);
        expect(queryType!.fields[0]?.fieldName).toBe("users");
      });

      it("should classify Mutation fields into Mutation type", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [
            {
              name: "Mutation",
              kind: "Object",
              fields: [],
              unionMembers: null,
              enumValues: null,
              description: null,
              deprecated: null,
              sourceFile: null,
            },
          ],
          inputTypes: [],
          typeExtensions: [
            {
              targetTypeName: "Mutation",
              fields: [
                {
                  name: "createUser",
                  type: {
                    typeName: "User",
                    nullable: false,
                    list: false,
                    listItemNullable: null,
                  },
                  args: null,
                  resolverSourceFile: "/src/resolvers/mutation.ts",
                  resolverExportName: null,
                  description: null,
                  deprecated: null,
                },
              ],
            },
          ],
          customScalarNames: null,
          hasQuery: false,
          hasMutation: true,
          hasErrors: false,
          diagnostics: [],
        };

        const info = collectResolverInfo(integratedResult);

        const mutationType = info.types.find((t) => t.typeName === "Mutation");
        expect(mutationType).toBeTruthy();
        expect(mutationType!.fields.length).toBe(1);
        expect(mutationType!.fields[0]?.fieldName).toBe("createUser");
      });

      it("should classify non-root type fields separately", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [
            {
              name: "User",
              kind: "Object",
              fields: [],
              unionMembers: null,
              enumValues: null,
              description: null,
              deprecated: null,
              sourceFile: null,
            },
          ],
          inputTypes: [],
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
                  resolverSourceFile: "/src/resolvers/user.ts",
                  resolverExportName: null,
                  description: null,
                  deprecated: null,
                },
              ],
            },
          ],
          customScalarNames: null,
          hasQuery: false,
          hasMutation: false,
          hasErrors: false,
          diagnostics: [],
        };

        const info = collectResolverInfo(integratedResult);

        const userType = info.types.find((t) => t.typeName === "User");
        expect(userType).toBeTruthy();
        expect(userType!.fields.length).toBe(1);
        expect(userType!.fields[0]?.fieldName).toBe("posts");
      });

      it("should collect resolver values from source files", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [
            {
              name: "Query",
              kind: "Object",
              fields: [],
              unionMembers: null,
              enumValues: null,
              description: null,
              deprecated: null,
              sourceFile: null,
            },
          ],
          inputTypes: [],
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
                  args: null,
                  resolverSourceFile: "/src/resolvers/query.ts",
                  resolverExportName: null,
                  description: null,
                  deprecated: null,
                },
              ],
            },
          ],
          customScalarNames: null,
          hasQuery: true,
          hasMutation: false,
          hasErrors: false,
          diagnostics: [],
        };

        const info = collectResolverInfo(integratedResult);

        const queryType = info.types.find((t) => t.typeName === "Query");
        expect(queryType).toBeTruthy();
        expect(queryType!.fields[0]?.sourceFile).toBe(
          "/src/resolvers/query.ts",
        );
        expect(queryType!.fields[0]?.resolverValueName).toBe("queryResolver");
      });
    });

    describe("deterministic output", () => {
      it("should sort types by name", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [
            {
              name: "User",
              kind: "Object",
              fields: [],
              unionMembers: null,
              enumValues: null,
              description: null,
              deprecated: null,
              sourceFile: null,
            },
            {
              name: "Post",
              kind: "Object",
              fields: [],
              unionMembers: null,
              enumValues: null,
              description: null,
              deprecated: null,
              sourceFile: null,
            },
          ],
          inputTypes: [],
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
                  resolverSourceFile: "/src/resolvers/user.ts",
                  resolverExportName: null,
                  description: null,
                  deprecated: null,
                },
              ],
            },
            {
              targetTypeName: "Post",
              fields: [
                {
                  name: "author",
                  type: {
                    typeName: "User",
                    nullable: false,
                    list: false,
                    listItemNullable: null,
                  },
                  args: null,
                  resolverSourceFile: "/src/resolvers/post.ts",
                  resolverExportName: null,
                  description: null,
                  deprecated: null,
                },
              ],
            },
          ],
          customScalarNames: null,
          hasQuery: false,
          hasMutation: false,
          hasErrors: false,
          diagnostics: [],
        };

        const info = collectResolverInfo(integratedResult);

        expect(info.types[0]?.typeName).toBe("Post");
        expect(info.types[1]?.typeName).toBe("User");
      });

      it("should sort source files", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [
            {
              name: "Query",
              kind: "Object",
              fields: [],
              unionMembers: null,
              enumValues: null,
              description: null,
              deprecated: null,
              sourceFile: null,
            },
          ],
          inputTypes: [],
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
                  args: null,
                  resolverSourceFile: "/src/resolvers/z-query.ts",
                  resolverExportName: null,
                  description: null,
                  deprecated: null,
                },
                {
                  name: "posts",
                  type: {
                    typeName: "Post",
                    nullable: false,
                    list: true,
                    listItemNullable: false,
                  },
                  args: null,
                  resolverSourceFile: "/src/resolvers/a-query.ts",
                  resolverExportName: null,
                  description: null,
                  deprecated: null,
                },
              ],
            },
          ],
          customScalarNames: null,
          hasQuery: true,
          hasMutation: false,
          hasErrors: false,
          diagnostics: [],
        };

        const info = collectResolverInfo(integratedResult);

        expect(info.sourceFiles[0]).toBe("/src/resolvers/a-query.ts");
        expect(info.sourceFiles[1]).toBe("/src/resolvers/z-query.ts");
      });

      it("should sort fields within each type by name", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [
            {
              name: "Query",
              kind: "Object",
              fields: [],
              unionMembers: null,
              enumValues: null,
              description: null,
              deprecated: null,
              sourceFile: null,
            },
          ],
          inputTypes: [],
          typeExtensions: [
            {
              targetTypeName: "Query",
              fields: [
                {
                  name: "zebra",
                  type: {
                    typeName: "String",
                    nullable: false,
                    list: false,
                    listItemNullable: null,
                  },
                  args: null,
                  resolverSourceFile: "/src/resolvers/query.ts",
                  resolverExportName: "zebra",
                  description: null,
                  deprecated: null,
                },
                {
                  name: "apple",
                  type: {
                    typeName: "String",
                    nullable: false,
                    list: false,
                    listItemNullable: null,
                  },
                  args: null,
                  resolverSourceFile: "/src/resolvers/query.ts",
                  resolverExportName: "apple",
                  description: null,
                  deprecated: null,
                },
                {
                  name: "mango",
                  type: {
                    typeName: "String",
                    nullable: false,
                    list: false,
                    listItemNullable: null,
                  },
                  args: null,
                  resolverSourceFile: "/src/resolvers/query.ts",
                  resolverExportName: "mango",
                  description: null,
                  deprecated: null,
                },
              ],
            },
          ],
          customScalarNames: null,
          hasQuery: true,
          hasMutation: false,
          hasErrors: false,
          diagnostics: [],
        };

        const info = collectResolverInfo(integratedResult);

        const queryType = info.types.find((t) => t.typeName === "Query");
        expect(queryType).toBeTruthy();
        expect(queryType!.fields[0]?.fieldName).toBe("apple");
        expect(queryType!.fields[1]?.fieldName).toBe("mango");
        expect(queryType!.fields[2]?.fieldName).toBe("zebra");
      });
    });

    describe("direct export handling", () => {
      it("should set isDirectExport to true when resolverExportName is provided", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [
            {
              name: "Query",
              kind: "Object",
              fields: [],
              unionMembers: null,
              enumValues: null,
              description: null,
              deprecated: null,
              sourceFile: null,
            },
          ],
          inputTypes: [],
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
                  args: null,
                  resolverSourceFile: "/src/resolvers/query.ts",
                  resolverExportName: "users",
                  description: null,
                  deprecated: null,
                },
              ],
            },
          ],
          customScalarNames: null,
          hasQuery: true,
          hasMutation: false,
          hasErrors: false,
          diagnostics: [],
        };

        const info = collectResolverInfo(integratedResult);

        const queryType = info.types.find((t) => t.typeName === "Query");
        expect(queryType).toBeTruthy();
        expect(queryType!.fields[0]?.isDirectExport).toBe(true);
        expect(queryType!.fields[0]?.resolverValueName).toBe("users");
      });

      it("should set isDirectExport to false when resolverExportName is not provided", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [
            {
              name: "Query",
              kind: "Object",
              fields: [],
              unionMembers: null,
              enumValues: null,
              description: null,
              deprecated: null,
              sourceFile: null,
            },
          ],
          inputTypes: [],
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
                  args: null,
                  resolverSourceFile: "/src/resolvers/query.ts",
                  resolverExportName: null,
                  description: null,
                  deprecated: null,
                },
              ],
            },
          ],
          customScalarNames: null,
          hasQuery: true,
          hasMutation: false,
          hasErrors: false,
          diagnostics: [],
        };

        const info = collectResolverInfo(integratedResult);

        const queryType = info.types.find((t) => t.typeName === "Query");
        expect(queryType).toBeTruthy();
        expect(queryType!.fields[0]?.isDirectExport).toBe(false);
        expect(queryType!.fields[0]?.resolverValueName).toBe("queryResolver");
      });

      it("should use resolverExportName as resolverValueName when available", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [
            {
              name: "User",
              kind: "Object",
              fields: [],
              unionMembers: null,
              enumValues: null,
              description: null,
              deprecated: null,
              sourceFile: null,
            },
          ],
          inputTypes: [],
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
                  resolverSourceFile: "/src/resolvers/user-fields.ts",
                  resolverExportName: "posts_",
                  description: null,
                  deprecated: null,
                },
              ],
            },
          ],
          customScalarNames: null,
          hasQuery: false,
          hasMutation: false,
          hasErrors: false,
          diagnostics: [],
        };

        const info = collectResolverInfo(integratedResult);

        const userType = info.types.find((t) => t.typeName === "User");
        expect(userType).toBeTruthy();
        expect(userType!.fields[0]?.resolverValueName).toBe("posts_");
        expect(userType!.fields[0]?.isDirectExport).toBe(true);
      });

      it("should use fallback naming when resolverExportName is not provided", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [
            {
              name: "User",
              kind: "Object",
              fields: [],
              unionMembers: null,
              enumValues: null,
              description: null,
              deprecated: null,
              sourceFile: null,
            },
          ],
          inputTypes: [],
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
                  resolverSourceFile: "/src/resolvers/user.ts",
                  resolverExportName: null,
                  description: null,
                  deprecated: null,
                },
              ],
            },
          ],
          customScalarNames: null,
          hasQuery: false,
          hasMutation: false,
          hasErrors: false,
          diagnostics: [],
        };

        const info = collectResolverInfo(integratedResult);

        const userType = info.types.find((t) => t.typeName === "User");
        expect(userType).toBeTruthy();
        expect(userType!.fields[0]?.resolverValueName).toBe("userResolver");
        expect(userType!.fields[0]?.isDirectExport).toBe(false);
      });

      it("should handle mixed direct and indirect exports in same type", () => {
        const integratedResult: IntegratedResult = {
          baseTypes: [
            {
              name: "Query",
              kind: "Object",
              fields: [],
              unionMembers: null,
              enumValues: null,
              description: null,
              deprecated: null,
              sourceFile: null,
            },
          ],
          inputTypes: [],
          typeExtensions: [
            {
              targetTypeName: "Query",
              fields: [
                {
                  name: "directField",
                  type: {
                    typeName: "String",
                    nullable: false,
                    list: false,
                    listItemNullable: null,
                  },
                  args: null,
                  resolverSourceFile: "/src/resolvers/query.ts",
                  resolverExportName: "directField",
                  description: null,
                  deprecated: null,
                },
                {
                  name: "indirectField",
                  type: {
                    typeName: "String",
                    nullable: false,
                    list: false,
                    listItemNullable: null,
                  },
                  args: null,
                  resolverSourceFile: "/src/resolvers/query.ts",
                  resolverExportName: null,
                  description: null,
                  deprecated: null,
                },
              ],
            },
          ],
          customScalarNames: null,
          hasQuery: true,
          hasMutation: false,
          hasErrors: false,
          diagnostics: [],
        };

        const info = collectResolverInfo(integratedResult);

        const queryType = info.types.find((t) => t.typeName === "Query");
        expect(queryType).toBeTruthy();

        const directField = queryType!.fields.find(
          (f) => f.fieldName === "directField",
        );
        expect(directField).toBeTruthy();
        expect(directField!.isDirectExport).toBe(true);
        expect(directField!.resolverValueName).toBe("directField");

        const indirectField = queryType!.fields.find(
          (f) => f.fieldName === "indirectField",
        );
        expect(indirectField).toBeTruthy();
        expect(indirectField!.isDirectExport).toBe(false);
        expect(indirectField!.resolverValueName).toBe("queryResolver");
      });
    });
  });
});
