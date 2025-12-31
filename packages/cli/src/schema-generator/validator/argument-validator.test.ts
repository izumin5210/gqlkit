import assert from "node:assert";
import { describe, it } from "node:test";
import type { GraphQLFieldType } from "../../type-extractor/types/index.js";
import type {
  InputType,
  TypeExtension,
} from "../integrator/result-integrator.js";
import {
  type ValidationContext,
  validateArguments,
} from "./argument-validator.js";

describe("ArgumentValidator", () => {
  describe("validateArguments", () => {
    function createContext(
      options: Partial<ValidationContext> = {},
    ): ValidationContext {
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
                type: { typeName: "User", nullable: true, list: false },
                args: [
                  {
                    name: "id",
                    type: { typeName: "ID", nullable: false, list: false },
                  },
                ],
                resolverSourceFile: "/path/to/query.ts",
              },
            ],
          },
        ];
        const inputTypes: InputType[] = [];
        const context = createContext({
          outputTypes: ["User"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        assert.strictEqual(result.isValid, true);
        assert.strictEqual(result.diagnostics.length, 0);
      });

      it("should pass for valid Input Object argument types", () => {
        const typeExtensions: TypeExtension[] = [
          {
            targetTypeName: "Mutation",
            fields: [
              {
                name: "createUser",
                type: { typeName: "User", nullable: false, list: false },
                args: [
                  {
                    name: "input",
                    type: {
                      typeName: "CreateUserInput",
                      nullable: false,
                      list: false,
                    },
                  },
                ],
                resolverSourceFile: "/path/to/mutation.ts",
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
                type: { typeName: "String", nullable: false, list: false },
              },
            ],
            sourceFile: "/path/to/input.ts",
          },
        ];
        const context = createContext({
          inputTypes: ["CreateUserInput"],
          outputTypes: ["User"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        assert.strictEqual(result.isValid, true);
        assert.strictEqual(result.diagnostics.length, 0);
      });

      it("should pass for valid Enum argument types", () => {
        const typeExtensions: TypeExtension[] = [
          {
            targetTypeName: "Query",
            fields: [
              {
                name: "usersByStatus",
                type: { typeName: "User", nullable: false, list: true },
                args: [
                  {
                    name: "status",
                    type: { typeName: "Status", nullable: false, list: false },
                  },
                ],
                resolverSourceFile: "/path/to/query.ts",
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

        assert.strictEqual(result.isValid, true);
        assert.strictEqual(result.diagnostics.length, 0);
      });

      it("should report error for unknown argument type", () => {
        const typeExtensions: TypeExtension[] = [
          {
            targetTypeName: "Query",
            fields: [
              {
                name: "user",
                type: { typeName: "User", nullable: true, list: false },
                args: [
                  {
                    name: "filter",
                    type: {
                      typeName: "UnknownType",
                      nullable: false,
                      list: false,
                    },
                  },
                ],
                resolverSourceFile: "/path/to/query.ts",
              },
            ],
          },
        ];
        const inputTypes: InputType[] = [];
        const context = createContext({
          outputTypes: ["User"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        assert.strictEqual(result.isValid, false);
        assert.ok(
          result.diagnostics.some((d) => d.code === "UNKNOWN_ARGUMENT_TYPE"),
        );
        const error = result.diagnostics.find(
          (d) => d.code === "UNKNOWN_ARGUMENT_TYPE",
        );
        assert.ok(error?.message.includes("UnknownType"));
      });

      it("should report error when argument uses Output type", () => {
        const typeExtensions: TypeExtension[] = [
          {
            targetTypeName: "Query",
            fields: [
              {
                name: "users",
                type: { typeName: "User", nullable: false, list: true },
                args: [
                  {
                    name: "filter",
                    type: { typeName: "User", nullable: false, list: false },
                  },
                ],
                resolverSourceFile: "/path/to/query.ts",
              },
            ],
          },
        ];
        const inputTypes: InputType[] = [];
        const context = createContext({
          outputTypes: ["User"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        assert.strictEqual(result.isValid, false);
        assert.ok(
          result.diagnostics.some((d) => d.code === "OUTPUT_TYPE_IN_INPUT"),
        );
        const error = result.diagnostics.find(
          (d) => d.code === "OUTPUT_TYPE_IN_INPUT",
        );
        assert.ok(error?.message.includes("User"));
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
                type: { typeName: "String", nullable: false, list: false },
              },
              {
                name: "parent",
                type: { typeName: "NodeInput", nullable: false, list: false },
              },
            ],
            sourceFile: "/path/to/node-input.ts",
          },
        ];
        const context = createContext({
          inputTypes: ["NodeInput"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        assert.strictEqual(result.isValid, false);
        assert.ok(
          result.diagnostics.some((d) => d.code === "CIRCULAR_INPUT_REFERENCE"),
        );
        const error = result.diagnostics.find(
          (d) => d.code === "CIRCULAR_INPUT_REFERENCE",
        );
        assert.ok(error?.message.includes("NodeInput"));
      });

      it("should detect indirect circular reference (A -> B -> A)", () => {
        const typeExtensions: TypeExtension[] = [];
        const inputTypes: InputType[] = [
          {
            name: "CreateUserInput",
            fields: [
              {
                name: "name",
                type: { typeName: "String", nullable: false, list: false },
              },
              {
                name: "address",
                type: {
                  typeName: "AddressInput",
                  nullable: false,
                  list: false,
                },
              },
            ],
            sourceFile: "/path/to/create-user-input.ts",
          },
          {
            name: "AddressInput",
            fields: [
              {
                name: "city",
                type: { typeName: "String", nullable: false, list: false },
              },
              {
                name: "owner",
                type: {
                  typeName: "CreateUserInput",
                  nullable: false,
                  list: false,
                },
              },
            ],
            sourceFile: "/path/to/address-input.ts",
          },
        ];
        const context = createContext({
          inputTypes: ["CreateUserInput", "AddressInput"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        assert.strictEqual(result.isValid, false);
        assert.ok(
          result.diagnostics.some((d) => d.code === "CIRCULAR_INPUT_REFERENCE"),
        );
        const error = result.diagnostics.find(
          (d) => d.code === "CIRCULAR_INPUT_REFERENCE",
        );
        assert.ok(error?.message.includes("CreateUserInput"));
        assert.ok(error?.message.includes("AddressInput"));
      });

      it("should allow nullable self-reference without error", () => {
        const typeExtensions: TypeExtension[] = [];
        const inputTypes: InputType[] = [
          {
            name: "NodeInput",
            fields: [
              {
                name: "name",
                type: { typeName: "String", nullable: false, list: false },
              },
              {
                name: "children",
                type: { typeName: "NodeInput", nullable: true, list: true },
              },
            ],
            sourceFile: "/path/to/node-input.ts",
          },
        ];
        const context = createContext({
          inputTypes: ["NodeInput"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        assert.strictEqual(result.isValid, true);
        assert.strictEqual(
          result.diagnostics.filter(
            (d) => d.code === "CIRCULAR_INPUT_REFERENCE",
          ).length,
          0,
        );
      });

      it("should detect long circular chain (A -> B -> C -> A)", () => {
        const typeExtensions: TypeExtension[] = [];
        const inputTypes: InputType[] = [
          {
            name: "AInput",
            fields: [
              {
                name: "next",
                type: { typeName: "BInput", nullable: false, list: false },
              },
            ],
            sourceFile: "/path/to/a-input.ts",
          },
          {
            name: "BInput",
            fields: [
              {
                name: "next",
                type: { typeName: "CInput", nullable: false, list: false },
              },
            ],
            sourceFile: "/path/to/b-input.ts",
          },
          {
            name: "CInput",
            fields: [
              {
                name: "next",
                type: { typeName: "AInput", nullable: false, list: false },
              },
            ],
            sourceFile: "/path/to/c-input.ts",
          },
        ];
        const context = createContext({
          inputTypes: ["AInput", "BInput", "CInput"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        assert.strictEqual(result.isValid, false);
        assert.ok(
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
                type: { typeName: "Result", nullable: false, list: true },
                args: [
                  {
                    name: "filter",
                    type: {
                      typeName: "UnknownFilter",
                      nullable: false,
                      list: false,
                    },
                  },
                ],
                resolverSourceFile: "/path/to/query.ts",
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
                type: { typeName: "String", nullable: false, list: false },
              },
              {
                name: "profile",
                type: { typeName: "User", nullable: false, list: false },
              },
            ],
            sourceFile: "/path/to/create-user-input.ts",
          },
        ];
        const context = createContext({
          inputTypes: ["CreateUserInput"],
          outputTypes: ["User", "Result"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        assert.strictEqual(result.isValid, false);
        assert.ok(result.diagnostics.length >= 2, "Expected at least 2 errors");
        assert.ok(
          result.diagnostics.some((d) => d.code === "UNKNOWN_ARGUMENT_TYPE"),
        );
        assert.ok(
          result.diagnostics.some((d) => d.code === "OUTPUT_TYPE_IN_INPUT"),
        );
      });

      it("should include source file location in all errors", () => {
        const typeExtensions: TypeExtension[] = [
          {
            targetTypeName: "Query",
            fields: [
              {
                name: "search",
                type: { typeName: "Result", nullable: false, list: true },
                args: [
                  {
                    name: "filter",
                    type: {
                      typeName: "UnknownType",
                      nullable: false,
                      list: false,
                    },
                  },
                ],
                resolverSourceFile: "/path/to/specific-query.ts",
              },
            ],
          },
        ];
        const inputTypes: InputType[] = [];
        const context = createContext({
          outputTypes: ["Result"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        assert.strictEqual(result.isValid, false);
        for (const diagnostic of result.diagnostics) {
          assert.ok(
            diagnostic.location,
            "Expected location on all diagnostics",
          );
          assert.ok(diagnostic.location.file, "Expected file path in location");
          assert.strictEqual(typeof diagnostic.location.line, "number");
          assert.strictEqual(typeof diagnostic.location.column, "number");
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
                type: { typeName: "UnknownType", nullable: false, list: false },
              },
            ],
            sourceFile: "/path/to/test-input.ts",
          },
        ];
        const context = createContext({
          inputTypes: ["TestInput"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        const errors = result.diagnostics.filter((d) =>
          d.message.includes("UnknownType"),
        );
        assert.strictEqual(
          errors.length,
          1,
          "Expected exactly 1 error for UnknownType",
        );
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
                type: { typeName: "String", nullable: false, list: false },
              },
              {
                name: "age",
                type: { typeName: "Int", nullable: true, list: false },
              },
            ],
            sourceFile: "/path/to/input.ts",
          },
        ];
        const context = createContext({
          inputTypes: ["CreateUserInput"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        assert.strictEqual(result.isValid, true);
        assert.strictEqual(result.diagnostics.length, 0);
      });

      it("should pass for nested Input Object references", () => {
        const typeExtensions: TypeExtension[] = [];
        const inputTypes: InputType[] = [
          {
            name: "CreateUserInput",
            fields: [
              {
                name: "name",
                type: { typeName: "String", nullable: false, list: false },
              },
              {
                name: "address",
                type: { typeName: "AddressInput", nullable: true, list: false },
              },
            ],
            sourceFile: "/path/to/create-user-input.ts",
          },
          {
            name: "AddressInput",
            fields: [
              {
                name: "city",
                type: { typeName: "String", nullable: false, list: false },
              },
            ],
            sourceFile: "/path/to/address-input.ts",
          },
        ];
        const context = createContext({
          inputTypes: ["CreateUserInput", "AddressInput"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        assert.strictEqual(result.isValid, true);
        assert.strictEqual(result.diagnostics.length, 0);
      });

      it("should report error when Input Object references Output type", () => {
        const typeExtensions: TypeExtension[] = [];
        const inputTypes: InputType[] = [
          {
            name: "CreatePostInput",
            fields: [
              {
                name: "title",
                type: { typeName: "String", nullable: false, list: false },
              },
              {
                name: "author",
                type: { typeName: "User", nullable: false, list: false },
              },
            ],
            sourceFile: "/path/to/create-post-input.ts",
          },
        ];
        const context = createContext({
          inputTypes: ["CreatePostInput"],
          outputTypes: ["User"],
        });

        const result = validateArguments(typeExtensions, inputTypes, context);

        assert.strictEqual(result.isValid, false);
        assert.ok(
          result.diagnostics.some((d) => d.code === "OUTPUT_TYPE_IN_INPUT"),
        );
        const error = result.diagnostics.find(
          (d) => d.code === "OUTPUT_TYPE_IN_INPUT",
        );
        assert.ok(error?.message.includes("CreatePostInput"));
        assert.ok(error?.message.includes("User"));
      });
    });
  });
});
