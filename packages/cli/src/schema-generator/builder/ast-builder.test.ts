/**
 * Tests for ast-builder.
 *
 * This module tests the GraphQL AST generation for schema definitions.
 */

import { Kind, print } from "graphql";
import { describe, expect, it, test } from "vitest";
import type { DeprecationInfo } from "../../shared/tsdoc-parser.js";
import type { IntegratedResult } from "../integrator/result-integrator.js";
import { buildDocumentNode } from "./ast-builder.js";

function createMinimalIntegratedResult(
  overrides: Partial<IntegratedResult> = {},
): IntegratedResult {
  return {
    baseTypes: [],
    inputTypes: [],
    typeExtensions: [],
    customScalarNames: null,
    customScalarDescriptions: null,
    hasQuery: false,
    hasMutation: false,
    hasErrors: false,
    diagnostics: [],
    ...overrides,
  };
}

describe("buildDocumentNode", () => {
  describe("Task 6.3: Custom scalar AST generation", () => {
    it("should generate ScalarTypeDefinitionNode for custom scalars", () => {
      const result = createMinimalIntegratedResult({
        customScalarNames: ["DateTime"],
      });
      const document = buildDocumentNode(result);

      expect(document.definitions).toHaveLength(1);
      const scalarDef = document.definitions[0];
      expect(scalarDef?.kind).toBe(Kind.SCALAR_TYPE_DEFINITION);
      if (scalarDef?.kind === Kind.SCALAR_TYPE_DEFINITION) {
        expect(scalarDef.name.value).toBe("DateTime");
      }
    });

    it("should set description on scalar AST when provided", () => {
      const result = createMinimalIntegratedResult({
        customScalarNames: ["DateTime"],
        customScalarDescriptions: {
          DateTime: "ISO 8601 format datetime string",
        },
      });
      const document = buildDocumentNode(result);

      const scalarDef = document.definitions[0];
      expect(scalarDef?.kind).toBe(Kind.SCALAR_TYPE_DEFINITION);
      if (scalarDef?.kind === Kind.SCALAR_TYPE_DEFINITION) {
        expect(scalarDef.description?.value).toBe(
          "ISO 8601 format datetime string",
        );
      }
    });

    it("should not include description when not provided", () => {
      const result = createMinimalIntegratedResult({
        customScalarNames: ["DateTime"],
        customScalarDescriptions: null,
      });
      const document = buildDocumentNode(result);

      const scalarDef = document.definitions[0];
      expect(scalarDef?.kind).toBe(Kind.SCALAR_TYPE_DEFINITION);
      if (scalarDef?.kind === Kind.SCALAR_TYPE_DEFINITION) {
        expect(scalarDef.description).toBeUndefined();
      }
    });

    it("should generate multiple scalars in alphabetical order", () => {
      const result = createMinimalIntegratedResult({
        customScalarNames: ["URL", "DateTime", "Email"],
        customScalarDescriptions: {
          URL: "A valid URL",
          DateTime: "ISO 8601 datetime",
          Email: "Email address",
        },
      });
      const document = buildDocumentNode(result);

      expect(document.definitions).toHaveLength(3);

      const scalarNames = document.definitions.map((def) => {
        if (def.kind === Kind.SCALAR_TYPE_DEFINITION) {
          return def.name.value;
        }
        return null;
      });

      expect(scalarNames).toEqual(["DateTime", "Email", "URL"]);
    });

    it("should not generate definition for built-in scalars", () => {
      const result = createMinimalIntegratedResult({
        customScalarNames: ["DateTime"],
      });
      const document = buildDocumentNode(result);

      const scalarNames = document.definitions
        .filter((def) => def.kind === Kind.SCALAR_TYPE_DEFINITION)
        .map((def) => {
          if (def.kind === Kind.SCALAR_TYPE_DEFINITION) {
            return def.name.value;
          }
          return null;
        });

      expect(scalarNames).not.toContain("String");
      expect(scalarNames).not.toContain("Int");
      expect(scalarNames).not.toContain("Float");
      expect(scalarNames).not.toContain("Boolean");
      expect(scalarNames).not.toContain("ID");
    });

    it("should generate valid SDL output with description", () => {
      const result = createMinimalIntegratedResult({
        customScalarNames: ["DateTime"],
        customScalarDescriptions: {
          DateTime: "ISO 8601 format datetime",
        },
      });
      const document = buildDocumentNode(result);
      const sdl = print(document);

      expect(sdl).toContain('"""');
      expect(sdl).toContain("ISO 8601 format datetime");
      expect(sdl).toContain("scalar DateTime");
    });

    it("should generate multi-line description correctly", () => {
      const result = createMinimalIntegratedResult({
        customScalarNames: ["DateTime"],
        customScalarDescriptions: {
          DateTime: "ISO 8601 format datetime\n\nCan be used for timestamps",
        },
      });
      const document = buildDocumentNode(result);
      const sdl = print(document);

      expect(sdl).toContain("ISO 8601 format datetime");
      expect(sdl).toContain("Can be used for timestamps");
    });

    it("should handle scalar with no description when others have descriptions", () => {
      const result = createMinimalIntegratedResult({
        customScalarNames: ["DateTime", "URL"],
        customScalarDescriptions: {
          DateTime: "ISO 8601 format datetime",
        },
      });
      const document = buildDocumentNode(result);

      const scalarDefs = document.definitions.filter(
        (def) => def.kind === Kind.SCALAR_TYPE_DEFINITION,
      );

      expect(scalarDefs).toHaveLength(2);

      const dateTimeDef = scalarDefs.find(
        (def) =>
          def.kind === Kind.SCALAR_TYPE_DEFINITION &&
          def.name.value === "DateTime",
      );
      const urlDef = scalarDefs.find(
        (def) =>
          def.kind === Kind.SCALAR_TYPE_DEFINITION && def.name.value === "URL",
      );

      if (dateTimeDef?.kind === Kind.SCALAR_TYPE_DEFINITION) {
        expect(dateTimeDef.description?.value).toBe("ISO 8601 format datetime");
      }
      if (urlDef?.kind === Kind.SCALAR_TYPE_DEFINITION) {
        expect(urlDef.description).toBeUndefined();
      }
    });
  });
});

