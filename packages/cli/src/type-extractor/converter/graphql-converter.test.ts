import { describe, expect, it } from "vitest";
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
              description: null,
              deprecated: null,
            },
            fields: [
              {
                name: "name",
                tsType: {
                  kind: "primitive",
                  name: "string",
                  nullable: false,
                  elementType: null,
                  members: null,
                  scalarInfo: null,
                },
                optional: false,
                description: null,
                deprecated: null,
              },
            ],
            unionMembers: null,
            enumMembers: null,
          },
        ];

        const result = convertToGraphQL(input);

        expect(result.types.length).toBe(1);
        const field = result.types[0]?.fields?.[0];
        expect(field).toBeTruthy();
        expect(field!.type.typeName).toBe("String");
        expect(field!.type.nullable).toBe(false);
      });

      it("should convert number to GraphQL Int", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "User",
              kind: "interface",
              sourceFile: "/path/to/user.ts",
              exportKind: "named",
              description: null,
              deprecated: null,
            },
            fields: [
              {
                name: "age",
                tsType: {
                  kind: "primitive",
                  name: "number",
                  nullable: false,
                  elementType: null,
                  members: null,
                  scalarInfo: null,
                },
                optional: false,
                description: null,
                deprecated: null,
              },
            ],
            unionMembers: null,
            enumMembers: null,
          },
        ];

        const result = convertToGraphQL(input);

        const field = result.types[0]?.fields?.[0];
        expect(field).toBeTruthy();
        expect(field!.type.typeName).toBe("Float");
      });

      it("should convert boolean to GraphQL Boolean", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "User",
              kind: "interface",
              sourceFile: "/path/to/user.ts",
              exportKind: "named",
              description: null,
              deprecated: null,
            },
            fields: [
              {
                name: "active",
                tsType: {
                  kind: "primitive",
                  name: "boolean",
                  nullable: false,
                  elementType: null,
                  members: null,
                  scalarInfo: null,
                },
                optional: false,
                description: null,
                deprecated: null,
              },
            ],
            unionMembers: null,
            enumMembers: null,
          },
        ];

        const result = convertToGraphQL(input);

        const field = result.types[0]?.fields?.[0];
        expect(field).toBeTruthy();
        expect(field!.type.typeName).toBe("Boolean");
      });

      it("should preserve type references as-is", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "Post",
              kind: "interface",
              sourceFile: "/path/to/post.ts",
              exportKind: "named",
              description: null,
              deprecated: null,
            },
            fields: [
              {
                name: "author",
                tsType: {
                  kind: "reference",
                  name: "User",
                  nullable: false,
                  elementType: null,
                  members: null,
                  scalarInfo: null,
                },
                optional: false,
                description: null,
                deprecated: null,
              },
            ],
            unionMembers: null,
            enumMembers: null,
          },
        ];

        const result = convertToGraphQL(input);

        const field = result.types[0]?.fields?.[0];
        expect(field).toBeTruthy();
        expect(field!.type.typeName).toBe("User");
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
              description: null,
              deprecated: null,
            },
            fields: [
              {
                name: "id",
                tsType: {
                  kind: "primitive",
                  name: "string",
                  nullable: false,
                  elementType: null,
                  members: null,
                  scalarInfo: null,
                },
                optional: false,
                description: null,
                deprecated: null,
              },
            ],
            unionMembers: null,
            enumMembers: null,
          },
        ];

        const result = convertToGraphQL(input);

        expect(result.types[0]?.kind).toBe("Object");
        expect(result.types[0]?.name).toBe("User");
      });

      it("should convert object type to GraphQL Object type", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "Status",
              kind: "object",
              sourceFile: "/path/to/status.ts",
              exportKind: "named",
              description: null,
              deprecated: null,
            },
            fields: [
              {
                name: "code",
                tsType: {
                  kind: "primitive",
                  name: "number",
                  nullable: false,
                  elementType: null,
                  members: null,
                  scalarInfo: null,
                },
                optional: false,
                description: null,
                deprecated: null,
              },
            ],
            unionMembers: null,
            enumMembers: null,
          },
        ];

        const result = convertToGraphQL(input);

        expect(result.types[0]?.kind).toBe("Object");
        expect(result.types[0]?.name).toBe("Status");
      });

      it("should include source file in type info", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "User",
              kind: "interface",
              sourceFile: "/path/to/user.ts",
              exportKind: "named",
              description: null,
              deprecated: null,
            },
            fields: [],
            unionMembers: null,
            enumMembers: null,
          },
        ];

        const result = convertToGraphQL(input);

        expect(result.types[0]?.sourceFile).toBe("/path/to/user.ts");
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
              description: null,
              deprecated: null,
            },
            fields: [],
            unionMembers: ["User", "Post"],
            enumMembers: null,
          },
        ];

        const result = convertToGraphQL(input);

        expect(result.types[0]?.kind).toBe("Union");
        expect(result.types[0]?.name).toBe("SearchResult");
        expect(result.types[0]?.unionMembers).toEqual(["Post", "User"]);
      });

      it("should not include fields for union types", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "Result",
              kind: "union",
              sourceFile: "/path/to/result.ts",
              exportKind: "named",
              description: null,
              deprecated: null,
            },
            fields: [],
            unionMembers: ["Success", "Error"],
            enumMembers: null,
          },
        ];

        const result = convertToGraphQL(input);

        expect(result.types[0]?.fields).toBe(null);
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
              description: null,
              deprecated: null,
            },
            fields: [
              {
                name: "nickname",
                tsType: {
                  kind: "primitive",
                  name: "string",
                  nullable: true,
                  elementType: null,
                  members: null,
                  scalarInfo: null,
                },
                optional: false,
                description: null,
                deprecated: null,
              },
            ],
            unionMembers: null,
            enumMembers: null,
          },
        ];

        const result = convertToGraphQL(input);

        const field = result.types[0]?.fields?.[0];
        expect(field).toBeTruthy();
        expect(field!.type.nullable).toBe(true);
      });

      it("should mark optional fields as nullable", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "User",
              kind: "interface",
              sourceFile: "/path/to/user.ts",
              exportKind: "named",
              description: null,
              deprecated: null,
            },
            fields: [
              {
                name: "bio",
                tsType: {
                  kind: "primitive",
                  name: "string",
                  nullable: false,
                  elementType: null,
                  members: null,
                  scalarInfo: null,
                },
                optional: true,
                description: null,
                deprecated: null,
              },
            ],
            unionMembers: null,
            enumMembers: null,
          },
        ];

        const result = convertToGraphQL(input);

        const field = result.types[0]?.fields?.[0];
        expect(field).toBeTruthy();
        expect(field!.type.nullable).toBe(true);
      });

      it("should convert array types to list", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "User",
              kind: "interface",
              sourceFile: "/path/to/user.ts",
              exportKind: "named",
              description: null,
              deprecated: null,
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
                    elementType: null,
                    members: null,
                    scalarInfo: null,
                  },
                  nullable: false,
                  name: null,
                  members: null,
                  scalarInfo: null,
                },
                optional: false,
                description: null,
                deprecated: null,
              },
            ],
            unionMembers: null,
            enumMembers: null,
          },
        ];

        const result = convertToGraphQL(input);

        const field = result.types[0]?.fields?.[0];
        expect(field).toBeTruthy();
        expect(field!.type.list).toBe(true);
        expect(field!.type.typeName).toBe("String");
        expect(field!.type.listItemNullable).toBe(false);
      });

      it("should track nullable list items", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "User",
              kind: "interface",
              sourceFile: "/path/to/user.ts",
              exportKind: "named",
              description: null,
              deprecated: null,
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
                    elementType: null,
                    members: null,
                    scalarInfo: null,
                  },
                  nullable: false,
                  name: null,
                  members: null,
                  scalarInfo: null,
                },
                optional: false,
                description: null,
                deprecated: null,
              },
            ],
            unionMembers: null,
            enumMembers: null,
          },
        ];

        const result = convertToGraphQL(input);

        const field = result.types[0]?.fields?.[0];
        expect(field).toBeTruthy();
        expect(field!.type.list).toBe(true);
        expect(field!.type.listItemNullable).toBe(true);
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
                description: null,
                deprecated: null,
              },
              fields: [],
              unionMembers: null,
              enumMembers: null,
            },
          ];

          const result = convertToGraphQL(input);

          expect(
            result.diagnostics.some((d) => d.code === "RESERVED_TYPE_NAME"),
          ).toBe(true);
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
              description: null,
              deprecated: null,
            },
            fields: [],
            unionMembers: null,
            enumMembers: null,
          },
        ];

        const result = convertToGraphQL(input);

        expect(result.diagnostics[0]?.message).toContain("String");
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
              description: null,
              deprecated: null,
            },
            fields: [],
            unionMembers: null,
            enumMembers: [
              {
                name: "Active",
                value: "active",
                description: null,
                deprecated: null,
              },
              {
                name: "Inactive",
                value: "inactive",
                description: null,
                deprecated: null,
              },
            ],
          },
        ];

        const result = convertToGraphQL(input);

        expect(result.types.length).toBe(1);
        expect(result.types[0]?.kind).toBe("Enum");
        expect(result.types[0]?.name).toBe("Status");
        expect(result.types[0]?.enumValues?.length).toBe(2);
        expect(result.types[0]?.enumValues?.[0]?.name).toBe("ACTIVE");
        expect(result.types[0]?.enumValues?.[0]?.originalValue).toBe("active");
      });

      it("should convert enum member names to SCREAMING_SNAKE_CASE", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "UserRole",
              kind: "enum",
              sourceFile: "/path/to/role.ts",
              exportKind: "named",
              description: null,
              deprecated: null,
            },
            fields: [],
            unionMembers: null,
            enumMembers: [
              {
                name: "superAdmin",
                value: "superAdmin",
                description: null,
                deprecated: null,
              },
              {
                name: "regularUser",
                value: "regularUser",
                description: null,
                deprecated: null,
              },
            ],
          },
        ];

        const result = convertToGraphQL(input);

        expect(result.types[0]?.enumValues?.[0]?.name).toBe("SUPER_ADMIN");
        expect(result.types[0]?.enumValues?.[1]?.name).toBe("REGULAR_USER");
      });

      it("should preserve original value", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "Color",
              kind: "enum",
              sourceFile: "/path/to/color.ts",
              exportKind: "named",
              description: null,
              deprecated: null,
            },
            fields: [],
            unionMembers: null,
            enumMembers: [
              {
                name: "darkBlue",
                value: "dark-blue",
                description: null,
                deprecated: null,
              },
            ],
          },
        ];

        const result = convertToGraphQL(input);

        expect(result.types[0]?.enumValues?.[0]?.originalValue).toBe(
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
              description: null,
              deprecated: null,
            },
            fields: [],
            unionMembers: null,
            enumMembers: [
              {
                name: "123invalid",
                value: "123invalid",
                description: null,
                deprecated: null,
              },
            ],
          },
        ];

        const result = convertToGraphQL(input);

        expect(
          result.diagnostics.some((d) => d.code === "INVALID_ENUM_MEMBER"),
        ).toBe(true);
      });

      it("should check reserved type names for enum", () => {
        const input: ExtractedTypeInfo[] = [
          {
            metadata: {
              name: "Int",
              kind: "enum",
              sourceFile: "/path/to/int.ts",
              exportKind: "named",
              description: null,
              deprecated: null,
            },
            fields: [],
            unionMembers: null,
            enumMembers: [
              {
                name: "One",
                value: "one",
                description: null,
                deprecated: null,
              },
            ],
          },
        ];

        const result = convertToGraphQL(input);

        expect(
          result.diagnostics.some((d) => d.code === "RESERVED_TYPE_NAME"),
        ).toBe(true);
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
            description: null,
            deprecated: null,
          },
          fields: [
            {
              name: "name",
              tsType: {
                kind: "primitive",
                name: "string",
                nullable: false,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: false,
              description: null,
              deprecated: null,
            },
            {
              name: "email",
              tsType: {
                kind: "primitive",
                name: "string",
                nullable: true,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: false,
              description: null,
              deprecated: null,
            },
          ],
          unionMembers: null,
          enumMembers: null,
        },
      ];

      const result = convertToGraphQL(input);

      expect(result.types.length).toBe(1);
      expect(result.types[0]?.kind).toBe("InputObject");
      expect(result.types[0]?.name).toBe("CreateUserInput");
      expect(result.types[0]?.fields?.length).toBe(2);
    });

    it("should convert object type with *Input suffix to InputObject kind", () => {
      const input: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "UpdateUserInput",
            kind: "object",
            sourceFile: "/path/to/update-user-input.ts",
            exportKind: "named",
            description: null,
            deprecated: null,
          },
          fields: [
            {
              name: "id",
              tsType: {
                kind: "primitive",
                name: "string",
                nullable: false,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: false,
              description: null,
              deprecated: null,
            },
          ],
          unionMembers: null,
          enumMembers: null,
        },
      ];

      const result = convertToGraphQL(input);

      expect(result.types[0]?.kind).toBe("InputObject");
    });

    it("should not convert non-*Input types to InputObject", () => {
      const input: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "User",
            kind: "interface",
            sourceFile: "/path/to/user.ts",
            exportKind: "named",
            description: null,
            deprecated: null,
          },
          fields: [
            {
              name: "id",
              tsType: {
                kind: "primitive",
                name: "string",
                nullable: false,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: false,
              description: null,
              deprecated: null,
            },
          ],
          unionMembers: null,
          enumMembers: null,
        },
      ];

      const result = convertToGraphQL(input);

      expect(result.types[0]?.kind).toBe("Object");
    });

    it("should handle nested Input type references in fields", () => {
      const input: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "CreatePostInput",
            kind: "interface",
            sourceFile: "/path/to/create-post-input.ts",
            exportKind: "named",
            description: null,
            deprecated: null,
          },
          fields: [
            {
              name: "title",
              tsType: {
                kind: "primitive",
                name: "string",
                nullable: false,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: false,
              description: null,
              deprecated: null,
            },
            {
              name: "author",
              tsType: {
                kind: "reference",
                name: "AuthorInput",
                nullable: false,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: false,
              description: null,
              deprecated: null,
            },
          ],
          unionMembers: null,
          enumMembers: null,
        },
      ];

      const result = convertToGraphQL(input);

      expect(result.types[0]?.kind).toBe("InputObject");
      const authorField = result.types[0]?.fields?.find(
        (f) => f.name === "author",
      );
      expect(authorField).toBeTruthy();
      expect(authorField!.type.typeName).toBe("AuthorInput");
    });

    it("should report error for union type with *Input suffix", () => {
      const input: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "StatusInput",
            kind: "union",
            sourceFile: "/path/to/status-input.ts",
            exportKind: "named",
            description: null,
            deprecated: null,
          },
          fields: [],
          unionMembers: ["Success", "Error"],
          enumMembers: null,
        },
      ];

      const result = convertToGraphQL(input);

      expect(
        result.diagnostics.some((d) => d.code === "INVALID_INPUT_TYPE"),
      ).toBe(true);
      const error = result.diagnostics.find(
        (d) => d.code === "INVALID_INPUT_TYPE",
      );
      expect(error?.message).toContain("StatusInput");
      expect(error?.message).toContain("union");
      expect(error?.location?.file).toBe("/path/to/status-input.ts");
    });

    it("should report error for enum type with *Input suffix", () => {
      const input: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "ColorInput",
            kind: "enum",
            sourceFile: "/path/to/color-input.ts",
            exportKind: "named",
            description: null,
            deprecated: null,
          },
          fields: [],
          unionMembers: null,
          enumMembers: [
            {
              name: "Red",
              value: "red",
              description: null,
              deprecated: null,
            },
            {
              name: "Blue",
              value: "blue",
              description: null,
              deprecated: null,
            },
          ],
        },
      ];

      const result = convertToGraphQL(input);

      expect(
        result.diagnostics.some((d) => d.code === "INVALID_INPUT_TYPE"),
      ).toBe(true);
      const error = result.diagnostics.find(
        (d) => d.code === "INVALID_INPUT_TYPE",
      );
      expect(error?.message).toContain("ColorInput");
      expect(error?.message).toContain("enum");
    });

    it("should not add invalid Input types to result types", () => {
      const input: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "StatusInput",
            kind: "union",
            sourceFile: "/path/to/status-input.ts",
            exportKind: "named",
            description: null,
            deprecated: null,
          },
          fields: [],
          unionMembers: ["Success", "Error"],
          enumMembers: null,
        },
      ];

      const result = convertToGraphQL(input);

      expect(result.types.length).toBe(1);
      expect(result.types[0]?.kind).toBe("Union");
    });
  });

  describe("toScreamingSnakeCase", () => {
    it("should convert camelCase to SCREAMING_SNAKE_CASE", () => {
      expect(toScreamingSnakeCase("camelCase")).toBe("CAMEL_CASE");
    });

    it("should convert PascalCase to SCREAMING_SNAKE_CASE", () => {
      expect(toScreamingSnakeCase("PascalCase")).toBe("PASCAL_CASE");
    });

    it("should convert kebab-case to SCREAMING_SNAKE_CASE", () => {
      expect(toScreamingSnakeCase("kebab-case")).toBe("KEBAB_CASE");
    });

    it("should convert lowercase to UPPERCASE", () => {
      expect(toScreamingSnakeCase("active")).toBe("ACTIVE");
    });

    it("should preserve existing SCREAMING_SNAKE_CASE", () => {
      expect(toScreamingSnakeCase("ALREADY_SNAKE")).toBe("ALREADY_SNAKE");
    });

    it("should handle spaces", () => {
      expect(toScreamingSnakeCase("space case")).toBe("SPACE_CASE");
    });

    it("should handle consecutive uppercase letters", () => {
      expect(toScreamingSnakeCase("XMLParser")).toBe("XML_PARSER");
    });
  });

  describe("isValidGraphQLEnumValue", () => {
    it("should return true for valid uppercase name", () => {
      expect(isValidGraphQLEnumValue("VALID_NAME")).toBe(true);
    });

    it("should return true for name starting with underscore", () => {
      expect(isValidGraphQLEnumValue("_VALID")).toBe(true);
    });

    it("should return true for name with numbers", () => {
      expect(isValidGraphQLEnumValue("VALUE_123")).toBe(true);
    });

    it("should return false for name starting with number", () => {
      expect(isValidGraphQLEnumValue("123_INVALID")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isValidGraphQLEnumValue("")).toBe(false);
    });

    it("should return false for name with special characters", () => {
      expect(isValidGraphQLEnumValue("INVALID@NAME")).toBe(false);
    });
  });
});
