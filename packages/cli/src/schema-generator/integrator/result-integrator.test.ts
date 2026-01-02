import { describe, expect, it } from "vitest";
import type { ExtractResolversResult } from "../../resolver-extractor/index.js";
import type { ExtractTypesResult } from "../../type-extractor/index.js";
import { integrate } from "./result-integrator.js";

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

        const result = integrate(typesResult, resolversResult, null);

        expect(Array.isArray(result.baseTypes));
        expect(Array.isArray(result.typeExtensions));
        expect(typeof result.hasQuery).toBe("boolean");
        expect(typeof result.hasMutation).toBe("boolean");
        expect(Array.isArray(result.diagnostics));
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
              sourceFile: "/path/to/user.ts",
              description: null,
              deprecated: null,
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

        const result = integrate(typesResult, resolversResult, null);

        expect(result.baseTypes.length).toBe(1);
        expect(result.baseTypes[0]?.name).toBe("User");
        expect(result.baseTypes[0]?.kind).toBe("Object");
        expect(result.baseTypes[0]?.fields?.length).toBe(2);
      });

      it("should convert Union types to baseTypes", () => {
        const typesResult: ExtractTypesResult = {
          types: [
            {
              name: "SearchResult",
              kind: "Union",
              fields: null,
              unionMembers: ["User", "Post"],
              enumValues: null,
              sourceFile: "/path/to/search-result.ts",
              description: null,
              deprecated: null,
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

        const result = integrate(typesResult, resolversResult, null);

        expect(result.baseTypes.length).toBe(1);
        expect(result.baseTypes[0]?.name).toBe("SearchResult");
        expect(result.baseTypes[0]?.kind).toBe("Union");
        expect(result.baseTypes[0]?.unionMembers).toEqual(["User", "Post"]);
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

        const result = integrate(typesResult, resolversResult, null);

        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("UNRESOLVED_REFERENCE");
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
                location: null,
              },
            ],
            warnings: [],
          },
        };

        const result = integrate(typesResult, resolversResult, null);

        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("INVALID_RESOLVER_SIGNATURE");
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
                location: null,
              },
            ],
            warnings: [
              {
                code: "UNSUPPORTED_SYNTAX",
                message: "Warning 1",
                severity: "warning",
                location: null,
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
                location: null,
              },
            ],
            warnings: [],
          },
        };

        const result = integrate(typesResult, resolversResult, null);

        expect(result.diagnostics.length).toBe(3);
        const codes = result.diagnostics.map((d) => d.code);
        expect(codes.includes("UNRESOLVED_REFERENCE")).toBeTruthy();
        expect(codes.includes("UNSUPPORTED_SYNTAX")).toBeTruthy();
        expect(codes.includes("INVALID_RESOLVER_SIGNATURE")).toBeTruthy();
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
                args: null,
                sourceLocation: {
                  file: "/path/to/query.ts",
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
        };

        const result = integrate(typesResult, resolversResult, null);

        expect(result.hasQuery).toBe(true);
        expect(result.hasMutation).toBe(false);
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
                type: {
                  typeName: "User",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                args: null,
                sourceLocation: {
                  file: "/path/to/mutation.ts",
                  line: 1,
                  column: 1,
                },
                resolverExportName: null,
                description: null,
                deprecated: null,
              },
            ],
          },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult, null);

        expect(result.hasQuery).toBe(false);
        expect(result.hasMutation).toBe(true);
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
                type: {
                  typeName: "User",
                  nullable: false,
                  list: true,
                  listItemNullable: null,
                },
                args: null,
                sourceLocation: {
                  file: "/path/to/query.ts",
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
        };

        const result = integrate(typesResult, resolversResult, null);

        const queryType = result.baseTypes.find((t) => t.name === "Query");
        expect(queryType).toBeTruthy();
        expect(queryType!.kind).toBe("Object");
        expect(queryType!.fields?.length).toBe(0);
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
                type: {
                  typeName: "User",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                args: null,
                sourceLocation: {
                  file: "/path/to/mutation.ts",
                  line: 1,
                  column: 1,
                },
                resolverExportName: null,
                description: null,
                deprecated: null,
              },
            ],
          },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult, null);

        const mutationType = result.baseTypes.find(
          (t) => t.name === "Mutation",
        );
        expect(mutationType).toBeTruthy();
        expect(mutationType!.kind).toBe("Object");
        expect(mutationType!.fields?.length).toBe(0);
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

        const result = integrate(typesResult, resolversResult, null);

        const queryType = result.baseTypes.find((t) => t.name === "Query");
        expect(queryType).toBe(undefined);
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

        const result = integrate(typesResult, resolversResult, null);

        const mutationType = result.baseTypes.find(
          (t) => t.name === "Mutation",
        );
        expect(mutationType).toBe(undefined);
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
                type: {
                  typeName: "User",
                  nullable: false,
                  list: true,
                  listItemNullable: null,
                },
                args: [
                  {
                    name: "limit",
                    type: {
                      typeName: "Int",
                      nullable: true,
                      list: false,
                      listItemNullable: null,
                    },
                    description: null,
                    deprecated: null,
                  },
                ],
                sourceLocation: {
                  file: "/path/to/query.ts",
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
                  file: "/path/to/query.ts",
                  line: 5,
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
        };

        const result = integrate(typesResult, resolversResult, null);

        const queryExtension = result.typeExtensions.find(
          (t) => t.targetTypeName === "Query",
        );
        expect(queryExtension).toBeTruthy();
        expect(queryExtension!.fields.length).toBe(2);

        const usersField = queryExtension!.fields.find(
          (f) => f.name === "users",
        );
        expect(usersField).toBeTruthy();
        expect(usersField!.type.typeName).toBe("User");
        expect(usersField!.args?.length).toBe(1);
        expect(usersField!.args?.[0]?.name).toBe("limit");
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
                  file: "/path/to/mutation.ts",
                  line: 1,
                  column: 1,
                },
                resolverExportName: null,
                description: null,
                deprecated: null,
              },
            ],
          },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult, null);

        const mutationExtension = result.typeExtensions.find(
          (t) => t.targetTypeName === "Mutation",
        );
        expect(mutationExtension).toBeTruthy();
        expect(mutationExtension!.fields.length).toBe(1);
        expect(mutationExtension!.fields[0]?.name).toBe("createUser");
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
              sourceFile: "/path/to/user.ts",
              description: null,
              deprecated: null,
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
                  type: {
                    typeName: "Post",
                    nullable: false,
                    list: true,
                    listItemNullable: null,
                  },
                  args: null,
                  sourceLocation: {
                    file: "/path/to/user-resolver.ts",
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
        };

        const result = integrate(typesResult, resolversResult, null);

        const userExtension = result.typeExtensions.find(
          (t) => t.targetTypeName === "User",
        );
        expect(userExtension).toBeTruthy();
        expect(userExtension!.fields.length).toBe(1);
        expect(userExtension!.fields[0]?.name).toBe("posts");
        expect(userExtension!.fields[0]?.resolverSourceFile).toBe(
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
                  type: {
                    typeName: "String",
                    nullable: false,
                    list: false,
                    listItemNullable: null,
                  },
                  args: null,
                  sourceLocation: {
                    file: "/path/to/resolver.ts",
                    line: 10,
                    column: 5,
                  },
                  resolverExportName: null,
                  description: null,
                  deprecated: null,
                },
              ],
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult, null);

        const unknownTypeError = result.diagnostics.find(
          (d) => d.code === "UNKNOWN_TARGET_TYPE",
        );
        expect(unknownTypeError).toBeTruthy();
        expect(unknownTypeError!.severity).toBe("error");
        expect(
          unknownTypeError!.message.includes("NonExistentType"),
        ).toBeTruthy();
        expect(unknownTypeError!.location).toBeTruthy();
        expect(unknownTypeError!.location?.file).toBe("/path/to/resolver.ts");
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
              sourceFile: "/path/to/user.ts",
              description: null,
              deprecated: null,
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
                  type: {
                    typeName: "Post",
                    nullable: false,
                    list: true,
                    listItemNullable: null,
                  },
                  args: null,
                  sourceLocation: {
                    file: "/path/to/user-resolver.ts",
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
        };

        const result = integrate(typesResult, resolversResult, null);

        const unknownTypeError = result.diagnostics.find(
          (d) => d.code === "UNKNOWN_TARGET_TYPE",
        );
        expect(unknownTypeError).toBe(undefined);
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
              sourceFile: "/path/to/user.ts",
              description: null,
              deprecated: null,
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
                  type: {
                    typeName: "Post",
                    nullable: false,
                    list: true,
                    listItemNullable: null,
                  },
                  args: null,
                  sourceLocation: {
                    file: "/path/to/user-resolver.ts",
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
        };

        const result = integrate(typesResult, resolversResult, null);

        const userBaseType = result.baseTypes.find((t) => t.name === "User");
        expect(userBaseType).toBeTruthy();
        expect(userBaseType!.fields?.length).toBe(2);
        const baseFieldNames = userBaseType!.fields?.map((f) => f.name);
        expect(baseFieldNames?.includes("id")).toBeTruthy();
        expect(baseFieldNames?.includes("name")).toBeTruthy();
        expect(!baseFieldNames?.includes("posts")).toBeTruthy();

        const userExtension = result.typeExtensions.find(
          (t) => t.targetTypeName === "User",
        );
        expect(userExtension).toBeTruthy();
        expect(userExtension!.fields.length).toBe(1);
        expect(userExtension!.fields[0]?.name).toBe("posts");
      });
    });

    describe("Input Object type handling", () => {
      it("should separate InputObject types into inputTypes array", () => {
        const typesResult: ExtractTypesResult = {
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
              sourceFile: "/path/to/user.ts",
              description: null,
              deprecated: null,
            },
            {
              name: "CreateUserInput",
              kind: "InputObject",
              fields: [
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
                {
                  name: "email",
                  type: {
                    typeName: "String",
                    nullable: true,
                    list: false,
                    listItemNullable: null,
                  },
                  description: null,
                  deprecated: null,
                },
              ],
              unionMembers: null,
              enumValues: null,
              sourceFile: "/path/to/create-user-input.ts",
              description: null,
              deprecated: null,
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

        const result = integrate(typesResult, resolversResult, null);

        expect(result.baseTypes.length).toBe(1);
        expect(result.baseTypes[0]?.name).toBe("User");
        expect(result.baseTypes[0]?.kind).toBe("Object");

        expect(result.inputTypes).toBeTruthy();
        expect(result.inputTypes.length).toBe(1);
        expect(result.inputTypes[0]?.name).toBe("CreateUserInput");
        expect(result.inputTypes[0]?.fields?.length).toBe(2);
      });

      it("should include all InputObject types from type-extractor", () => {
        const typesResult: ExtractTypesResult = {
          types: [
            {
              name: "CreateUserInput",
              kind: "InputObject",
              fields: [
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
              sourceFile: "/path/to/create-user-input.ts",
              description: null,
              deprecated: null,
            },
            {
              name: "UpdateUserInput",
              kind: "InputObject",
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
                    nullable: true,
                    list: false,
                    listItemNullable: null,
                  },
                  description: null,
                  deprecated: null,
                },
              ],
              unionMembers: null,
              enumValues: null,
              sourceFile: "/path/to/update-user-input.ts",
              description: null,
              deprecated: null,
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

        const result = integrate(typesResult, resolversResult, null);

        expect(result.inputTypes.length).toBe(2);
        const inputNames = result.inputTypes.map((t) => t.name);
        expect(inputNames.includes("CreateUserInput")).toBeTruthy();
        expect(inputNames.includes("UpdateUserInput")).toBeTruthy();
      });

      it("should have empty inputTypes when no InputObject types exist", () => {
        const typesResult: ExtractTypesResult = {
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
              sourceFile: "/path/to/user.ts",
              description: null,
              deprecated: null,
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

        const result = integrate(typesResult, resolversResult, null);

        expect(result.inputTypes.length).toBe(0);
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

        const result = integrate(typesResult, resolversResult, null);

        expect(result.hasErrors).toBe(false);
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
                location: null,
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

        const result = integrate(typesResult, resolversResult, null);

        expect(result.hasErrors).toBe(true);
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
                location: null,
              },
            ],
            warnings: [],
          },
        };

        const result = integrate(typesResult, resolversResult, null);

        expect(result.hasErrors).toBe(true);
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
                  type: {
                    typeName: "String",
                    nullable: false,
                    list: false,
                    listItemNullable: null,
                  },
                  args: null,
                  sourceLocation: {
                    file: "/path/to/file.ts",
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
        };

        const result = integrate(typesResult, resolversResult, null);

        expect(result.hasErrors).toBe(true);
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
                location: null,
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

        const result = integrate(typesResult, resolversResult, null);

        expect(result.hasErrors).toBe(false);
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
                type: {
                  typeName: "User",
                  nullable: false,
                  list: true,
                  listItemNullable: null,
                },
                args: null,
                sourceLocation: {
                  file: "/path/to/query.ts",
                  line: 1,
                  column: 1,
                },
                resolverExportName: "users",
                description: null,
                deprecated: null,
              },
            ],
          },
          mutationFields: { fields: [] },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult, null);

        const queryExtension = result.typeExtensions.find(
          (t) => t.targetTypeName === "Query",
        );
        expect(queryExtension).toBeTruthy();
        expect(queryExtension!.fields[0]?.resolverExportName).toBe("users");
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
                type: {
                  typeName: "User",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                args: null,
                sourceLocation: {
                  file: "/path/to/mutation.ts",
                  line: 1,
                  column: 1,
                },
                resolverExportName: "createUser",
                description: null,
                deprecated: null,
              },
            ],
          },
          typeExtensions: [],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult, null);

        const mutationExtension = result.typeExtensions.find(
          (t) => t.targetTypeName === "Mutation",
        );
        expect(mutationExtension).toBeTruthy();
        expect(mutationExtension!.fields[0]?.resolverExportName).toBe(
          "createUser",
        );
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
              sourceFile: "/path/to/user.ts",
              description: null,
              deprecated: null,
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
                  type: {
                    typeName: "Post",
                    nullable: false,
                    list: true,
                    listItemNullable: null,
                  },
                  args: null,
                  sourceLocation: {
                    file: "/path/to/user-resolver.ts",
                    line: 1,
                    column: 1,
                  },
                  resolverExportName: "posts",
                  description: null,
                  deprecated: null,
                },
              ],
            },
          ],
          diagnostics: { errors: [], warnings: [] },
        };

        const result = integrate(typesResult, resolversResult, null);

        const userExtension = result.typeExtensions.find(
          (t) => t.targetTypeName === "User",
        );
        expect(userExtension).toBeTruthy();
        expect(userExtension!.fields[0]?.resolverExportName).toBe("posts");
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
                type: {
                  typeName: "User",
                  nullable: false,
                  list: true,
                  listItemNullable: null,
                },
                args: null,
                sourceLocation: {
                  file: "/path/to/query.ts",
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
        };

        const result = integrate(typesResult, resolversResult, null);

        const queryExtension = result.typeExtensions.find(
          (t) => t.targetTypeName === "Query",
        );
        expect(queryExtension).toBeTruthy();
        expect(queryExtension!.fields[0]?.resolverExportName).toBe(null);
      });
    });
  });
});
