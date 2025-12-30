import assert from "node:assert";
import { describe, it } from "node:test";
import type { ExtractResolversResult } from "../../resolver-extractor/index.js";
import type { ExtractTypesResult } from "../../type-extractor/index.js";
import { type IntegratedResult, integrate } from "./result-integrator.js";

describe("ResultIntegrator", () => {
  describe("integrate", () => {
    describe("basic structure", () => {
      it("should return IntegratedResult with expected shape", () => {
        const typesResult: ExtractTypesResult = {
          types: [],
          diagnostics: { errors: [], warnings: [] },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult);

        assert.ok(Array.isArray(result.baseTypes));
        assert.ok(Array.isArray(result.typeExtensions));
        assert.strictEqual(typeof result.hasQuery, "boolean");
        assert.strictEqual(typeof result.hasMutation, "boolean");
        assert.ok(Array.isArray(result.diagnostics));
      });

      it("should convert type-extractor types to baseTypes", () => {
        const typesResult: ExtractTypesResult = {
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
              sourceFile: "/path/to/user.ts",
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult);

        assert.strictEqual(result.baseTypes.length, 1);
        assert.strictEqual(result.baseTypes[0]?.name, "User");
        assert.strictEqual(result.baseTypes[0]?.kind, "Object");
        assert.strictEqual(result.baseTypes[0]?.fields?.length, 2);
      });

      it("should convert Union types to baseTypes", () => {
        const typesResult: ExtractTypesResult = {
          types: [
            {
              name: "SearchResult",
              kind: "Union",
              unionMembers: ["User", "Post"],
              sourceFile: "/path/to/search-result.ts",
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult);

        assert.strictEqual(result.baseTypes.length, 1);
        assert.strictEqual(result.baseTypes[0]?.name, "SearchResult");
        assert.strictEqual(result.baseTypes[0]?.kind, "Union");
        assert.deepStrictEqual(result.baseTypes[0]?.unionMembers, [
          "User",
          "Post",
        ]);
      });
    });

    describe("diagnostics propagation", () => {
      it("should propagate diagnostics from type-extractor", () => {
        const typesResult: ExtractTypesResult = {
          types: [],
          diagnostics: {
            errors: [
              {
                code: "UNRESOLVED_REFERENCE",
                message: "Type 'Unknown' is not defined",
                severity: "error",
                location: { file: "/path/to/file.ts", line: 1, column: 1 },
              },
            ],
            warnings: [],
          },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult);

        assert.strictEqual(result.diagnostics.length, 1);
        assert.strictEqual(result.diagnostics[0]?.code, "UNRESOLVED_REFERENCE");
      });

      it("should propagate diagnostics from resolver-extractor", () => {
        const typesResult: ExtractTypesResult = {
          types: [],
          diagnostics: { errors: [], warnings: [] },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: {
            errors: [
              {
                code: "INVALID_RESOLVER_SIGNATURE",
                message: "Invalid signature",
                severity: "error",
              },
            ],
            warnings: [],
          },
        };

        const result = integrate(typesResult, resolversResult);

        assert.strictEqual(result.diagnostics.length, 1);
        assert.strictEqual(
          result.diagnostics[0]?.code,
          "INVALID_RESOLVER_SIGNATURE",
        );
      });

      it("should combine diagnostics from both sources", () => {
        const typesResult: ExtractTypesResult = {
          types: [],
          diagnostics: {
            errors: [
              {
                code: "UNRESOLVED_REFERENCE",
                message: "Error 1",
                severity: "error",
              },
            ],
            warnings: [
              {
                code: "UNSUPPORTED_SYNTAX",
                message: "Warning 1",
                severity: "warning",
              },
            ],
          },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: {
            errors: [
              {
                code: "INVALID_RESOLVER_SIGNATURE",
                message: "Error 2",
                severity: "error",
              },
            ],
            warnings: [],
          },
        };

        const result = integrate(typesResult, resolversResult);

        assert.strictEqual(result.diagnostics.length, 3);
        const codes = result.diagnostics.map((d) => d.code);
        assert.ok(codes.includes("UNRESOLVED_REFERENCE"));
        assert.ok(codes.includes("UNSUPPORTED_SYNTAX"));
        assert.ok(codes.includes("INVALID_RESOLVER_SIGNATURE"));
      });
    });

    describe("Query/Mutation type integration", () => {
      it("should set hasQuery true when queryFields exist", () => {
        const typesResult: ExtractTypesResult = {
          types: [],
          diagnostics: { errors: [], warnings: [] },
        };
        const resolversResult: ExtractResolversResult = {
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
                  file: "/path/to/query.ts",
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

        const result = integrate(typesResult, resolversResult);

        assert.strictEqual(result.hasQuery, true);
        assert.strictEqual(result.hasMutation, false);
      });

      it("should set hasMutation true when mutationFields exist", () => {
        const typesResult: ExtractTypesResult = {
          types: [],
          diagnostics: { errors: [], warnings: [] },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: { fields: [] },
          mutationFields: {
            fields: [
              {
                name: "createUser",
                type: { typeName: "User", nullable: false, list: false },
                sourceLocation: {
                  file: "/path/to/mutation.ts",
                  line: 1,
                  column: 1,
                },
              },
            ],
          },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult);

        assert.strictEqual(result.hasQuery, false);
        assert.strictEqual(result.hasMutation, true);
      });

      it("should add Query base type when hasQuery is true", () => {
        const typesResult: ExtractTypesResult = {
          types: [],
          diagnostics: { errors: [], warnings: [] },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: {
            fields: [
              {
                name: "users",
                type: { typeName: "User", nullable: false, list: true },
                sourceLocation: {
                  file: "/path/to/query.ts",
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

        const result = integrate(typesResult, resolversResult);

        const queryType = result.baseTypes.find((t) => t.name === "Query");
        assert.ok(queryType);
        assert.strictEqual(queryType.kind, "Object");
        assert.strictEqual(queryType.fields?.length, 0);
      });

      it("should add Mutation base type when hasMutation is true", () => {
        const typesResult: ExtractTypesResult = {
          types: [],
          diagnostics: { errors: [], warnings: [] },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: { fields: [] },
          mutationFields: {
            fields: [
              {
                name: "createUser",
                type: { typeName: "User", nullable: false, list: false },
                sourceLocation: {
                  file: "/path/to/mutation.ts",
                  line: 1,
                  column: 1,
                },
              },
            ],
          },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult);

        const mutationType = result.baseTypes.find(
          (t) => t.name === "Mutation",
        );
        assert.ok(mutationType);
        assert.strictEqual(mutationType.kind, "Object");
        assert.strictEqual(mutationType.fields?.length, 0);
      });

      it("should not add Query base type when queryFields is empty", () => {
        const typesResult: ExtractTypesResult = {
          types: [],
          diagnostics: { errors: [], warnings: [] },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult);

        const queryType = result.baseTypes.find((t) => t.name === "Query");
        assert.strictEqual(queryType, undefined);
      });

      it("should not add Mutation base type when mutationFields is empty", () => {
        const typesResult: ExtractTypesResult = {
          types: [],
          diagnostics: { errors: [], warnings: [] },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult);

        const mutationType = result.baseTypes.find(
          (t) => t.name === "Mutation",
        );
        assert.strictEqual(mutationType, undefined);
      });

      it("should create Query typeExtension with fields", () => {
        const typesResult: ExtractTypesResult = {
          types: [],
          diagnostics: { errors: [], warnings: [] },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: {
            fields: [
              {
                name: "users",
                type: { typeName: "User", nullable: false, list: true },
                args: [
                  {
                    name: "limit",
                    type: { typeName: "Int", nullable: true, list: false },
                  },
                ],
                sourceLocation: {
                  file: "/path/to/query.ts",
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
                  file: "/path/to/query.ts",
                  line: 5,
                  column: 1,
                },
              },
            ],
          },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult);

        const queryExtension = result.typeExtensions.find(
          (t) => t.targetTypeName === "Query",
        );
        assert.ok(queryExtension);
        assert.strictEqual(queryExtension.fields.length, 2);

        const usersField = queryExtension.fields.find(
          (f) => f.name === "users",
        );
        assert.ok(usersField);
        assert.strictEqual(usersField.type.typeName, "User");
        assert.strictEqual(usersField.args?.length, 1);
        assert.strictEqual(usersField.args?.[0]?.name, "limit");
      });

      it("should create Mutation typeExtension with fields", () => {
        const typesResult: ExtractTypesResult = {
          types: [],
          diagnostics: { errors: [], warnings: [] },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: { fields: [] },
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
                  file: "/path/to/mutation.ts",
                  line: 1,
                  column: 1,
                },
              },
            ],
          },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult);

        const mutationExtension = result.typeExtensions.find(
          (t) => t.targetTypeName === "Mutation",
        );
        assert.ok(mutationExtension);
        assert.strictEqual(mutationExtension.fields.length, 1);
        assert.strictEqual(mutationExtension.fields[0]?.name, "createUser");
      });
    });

    describe("type extension validation and separation", () => {
      it("should include resolver typeExtensions in result", () => {
        const typesResult: ExtractTypesResult = {
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
              sourceFile: "/path/to/user.ts",
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [
            {
              targetTypeName: "User",
              fields: [
                {
                  name: "posts",
                  type: { typeName: "Post", nullable: false, list: true },
                  sourceLocation: {
                    file: "/path/to/user-resolver.ts",
                    line: 1,
                    column: 1,
                  },
                },
              ],
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult);

        const userExtension = result.typeExtensions.find(
          (t) => t.targetTypeName === "User",
        );
        assert.ok(userExtension);
        assert.strictEqual(userExtension.fields.length, 1);
        assert.strictEqual(userExtension.fields[0]?.name, "posts");
        assert.strictEqual(
          userExtension.fields[0]?.resolverSourceFile,
          "/path/to/user-resolver.ts",
        );
      });

      it("should report UNKNOWN_TARGET_TYPE when typeExtension references non-existent type", () => {
        const typesResult: ExtractTypesResult = {
          types: [],
          diagnostics: { errors: [], warnings: [] },
        };
        const resolversResult: ExtractResolversResult = {
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
                    file: "/path/to/resolver.ts",
                    line: 10,
                    column: 5,
                  },
                },
              ],
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult);

        const unknownTypeError = result.diagnostics.find(
          (d) => d.code === "UNKNOWN_TARGET_TYPE",
        );
        assert.ok(unknownTypeError);
        assert.strictEqual(unknownTypeError.severity, "error");
        assert.ok(unknownTypeError.message.includes("NonExistentType"));
        assert.ok(unknownTypeError.location);
        assert.strictEqual(
          unknownTypeError.location?.file,
          "/path/to/resolver.ts",
        );
      });

      it("should not report error when typeExtension targets existing type", () => {
        const typesResult: ExtractTypesResult = {
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
              sourceFile: "/path/to/user.ts",
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [
            {
              targetTypeName: "User",
              fields: [
                {
                  name: "posts",
                  type: { typeName: "Post", nullable: false, list: true },
                  sourceLocation: {
                    file: "/path/to/user-resolver.ts",
                    line: 1,
                    column: 1,
                  },
                },
              ],
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult);

        const unknownTypeError = result.diagnostics.find(
          (d) => d.code === "UNKNOWN_TARGET_TYPE",
        );
        assert.strictEqual(unknownTypeError, undefined);
      });

      it("should keep base types and type extensions separate", () => {
        const typesResult: ExtractTypesResult = {
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
              sourceFile: "/path/to/user.ts",
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [
            {
              targetTypeName: "User",
              fields: [
                {
                  name: "posts",
                  type: { typeName: "Post", nullable: false, list: true },
                  sourceLocation: {
                    file: "/path/to/user-resolver.ts",
                    line: 1,
                    column: 1,
                  },
                },
              ],
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult);

        const userBaseType = result.baseTypes.find((t) => t.name === "User");
        assert.ok(userBaseType);
        assert.strictEqual(userBaseType.fields?.length, 2);
        const baseFieldNames = userBaseType.fields?.map((f) => f.name);
        assert.ok(baseFieldNames?.includes("id"));
        assert.ok(baseFieldNames?.includes("name"));
        assert.ok(!baseFieldNames?.includes("posts"));

        const userExtension = result.typeExtensions.find(
          (t) => t.targetTypeName === "User",
        );
        assert.ok(userExtension);
        assert.strictEqual(userExtension.fields.length, 1);
        assert.strictEqual(userExtension.fields[0]?.name, "posts");
      });
    });

    describe("error diagnostics and hasErrors flag", () => {
      it("should set hasErrors to false when no error diagnostics exist", () => {
        const typesResult: ExtractTypesResult = {
          types: [],
          diagnostics: { errors: [], warnings: [] },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult);

        assert.strictEqual(result.hasErrors, false);
      });

      it("should set hasErrors to true when error diagnostics exist in types", () => {
        const typesResult: ExtractTypesResult = {
          types: [],
          diagnostics: {
            errors: [
              {
                code: "UNRESOLVED_REFERENCE",
                message: "Error",
                severity: "error",
              },
            ],
            warnings: [],
          },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult);

        assert.strictEqual(result.hasErrors, true);
      });

      it("should set hasErrors to true when error diagnostics exist in resolvers", () => {
        const typesResult: ExtractTypesResult = {
          types: [],
          diagnostics: { errors: [], warnings: [] },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: {
            errors: [
              {
                code: "INVALID_RESOLVER_SIGNATURE",
                message: "Error",
                severity: "error",
              },
            ],
            warnings: [],
          },
        };

        const result = integrate(typesResult, resolversResult);

        assert.strictEqual(result.hasErrors, true);
      });

      it("should set hasErrors to true when UNKNOWN_TARGET_TYPE error is generated", () => {
        const typesResult: ExtractTypesResult = {
          types: [],
          diagnostics: { errors: [], warnings: [] },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [
            {
              targetTypeName: "NonExistent",
              fields: [
                {
                  name: "field",
                  type: { typeName: "String", nullable: false, list: false },
                  sourceLocation: {
                    file: "/path/to/file.ts",
                    line: 1,
                    column: 1,
                  },
                },
              ],
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult);

        assert.strictEqual(result.hasErrors, true);
      });

      it("should not set hasErrors to true for warnings only", () => {
        const typesResult: ExtractTypesResult = {
          types: [],
          diagnostics: {
            errors: [],
            warnings: [
              {
                code: "UNSUPPORTED_SYNTAX",
                message: "Warning",
                severity: "warning",
              },
            ],
          },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult);

        assert.strictEqual(result.hasErrors, false);
      });
    });

    describe("resolverExportName propagation", () => {
      it("should propagate resolverExportName for Query fields from Define API", () => {
        const typesResult: ExtractTypesResult = {
          types: [],
          diagnostics: { errors: [], warnings: [] },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: {
            fields: [
              {
                name: "users",
                type: { typeName: "User", nullable: false, list: true },
                sourceLocation: {
                  file: "/path/to/query.ts",
                  line: 1,
                  column: 1,
                },
                resolverExportName: "users",
              },
            ],
          },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult);

        const queryExtension = result.typeExtensions.find(
          (t) => t.targetTypeName === "Query",
        );
        assert.ok(queryExtension);
        assert.strictEqual(queryExtension.fields[0]?.resolverExportName, "users");
      });

      it("should propagate resolverExportName for Mutation fields from Define API", () => {
        const typesResult: ExtractTypesResult = {
          types: [],
          diagnostics: { errors: [], warnings: [] },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: { fields: [] },
          mutationFields: {
            fields: [
              {
                name: "createUser",
                type: { typeName: "User", nullable: false, list: false },
                sourceLocation: {
                  file: "/path/to/mutation.ts",
                  line: 1,
                  column: 1,
                },
                resolverExportName: "createUser",
              },
            ],
          },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult);

        const mutationExtension = result.typeExtensions.find(
          (t) => t.targetTypeName === "Mutation",
        );
        assert.ok(mutationExtension);
        assert.strictEqual(mutationExtension.fields[0]?.resolverExportName, "createUser");
      });

      it("should propagate resolverExportName for field resolvers from Define API", () => {
        const typesResult: ExtractTypesResult = {
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
              sourceFile: "/path/to/user.ts",
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: { fields: [] },
          mutationFields: { fields: [] },
          typeExtensions: [
            {
              targetTypeName: "User",
              fields: [
                {
                  name: "posts",
                  type: { typeName: "Post", nullable: false, list: true },
                  sourceLocation: {
                    file: "/path/to/user-resolver.ts",
                    line: 1,
                    column: 1,
                  },
                  resolverExportName: "posts",
                },
              ],
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult);

        const userExtension = result.typeExtensions.find(
          (t) => t.targetTypeName === "User",
        );
        assert.ok(userExtension);
        assert.strictEqual(userExtension.fields[0]?.resolverExportName, "posts");
      });

      it("should preserve undefined resolverExportName for non-Define API resolvers", () => {
        const typesResult: ExtractTypesResult = {
          types: [],
          diagnostics: { errors: [], warnings: [] },
        };
        const resolversResult: ExtractResolversResult = {
          queryFields: {
            fields: [
              {
                name: "users",
                type: { typeName: "User", nullable: false, list: true },
                sourceLocation: {
                  file: "/path/to/query.ts",
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

        const result = integrate(typesResult, resolversResult);

        const queryExtension = result.typeExtensions.find(
          (t) => t.targetTypeName === "Query",
        );
        assert.ok(queryExtension);
        assert.strictEqual(queryExtension.fields[0]?.resolverExportName, undefined);
      });
    });
  });
});