describe("buildDeprecatedDirective", () => {
  test("should include reason argument when reason is provided", () => {
    const result = buildDocumentNode({
      baseTypes: [
        {
          kind: "Object",
          name: "User",
          description: null,
          sourceFile: null,
          deprecated: null,
          unionMembers: null,
          enumValues: null,
          fields: [
            {
              name: "oldField",
              type: {
                typeName: "String",
                nullable: false,
                list: false,
                listItemNullable: false,
              },
              description: null,
              deprecated: {
                isDeprecated: true,
                reason: "Use newField instead",
              } satisfies DeprecationInfo,
            },
          ],
        },
      ],
      inputTypes: [],
      typeExtensions: [],
      customScalarNames: null,
      customScalarDescriptions: null,
      hasQuery: false,
      hasMutation: false,
      hasErrors: false,
      diagnostics: [],
    });

    const userType = result.definitions.find(
      (def) =>
        def.kind === Kind.OBJECT_TYPE_DEFINITION && def.name.value === "User",
    );

    expect(userType).toBeDefined();
    if (userType?.kind !== Kind.OBJECT_TYPE_DEFINITION) {
      throw new Error("Expected ObjectTypeDefinitionNode");
    }

    const oldField = userType.fields?.find((f) => f.name.value === "oldField");
    expect(oldField).toBeDefined();
    expect(oldField?.directives).toHaveLength(1);

    const deprecatedDirective = oldField?.directives?.[0];
    expect(deprecatedDirective?.name.value).toBe("deprecated");
    expect(deprecatedDirective?.arguments).toHaveLength(1);
    expect(deprecatedDirective?.arguments?.[0]?.name.value).toBe("reason");
    expect(deprecatedDirective?.arguments?.[0]?.value).toMatchObject({
      kind: Kind.STRING,
      value: "Use newField instead",
    });
  });

  test("should use default reason when reason is null", () => {
    const result = buildDocumentNode({
      baseTypes: [
        {
          kind: "Object",
          name: "User",
          description: null,
          sourceFile: null,
          deprecated: null,
          unionMembers: null,
          enumValues: null,
          fields: [
            {
              name: "oldField",
              type: {
                typeName: "String",
                nullable: false,
                list: false,
                listItemNullable: false,
              },
              description: null,
              deprecated: {
                isDeprecated: true,
                reason: null,
              } satisfies DeprecationInfo,
            },
          ],
        },
      ],
      inputTypes: [],
      typeExtensions: [],
      customScalarNames: null,
      customScalarDescriptions: null,
      hasQuery: false,
      hasMutation: false,
      hasErrors: false,
      diagnostics: [],
    });

    const userType = result.definitions.find(
      (def) =>
        def.kind === Kind.OBJECT_TYPE_DEFINITION && def.name.value === "User",
    );

    expect(userType).toBeDefined();
    if (userType?.kind !== Kind.OBJECT_TYPE_DEFINITION) {
      throw new Error("Expected ObjectTypeDefinitionNode");
    }

    const oldField = userType.fields?.find((f) => f.name.value === "oldField");
    expect(oldField).toBeDefined();
    expect(oldField?.directives).toHaveLength(1);

    const deprecatedDirective = oldField?.directives?.[0];
    expect(deprecatedDirective?.name.value).toBe("deprecated");
    expect(deprecatedDirective?.arguments).toHaveLength(1);
    expect(deprecatedDirective?.arguments?.[0]?.name.value).toBe("reason");
    expect(deprecatedDirective?.arguments?.[0]?.value).toMatchObject({
      kind: Kind.STRING,
      value: "No longer supported",
    });
  });

  test("should handle deprecated enum values with reason", () => {
    const result = buildDocumentNode({
      baseTypes: [
        {
          kind: "Enum",
          name: "Status",
          description: null,
          sourceFile: null,
          deprecated: null,
          fields: null,
          unionMembers: null,
          enumValues: [
            {
              name: "ACTIVE",
              originalValue: "ACTIVE",
              description: null,
              deprecated: null,
            },
            {
              name: "LEGACY",
              originalValue: "LEGACY",
              description: null,
              deprecated: {
                isDeprecated: true,
                reason: "Use ACTIVE instead",
              } satisfies DeprecationInfo,
            },
          ],
        },
      ],
      inputTypes: [],
      typeExtensions: [],
      customScalarNames: null,
      customScalarDescriptions: null,
      hasQuery: false,
      hasMutation: false,
      hasErrors: false,
      diagnostics: [],
    });

    const statusEnum = result.definitions.find(
      (def) =>
        def.kind === Kind.ENUM_TYPE_DEFINITION && def.name.value === "Status",
    );

    expect(statusEnum).toBeDefined();
    if (statusEnum?.kind !== Kind.ENUM_TYPE_DEFINITION) {
      throw new Error("Expected EnumTypeDefinitionNode");
    }

    const legacyValue = statusEnum.values?.find(
      (v) => v.name.value === "LEGACY",
    );
    expect(legacyValue).toBeDefined();
    expect(legacyValue?.directives).toHaveLength(1);

    const deprecatedDirective = legacyValue?.directives?.[0];
    expect(deprecatedDirective?.name.value).toBe("deprecated");
    expect(deprecatedDirective?.arguments).toHaveLength(1);
    expect(deprecatedDirective?.arguments?.[0]?.value).toMatchObject({
      kind: Kind.STRING,
      value: "Use ACTIVE instead",
    });
  });

  test("should handle deprecated enum values without reason", () => {
    const result = buildDocumentNode({
      baseTypes: [
        {
          kind: "Enum",
          name: "Status",
          description: null,
          sourceFile: null,
          deprecated: null,
          fields: null,
          unionMembers: null,
          enumValues: [
            {
              name: "ACTIVE",
              originalValue: "ACTIVE",
              description: null,
              deprecated: null,
            },
            {
              name: "OLD",
              originalValue: "OLD",
              description: null,
              deprecated: {
                isDeprecated: true,
                reason: null,
              } satisfies DeprecationInfo,
            },
          ],
        },
      ],
      inputTypes: [],
      typeExtensions: [],
      customScalarNames: null,
      customScalarDescriptions: null,
      hasQuery: false,
      hasMutation: false,
      hasErrors: false,
      diagnostics: [],
    });

    const statusEnum = result.definitions.find(
      (def) =>
        def.kind === Kind.ENUM_TYPE_DEFINITION && def.name.value === "Status",
    );

    expect(statusEnum).toBeDefined();
    if (statusEnum?.kind !== Kind.ENUM_TYPE_DEFINITION) {
      throw new Error("Expected EnumTypeDefinitionNode");
    }

    const oldValue = statusEnum.values?.find((v) => v.name.value === "OLD");
    expect(oldValue).toBeDefined();
    expect(oldValue?.directives).toHaveLength(1);

    const deprecatedDirective = oldValue?.directives?.[0];
    expect(deprecatedDirective?.name.value).toBe("deprecated");
    expect(deprecatedDirective?.arguments).toHaveLength(1);
    expect(deprecatedDirective?.arguments?.[0]?.value).toMatchObject({
      kind: Kind.STRING,
      value: "No longer supported",
    });
  });
});
