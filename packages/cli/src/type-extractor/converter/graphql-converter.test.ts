import assert from "node:assert";
import { describe, it } from "node:test";
import type { ExtractedTypeInfo } from "../types/index.js";
import {
  convertToGraphQL,
  isValidGraphQLEnumValue,
  toScreamingSnakeCase,
} from "./graphql-converter.js";

describe("GraphQLConverter", () => {
  describe("convertToGraphQL", () => {
    describe("primitive type mapping", () => {
      it("should convert string to GraphQL String", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "User",
              kind: "interface",
              sourceFile: "/path/to/user.ts",
              exportKind: "named",
            },
            fields: [
              {
                name: "name",
                tsType: { kind: "primitive", name: "string", nullable: false },
                optional: false,
              },
            ],
          },
        ];

        const result = convertToGraphQL(input);

        assert.strictEqual(result.types.length, 1);
        const field = result.types[0]?.fields?.[0];
        assert.ok(field);
        assert.strictEqual(field.type.typeName, "String");
        assert.strictEqual(field.type.nullable, false);
      });

      it("should convert number to GraphQL Int", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "User",
              kind: "interface",
              sourceFile: "/path/to/user.ts",
              exportKind: "named",
            },
            fields: [
              {
                name: "age",
                tsType: { kind: "primitive", name: "number", nullable: false },
                optional: false,
              },
            ],
          },
        ];

        const result = convertToGraphQL(input);

        const field = result.types[0]?.fields?.[0];
        assert.ok(field);
        assert.strictEqual(field.type.typeName, "Int");
      });

      it("should convert boolean to GraphQL Boolean", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "User",
              kind: "interface",
              sourceFile: "/path/to/user.ts",
              exportKind: "named",
            },
            fields: [
              {
                name: "active",
                tsType: { kind: "primitive", name: "boolean", nullable: false },
                optional: false,
              },
            ],
          },
        ];

        const result = convertToGraphQL(input);

        const field = result.types[0]?.fields?.[0];
        assert.ok(field);
        assert.strictEqual(field.type.typeName, "Boolean");
      });

      it("should preserve type references as-is", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "Post",
              kind: "interface",
              sourceFile: "/path/to/post.ts",
              exportKind: "named",
            },
            fields: [
              {
                name: "author",
                tsType: { kind: "reference", name: "User", nullable: false },
                optional: false,
              },
            ],
          },
        ];

        const result = convertToGraphQL(input);

        const field = result.types[0]?.fields?.[0];
        assert.ok(field);
        assert.strictEqual(field.type.typeName, "User");
      });
    });

    describe("Object and Interface type conversion", () => {
      it("should convert interface to GraphQL Object type", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "User",
              kind: "interface",
              sourceFile: "/path/to/user.ts",
              exportKind: "named",
            },
            fields: [
              {
                name: "id",
                tsType: { kind: "primitive", name: "string", nullable: false },
                optional: false,
              },
            ],
          },
        ];

        const result = convertToGraphQL(input);

        assert.strictEqual(result.types[0]?.kind, "Object");
        assert.strictEqual(result.types[0]?.name, "User");
      });

      it("should convert object type to GraphQL Object type", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "Status",
              kind: "object",
              sourceFile: "/path/to/status.ts",
              exportKind: "named",
            },
            fields: [
              {
                name: "code",
                tsType: { kind: "primitive", name: "number", nullable: false },
                optional: false,
              },
            ],
          },
        ];

        const result = convertToGraphQL(input);

        assert.strictEqual(result.types[0]?.kind, "Object");
        assert.strictEqual(result.types[0]?.name, "Status");
      });

      it("should include source file in type info", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "User",
              kind: "interface",
              sourceFile: "/path/to/user.ts",
              exportKind: "named",
            },
            fields: [],
          },
        ];

        const result = convertToGraphQL(input);

        assert.strictEqual(result.types[0]?.sourceFile, "/path/to/user.ts");
      });
    });

    describe("Union type conversion", () => {
      it("should convert union type to GraphQL Union", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "SearchResult",
              kind: "union",
              sourceFile: "/path/to/search.ts",
              exportKind: "named",
            },
            fields: [],
            unionMembers: ["User", "Post"],
          },
        ];

        const result = convertToGraphQL(input);

        assert.strictEqual(result.types[0]?.kind, "Union");
        assert.strictEqual(result.types[0]?.name, "SearchResult");
        assert.deepStrictEqual(result.types[0]?.unionMembers, ["Post", "User"]);
      });

      it("should not include fields for union types", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "Result",
              kind: "union",
              sourceFile: "/path/to/result.ts",
              exportKind: "named",
            },
            fields: [],
            unionMembers: ["Success", "Error"],
          },
        ];

        const result = convertToGraphQL(input);

        assert.strictEqual(result.types[0]?.fields, undefined);
      });
    });

    describe("nullable and list type conversion", () => {
      it("should mark nullable fields", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "User",
              kind: "interface",
              sourceFile: "/path/to/user.ts",
              exportKind: "named",
            },
            fields: [
              {
                name: "nickname",
                tsType: { kind: "primitive", name: "string", nullable: true },
                optional: false,
              },
            ],
          },
        ];

        const result = convertToGraphQL(input);

        const field = result.types[0]?.fields?.[0];
        assert.ok(field);
        assert.strictEqual(field.type.nullable, true);
      });

      it("should mark optional fields as nullable", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "User",
              kind: "interface",
              sourceFile: "/path/to/user.ts",
              exportKind: "named",
            },
            fields: [
              {
                name: "bio",
                tsType: { kind: "primitive", name: "string", nullable: false },
                optional: true,
              },
            ],
          },
        ];

        const result = convertToGraphQL(input);

        const field = result.types[0]?.fields?.[0];
        assert.ok(field);
        assert.strictEqual(field.type.nullable, true);
      });

      it("should convert array types to list", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "User",
              kind: "interface",
              sourceFile: "/path/to/user.ts",
              exportKind: "named",
            },
            fields: [
              {
                name: "tags",
                tsType: {
                  kind: "array",
                  elementType: {
                    kind: "primitive",
                    name: "string",
                    nullable: false,
                  },
                  nullable: false,
                },
                optional: false,
              },
            ],
          },
        ];

        const result = convertToGraphQL(input);

        const field = result.types[0]?.fields?.[0];
        assert.ok(field);
        assert.strictEqual(field.type.list, true);
        assert.strictEqual(field.type.typeName, "String");
        assert.strictEqual(field.type.listItemNullable, false);
      });

      it("should track nullable list items", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "User",
              kind: "interface",
              sourceFile: "/path/to/user.ts",
              exportKind: "named",
            },
            fields: [
              {
                name: "notes",
                tsType: {
                  kind: "array",
                  elementType: {
                    kind: "primitive",
                    name: "string",
                    nullable: true,
                  },
                  nullable: false,
                },
                optional: false,
              },
            ],
          },
        ];

        const result = convertToGraphQL(input);

        const field = result.types[0]?.fields?.[0];
        assert.ok(field);
        assert.strictEqual(field.type.list, true);
        assert.strictEqual(field.type.listItemNullable, true);
      });
    });

    describe("reserved type name detection", () => {
      it("should report error for GraphQL reserved type names", () => {
        const reservedNames = ["Int", "Float", "String", "Boolean", "ID"];

        for (const name of reservedNames) {
          const input: ExtractedTypeInfo[] = [
            {
              metadata: {
                name,
                kind: "interface",
                sourceFile: "/path/to/types.ts",
                exportKind: "named",
              },
              fields: [],
            },
          ];

          const result = convertToGraphQL(input);

          assert.ok(
            result.diagnostics.some((d) => d.code === "RESERVED_TYPE_NAME"),
            `Expected RESERVED_TYPE_NAME error for '${name}'`,
          );
        }
      });

      it("should include type name in error message", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "String",
              kind: "interface",
              sourceFile: "/path/to/types.ts",
              exportKind: "named",
            },
            fields: [],
          },
        ];

        const result = convertToGraphQL(input);

        assert.ok(result.diagnostics[0]?.message.includes("String"));
      });
    });

    describe("Enum type conversion", () => {
      it("should convert enum type to GraphQL Enum", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "Status",
              kind: "enum",
              sourceFile: "/path/to/status.ts",
              exportKind: "named",
            },
            fields: [],
            enumMembers: [
              { name: "Active", value: "active" },
              { name: "Inactive", value: "inactive" },
            ],
          },
        ];

        const result = convertToGraphQL(input);

        assert.strictEqual(result.types.length, 1);
        assert.strictEqual(result.types[0]?.kind, "Enum");
        assert.strictEqual(result.types[0]?.name, "Status");
        assert.strictEqual(result.types[0]?.enumValues?.length, 2);
        assert.strictEqual(result.types[0]?.enumValues?.[0]?.name, "ACTIVE");
        assert.strictEqual(
          result.types[0]?.enumValues?.[0]?.originalValue,
          "active",
        );
      });

      it("should convert enum member names to SCREAMING_SNAKE_CASE", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "UserRole",
              kind: "enum",
              sourceFile: "/path/to/role.ts",
              exportKind: "named",
            },
            fields: [],
            enumMembers: [
              { name: "superAdmin", value: "superAdmin" },
              { name: "regularUser", value: "regularUser" },
            ],
          },
        ];

        const result = convertToGraphQL(input);

        assert.strictEqual(
          result.types[0]?.enumValues?.[0]?.name,
          "SUPER_ADMIN",
        );
        assert.strictEqual(
          result.types[0]?.enumValues?.[1]?.name,
          "REGULAR_USER",
        );
      });

      it("should preserve original value", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "Color",
              kind: "enum",
              sourceFile: "/path/to/color.ts",
              exportKind: "named",
            },
            fields: [],
            enumMembers: [{ name: "darkBlue", value: "dark-blue" }],
          },
        ];

        const result = convertToGraphQL(input);

        assert.strictEqual(
          result.types[0]?.enumValues?.[0]?.originalValue,
          "dark-blue",
        );
      });

      it("should report error for invalid GraphQL enum member name", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "Invalid",
              kind: "enum",
              sourceFile: "/path/to/invalid.ts",
              exportKind: "named",
            },
            fields: [],
            enumMembers: [{ name: "123invalid", value: "123invalid" }],
          },
        ];

        const result = convertToGraphQL(input);

        assert.ok(
          result.diagnostics.some((d) => d.code === "INVALID_ENUM_MEMBER"),
        );
      });

      it("should check reserved type names for enum", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "Int",
              kind: "enum",
              sourceFile: "/path/to/int.ts",
              exportKind: "named",
            },
            fields: [],
            enumMembers: [{ name: "One", value: "one" }],
          },
        ];

        const result = convertToGraphQL(input);

        assert.ok(
          result.diagnostics.some((d) => d.code === "RESERVED_TYPE_NAME"),
        );
      });
    });
  });

  describe("Input Object type classification", () => {
    it("should convert type with *Input suffix to InputObject kind", () => {
      const input: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "CreateUserInput",
            kind: "interface",
            sourceFile: "/path/to/create-user-input.ts",
            exportKind: "named",
          },
          fields: [
            {
              name: "name",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
            },
            {
              name: "email",
              tsType: { kind: "primitive", name: "string", nullable: true },
              optional: false,
            },
          ],
        },
      ];

      const result = convertToGraphQL(input);

      assert.strictEqual(result.types.length, 1);
      assert.strictEqual(result.types[0]?.kind, "InputObject");
      assert.strictEqual(result.types[0]?.name, "CreateUserInput");
      assert.strictEqual(result.types[0]?.fields?.length, 2);
    });

    it("should convert object type with *Input suffix to InputObject kind", () => {
      const input: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "UpdateUserInput",
            kind: "object",
            sourceFile: "/path/to/update-user-input.ts",
            exportKind: "named",
          },
          fields: [
            {
              name: "id",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
            },
          ],
        },
      ];

      const result = convertToGraphQL(input);

      assert.strictEqual(result.types[0]?.kind, "InputObject");
    });

    it("should not convert non-*Input types to InputObject", () => {
      const input: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "User",
            kind: "interface",
            sourceFile: "/path/to/user.ts",
            exportKind: "named",
          },
          fields: [
            {
              name: "id",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
            },
          ],
        },
      ];

      const result = convertToGraphQL(input);

      assert.strictEqual(result.types[0]?.kind, "Object");
    });

    it("should handle nested Input type references in fields", () => {
      const input: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "CreatePostInput",
            kind: "interface",
            sourceFile: "/path/to/create-post-input.ts",
            exportKind: "named",
          },
          fields: [
            {
              name: "title",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
            },
            {
              name: "author",
              tsType: {
                kind: "reference",
                name: "AuthorInput",
                nullable: false,
              },
              optional: false,
            },
          ],
        },
      ];

      const result = convertToGraphQL(input);

      assert.strictEqual(result.types[0]?.kind, "InputObject");
      const authorField = result.types[0]?.fields?.find(
        (f) => f.name === "author",
      );
      assert.ok(authorField);
      assert.strictEqual(authorField.type.typeName, "AuthorInput");
    });

    it("should report error for union type with *Input suffix", () => {
      const input: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "StatusInput",
            kind: "union",
            sourceFile: "/path/to/status-input.ts",
            exportKind: "named",
          },
          fields: [],
          unionMembers: ["Success", "Error"],
        },
      ];

      const result = convertToGraphQL(input);

      assert.ok(
        result.diagnostics.some((d) => d.code === "INVALID_INPUT_TYPE"),
        "Expected INVALID_INPUT_TYPE error",
      );
      const error = result.diagnostics.find(
        (d) => d.code === "INVALID_INPUT_TYPE",
      );
      assert.ok(error?.message.includes("StatusInput"));
      assert.ok(error?.message.includes("union"));
      assert.strictEqual(error?.location?.file, "/path/to/status-input.ts");
    });

    it("should report error for enum type with *Input suffix", () => {
      const input: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "ColorInput",
            kind: "enum",
            sourceFile: "/path/to/color-input.ts",
            exportKind: "named",
          },
          fields: [],
          enumMembers: [
            { name: "Red", value: "red" },
            { name: "Blue", value: "blue" },
          ],
        },
      ];

      const result = convertToGraphQL(input);

      assert.ok(
        result.diagnostics.some((d) => d.code === "INVALID_INPUT_TYPE"),
        "Expected INVALID_INPUT_TYPE error",
      );
      const error = result.diagnostics.find(
        (d) => d.code === "INVALID_INPUT_TYPE",
      );
      assert.ok(error?.message.includes("ColorInput"));
      assert.ok(error?.message.includes("enum"));
    });

    it("should not add invalid Input types to result types", () => {
      const input: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "StatusInput",
            kind: "union",
            sourceFile: "/path/to/status-input.ts",
            exportKind: "named",
          },
          fields: [],
          unionMembers: ["Success", "Error"],
        },
      ];

      const result = convertToGraphQL(input);

      assert.strictEqual(result.types.length, 1);
      assert.strictEqual(result.types[0]?.kind, "Union");
    });
  });

  describe("toScreamingSnakeCase", () => {
    it("should convert camelCase to SCREAMING_SNAKE_CASE", () => {
      assert.strictEqual(toScreamingSnakeCase("camelCase"), "CAMEL_CASE");
    });

    it("should convert PascalCase to SCREAMING_SNAKE_CASE", () => {
      assert.strictEqual(toScreamingSnakeCase("PascalCase"), "PASCAL_CASE");
    });

    it("should convert kebab-case to SCREAMING_SNAKE_CASE", () => {
      assert.strictEqual(toScreamingSnakeCase("kebab-case"), "KEBAB_CASE");
    });

    it("should convert lowercase to UPPERCASE", () => {
      assert.strictEqual(toScreamingSnakeCase("active"), "ACTIVE");
    });

    it("should preserve existing SCREAMING_SNAKE_CASE", () => {
      assert.strictEqual(
        toScreamingSnakeCase("ALREADY_SNAKE"),
        "ALREADY_SNAKE",
      );
    });

    it("should handle spaces", () => {
      assert.strictEqual(toScreamingSnakeCase("space case"), "SPACE_CASE");
    });

    it("should handle consecutive uppercase letters", () => {
      assert.strictEqual(toScreamingSnakeCase("XMLParser"), "XML_PARSER");
    });
  });

  describe("isValidGraphQLEnumValue", () => {
    it("should return true for valid uppercase name", () => {
      assert.strictEqual(isValidGraphQLEnumValue("VALID_NAME"), true);
    });

    it("should return true for name starting with underscore", () => {
      assert.strictEqual(isValidGraphQLEnumValue("_VALID"), true);
    });

    it("should return true for name with numbers", () => {
      assert.strictEqual(isValidGraphQLEnumValue("VALUE_123"), true);
    });

    it("should return false for name starting with number", () => {
      assert.strictEqual(isValidGraphQLEnumValue("123_INVALID"), false);
    });

    it("should return false for empty string", () => {
      assert.strictEqual(isValidGraphQLEnumValue(""), false);
    });

    it("should return false for name with special characters", () => {
      assert.strictEqual(isValidGraphQLEnumValue("INVALID@NAME"), false);
    });
  });
});
