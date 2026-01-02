import { describe, expect, it } from "vitest";
import type {
  InputType,
  TypeExtension,
} from "../integrator/result-integrator.js";
import { validateArguments } from "./argument-validator.js";

interface CreateContextOptions {
  knownTypes?: string[];
  inputTypes?: string[];
  outputTypes?: string[];
  enumTypes?: string[];
  scalarTypes?: string[];
}

describe("ArgumentValidator", () => {
  describe("validateArguments", () => {
    function createContext(options: CreateContextOptions = {}) {
      return {
        knownTypes: new Set(options.knownTypes ?? []),
        inputTypes: new Set(options.inputTypes ?? []),
        outputTypes: new Set(options.outputTypes ?? []),
        enumTypes: new Set(options.enumTypes ?? []),
        scalarTypes: new Set(
          options.scalarTypes ?? ["String", "Int", "Float", "Boolean", "ID"],
        ),
      };
    }

    describe("argument type reference validation", () => {
      it("should pass for valid scalar argument types", () => {
        const typeExtensions: TypeExtension[] = [
          {
            targetTypeName: "Query",
            fields: [
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
                resolverSourceFile: "/path/to/query.ts",
                resolverExportName: null,
                description: null,
                deprecated: null,
              },
            ],
          },
        ];
        const inputTypes: InputType[] = [];
        const context = createContext({
          outputTypes: ["User"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        expect(result.isValid).toBe(true);
        expect(result.diagnostics.length).toBe(0);
      });

      it("should pass for valid Input Object argument types", () => {
        const typeExtensions: TypeExtension[] = [
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
                args: [
                  {
                    name: "input",
                    type: {
                      typeName: "CreateUserInput",
                      nullable: false,
                      list: false,
                      listItemNullable: null,
                    },
                    description: null,
                    deprecated: null,
                  },
                ],
                resolverSourceFile: "/path/to/mutation.ts",
                resolverExportName: null,
                description: null,
                deprecated: null,
              },
            ],
          },
        ];
        const inputTypes: InputType[] = [
          {
            name: "CreateUserInput",
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
            sourceFile: "/path/to/input.ts",
            description: null,
          },
        ];
        const context = createContext({
          inputTypes: ["CreateUserInput"],
          outputTypes: ["User"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        expect(result.isValid).toBe(true);
        expect(result.diagnostics.length).toBe(0);
      });

      it("should pass for valid Enum argument types", () => {
        const typeExtensions: TypeExtension[] = [
          {
            targetTypeName: "Query",
            fields: [
              {
                name: "usersByStatus",
                type: {
                  typeName: "User",
                  nullable: false,
                  list: true,
                  listItemNullable: false,
                },
                args: [
                  {
                    name: "status",
                    type: {
                      typeName: "Status",
                      nullable: false,
                      list: false,
                      listItemNullable: null,
                    },
                    description: null,
                    deprecated: null,
                  },
                ],
                resolverSourceFile: "/path/to/query.ts",
                resolverExportName: null,
                description: null,
                deprecated: null,
              },
            ],
          },
        ];
        const inputTypes: InputType[] = [];
        const context = createContext({
          enumTypes: ["Status"],
          outputTypes: ["User"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        expect(result.isValid).toBe(true);
        expect(result.diagnostics.length).toBe(0);
      });

      it("should report error for unknown argument type", () => {
        const typeExtensions: TypeExtension[] = [
          {
            targetTypeName: "Query",
            fields: [
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
                    name: "filter",
                    type: {
                      typeName: "UnknownType",
                      nullable: false,
                      list: false,
                      listItemNullable: null,
                    },
                    description: null,
                    deprecated: null,
                  },
                ],
                resolverSourceFile: "/path/to/query.ts",
                resolverExportName: null,
                description: null,
                deprecated: null,
              },
            ],
          },
        ];
        const inputTypes: InputType[] = [];
        const context = createContext({
          outputTypes: ["User"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        expect(result.isValid).toBe(false);
        expect(
          result.diagnostics.some((d) => d.code === "UNKNOWN_ARGUMENT_TYPE"),
        );
        const error = result.diagnostics.find(
          (d) => d.code === "UNKNOWN_ARGUMENT_TYPE",
        );
        expect(error?.message.includes("UnknownType")).toBeTruthy();
      });

      it("should report error when argument uses Output type", () => {
        const typeExtensions: TypeExtension[] = [
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
                args: [
                  {
                    name: "filter",
                    type: {
                      typeName: "User",
                      nullable: false,
                      list: false,
                      listItemNullable: null,
                    },
                    description: null,
                    deprecated: null,
                  },
                ],
                resolverSourceFile: "/path/to/query.ts",
                resolverExportName: null,
                description: null,
                deprecated: null,
              },
            ],
          },
        ];
        const inputTypes: InputType[] = [];
        const context = createContext({
          outputTypes: ["User"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        expect(result.isValid).toBe(false);
        expect(
          result.diagnostics.some((d) => d.code === "OUTPUT_TYPE_IN_INPUT"),
        );
        const error = result.diagnostics.find(
          (d) => d.code === "OUTPUT_TYPE_IN_INPUT",
        );
        expect(error?.message.includes("User")).toBeTruthy();
      });
    });

    describe("circular reference detection", () => {
      it("should detect direct circular reference (A -> A) with non-nullable field", () => {
        const typeExtensions: TypeExtension[] = [];
        const inputTypes: InputType[] = [
          {
            name: "NodeInput",
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
                name: "parent",
                type: {
                  typeName: "NodeInput",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
            ],
            sourceFile: "/path/to/node-input.ts",
            description: null,
          },
        ];
        const context = createContext({
          inputTypes: ["NodeInput"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        expect(result.isValid).toBe(false);
        expect(
          result.diagnostics.some((d) => d.code === "CIRCULAR_INPUT_REFERENCE"),
        );
        const error = result.diagnostics.find(
          (d) => d.code === "CIRCULAR_INPUT_REFERENCE",
        );
        expect(error?.message.includes("NodeInput")).toBeTruthy();
      });

      it("should detect indirect circular reference (A -> B -> A)", () => {
        const typeExtensions: TypeExtension[] = [];
        const inputTypes: InputType[] = [
          {
            name: "CreateUserInput",
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
                name: "address",
                type: {
                  typeName: "AddressInput",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
            ],
            sourceFile: "/path/to/create-user-input.ts",
            description: null,
          },
          {
            name: "AddressInput",
            fields: [
              {
                name: "city",
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
                name: "owner",
                type: {
                  typeName: "CreateUserInput",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
            ],
            sourceFile: "/path/to/address-input.ts",
            description: null,
          },
        ];
        const context = createContext({
          inputTypes: ["CreateUserInput", "AddressInput"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        expect(result.isValid).toBe(false);
        expect(
          result.diagnostics.some((d) => d.code === "CIRCULAR_INPUT_REFERENCE"),
        );
        const error = result.diagnostics.find(
          (d) => d.code === "CIRCULAR_INPUT_REFERENCE",
        );
        expect(error?.message.includes("CreateUserInput")).toBeTruthy();
        expect(error?.message.includes("AddressInput")).toBeTruthy();
      });

      it("should allow nullable self-reference without error", () => {
        const typeExtensions: TypeExtension[] = [];
        const inputTypes: InputType[] = [
          {
            name: "NodeInput",
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
                name: "children",
                type: {
                  typeName: "NodeInput",
                  nullable: true,
                  list: true,
                  listItemNullable: true,
                },
                description: null,
                deprecated: null,
              },
            ],
            sourceFile: "/path/to/node-input.ts",
            description: null,
          },
        ];
        const context = createContext({
          inputTypes: ["NodeInput"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        expect(result.isValid).toBe(true);
        expect(
          result.diagnostics.filter(
            (d) => d.code === "CIRCULAR_INPUT_REFERENCE",
          ).length,
        ).toBe(0);
      });

      it("should detect long circular chain (A -> B -> C -> A)", () => {
        const typeExtensions: TypeExtension[] = [];
        const inputTypes: InputType[] = [
          {
            name: "AInput",
            fields: [
              {
                name: "next",
                type: {
                  typeName: "BInput",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
            ],
            sourceFile: "/path/to/a-input.ts",
            description: null,
          },
          {
            name: "BInput",
            fields: [
              {
                name: "next",
                type: {
                  typeName: "CInput",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
            ],
            sourceFile: "/path/to/b-input.ts",
            description: null,
          },
          {
            name: "CInput",
            fields: [
              {
                name: "next",
                type: {
                  typeName: "AInput",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
            ],
            sourceFile: "/path/to/c-input.ts",
            description: null,
          },
        ];
        const context = createContext({
          inputTypes: ["AInput", "BInput", "CInput"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        expect(result.isValid).toBe(false);
        expect(
          result.diagnostics.some((d) => d.code === "CIRCULAR_INPUT_REFERENCE"),
        );
      });
    });

    describe("multiple error collection", () => {
      it("should collect multiple errors from different sources", () => {
        const typeExtensions: TypeExtension[] = [
          {
            targetTypeName: "Query",
            fields: [
              {
                name: "search",
                type: {
                  typeName: "Result",
                  nullable: false,
                  list: true,
                  listItemNullable: false,
                },
                args: [
                  {
                    name: "filter",
                    type: {
                      typeName: "UnknownFilter",
                      nullable: false,
                      list: false,
                      listItemNullable: null,
                    },
                    description: null,
                    deprecated: null,
                  },
                ],
                resolverSourceFile: "/path/to/query.ts",
                resolverExportName: null,
                description: null,
                deprecated: null,
              },
            ],
          },
        ];
        const inputTypes: InputType[] = [
          {
            name: "CreateUserInput",
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
                name: "profile",
                type: {
                  typeName: "User",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
            ],
            sourceFile: "/path/to/create-user-input.ts",
            description: null,
          },
        ];
        const context = createContext({
          inputTypes: ["CreateUserInput"],
          outputTypes: ["User", "Result"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        expect(result.isValid).toBe(false);
        expect(result.diagnostics.length).toBeGreaterThanOrEqual(2);
        expect(
          result.diagnostics.some((d) => d.code === "UNKNOWN_ARGUMENT_TYPE"),
        ).toBeTruthy();
        expect(
          result.diagnostics.some((d) => d.code === "OUTPUT_TYPE_IN_INPUT"),
        ).toBeTruthy();
      });

      it("should include source file location in all errors", () => {
        const typeExtensions: TypeExtension[] = [
          {
            targetTypeName: "Query",
            fields: [
              {
                name: "search",
                type: {
                  typeName: "Result",
                  nullable: false,
                  list: true,
                  listItemNullable: false,
                },
                args: [
                  {
                    name: "filter",
                    type: {
                      typeName: "UnknownType",
                      nullable: false,
                      list: false,
                      listItemNullable: null,
                    },
                    description: null,
                    deprecated: null,
                  },
                ],
                resolverSourceFile: "/path/to/specific-query.ts",
                resolverExportName: null,
                description: null,
                deprecated: null,
              },
            ],
          },
        ];
        const inputTypes: InputType[] = [];
        const context = createContext({
          outputTypes: ["Result"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        expect(result.isValid).toBe(false);
        for (const diagnostic of result.diagnostics) {
          expect(diagnostic.location).toBeTruthy();
          expect(diagnostic.location?.file).toBeTruthy();
          expect(typeof diagnostic.location?.line).toBe("number");
          expect(typeof diagnostic.location?.column).toBe("number");
        }
      });

      it("should not have duplicate errors for the same issue", () => {
        const typeExtensions: TypeExtension[] = [];
        const inputTypes: InputType[] = [
          {
            name: "TestInput",
            fields: [
              {
                name: "field1",
                type: {
                  typeName: "UnknownType",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
            ],
            sourceFile: "/path/to/test-input.ts",
            description: null,
          },
        ];
        const context = createContext({
          inputTypes: ["TestInput"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        const errors = result.diagnostics.filter((d) =>
          d.message.includes("UnknownType"),
        );
        expect(errors.length).toBe(1);
      });
    });

    describe("Input Object field validation", () => {
      it("should pass for Input Object with scalar fields", () => {
        const typeExtensions: TypeExtension[] = [];
        const inputTypes: InputType[] = [
          {
            name: "CreateUserInput",
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
                name: "age",
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
            sourceFile: "/path/to/input.ts",
            description: null,
          },
        ];
        const context = createContext({
          inputTypes: ["CreateUserInput"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        expect(result.isValid).toBe(true);
        expect(result.diagnostics.length).toBe(0);
      });

      it("should pass for nested Input Object references", () => {
        const typeExtensions: TypeExtension[] = [];
        const inputTypes: InputType[] = [
          {
            name: "CreateUserInput",
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
                name: "address",
                type: {
                  typeName: "AddressInput",
                  nullable: true,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
            ],
            sourceFile: "/path/to/create-user-input.ts",
            description: null,
          },
          {
            name: "AddressInput",
            fields: [
              {
                name: "city",
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
            sourceFile: "/path/to/address-input.ts",
            description: null,
          },
        ];
        const context = createContext({
          inputTypes: ["CreateUserInput", "AddressInput"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        expect(result.isValid).toBe(true);
        expect(result.diagnostics.length).toBe(0);
      });

      it("should report error when Input Object references Output type", () => {
        const typeExtensions: TypeExtension[] = [];
        const inputTypes: InputType[] = [
          {
            name: "CreatePostInput",
            fields: [
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
              {
                name: "author",
                type: {
                  typeName: "User",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
            ],
            sourceFile: "/path/to/create-post-input.ts",
            description: null,
          },
        ];
        const context = createContext({
          inputTypes: ["CreatePostInput"],
          outputTypes: ["User"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        expect(result.isValid).toBe(false);
        expect(
          result.diagnostics.some((d) => d.code === "OUTPUT_TYPE_IN_INPUT"),
        );
        const error = result.diagnostics.find(
          (d) => d.code === "OUTPUT_TYPE_IN_INPUT",
        );
        expect(error?.message.includes("CreatePostInput")).toBeTruthy();
        expect(error?.message.includes("User")).toBeTruthy();
      });
    });
  });
});
