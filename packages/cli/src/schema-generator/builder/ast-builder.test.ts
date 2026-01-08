import { Kind } from "graphql";
import { describe, expect, test } from "vitest";
import type { DeprecationInfo } from "../../shared/tsdoc-parser.js";
import { buildDocumentNode } from "./ast-builder.js";

describe("buildScalarTypeDefinitionNode", () => {
  test("6.1 should generate scalar with description from TSDoc", () => {
    const result = buildDocumentNode({
      baseTypes: [],
      inputTypes: [],
      typeExtensions: [],
      customScalarNames: null,
      customScalars: [
        {
          scalarName: "DateTime",
          description: "ISO 8601 date time format",
        },
      ],
      directiveDefinitions: null,
      hasQuery: false,
      hasMutation: false,
      hasErrors: false,
      diagnostics: [],
    });

    const scalarDef = result.definitions.find(
      (def) =>
        def.kind === Kind.SCALAR_TYPE_DEFINITION &&
        def.name.value === "DateTime",
    );

    expect(scalarDef).toBeDefined();
    if (scalarDef?.kind !== Kind.SCALAR_TYPE_DEFINITION) {
      throw new Error("Expected ScalarTypeDefinitionNode");
    }

    expect(scalarDef.description).toBeDefined();
    expect(scalarDef.description?.value).toBe("ISO 8601 date time format");
  });

  test("6.1 should generate scalar without description when not provided", () => {
    const result = buildDocumentNode({
      baseTypes: [],
      inputTypes: [],
      typeExtensions: [],
      customScalarNames: null,
      customScalars: [
        {
          scalarName: "DateTime",
          description: null,
        },
      ],
      directiveDefinitions: null,
      hasQuery: false,
      hasMutation: false,
      hasErrors: false,
      diagnostics: [],
    });

    const scalarDef = result.definitions.find(
      (def) =>
        def.kind === Kind.SCALAR_TYPE_DEFINITION &&
        def.name.value === "DateTime",
    );

    expect(scalarDef).toBeDefined();
    if (scalarDef?.kind !== Kind.SCALAR_TYPE_DEFINITION) {
      throw new Error("Expected ScalarTypeDefinitionNode");
    }

    expect(scalarDef.description).toBeUndefined();
  });

  test("6.2 should join multiple descriptions with blank line separator", () => {
    const result = buildDocumentNode({
      baseTypes: [],
      inputTypes: [],
      typeExtensions: [],
      customScalarNames: null,
      customScalars: [
        {
          scalarName: "DateTime",
          description: "First description\n\nSecond description",
        },
      ],
      directiveDefinitions: null,
      hasQuery: false,
      hasMutation: false,
      hasErrors: false,
      diagnostics: [],
    });

    const scalarDef = result.definitions.find(
      (def) =>
        def.kind === Kind.SCALAR_TYPE_DEFINITION &&
        def.name.value === "DateTime",
    );

    expect(scalarDef).toBeDefined();
    if (scalarDef?.kind !== Kind.SCALAR_TYPE_DEFINITION) {
      throw new Error("Expected ScalarTypeDefinitionNode");
    }

    expect(scalarDef.description?.value).toBe(
      "First description\n\nSecond description",
    );
  });

  test("6.3 should generate ScalarTypeDefinitionNode for custom scalar", () => {
    const result = buildDocumentNode({
      baseTypes: [],
      inputTypes: [],
      typeExtensions: [],
      customScalarNames: null,
      customScalars: [
        {
          scalarName: "DateTime",
          description: "Custom date time scalar",
        },
        {
          scalarName: "URL",
          description: "URL scalar type",
        },
      ],
      directiveDefinitions: null,
      hasQuery: false,
      hasMutation: false,
      hasErrors: false,
      diagnostics: [],
    });

    const scalarDefs = result.definitions.filter(
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

    expect(dateTimeDef).toBeDefined();
    expect(urlDef).toBeDefined();
  });

  test("6.3 should sort scalars alphabetically by name", () => {
    const result = buildDocumentNode({
      baseTypes: [],
      inputTypes: [],
      typeExtensions: [],
      customScalarNames: null,
      customScalars: [
        {
          scalarName: "URL",
          description: null,
        },
        {
          scalarName: "DateTime",
          description: null,
        },
      ],
      directiveDefinitions: null,
      hasQuery: false,
      hasMutation: false,
      hasErrors: false,
      diagnostics: [],
    });

    const scalarDefs = result.definitions.filter(
      (def) => def.kind === Kind.SCALAR_TYPE_DEFINITION,
    );

    expect(scalarDefs).toHaveLength(2);
    expect(
      scalarDefs[0]?.kind === Kind.SCALAR_TYPE_DEFINITION &&
        scalarDefs[0]?.name.value,
    ).toBe("DateTime");
    expect(
      scalarDefs[1]?.kind === Kind.SCALAR_TYPE_DEFINITION &&
        scalarDefs[1]?.name.value,
    ).toBe("URL");
  });

  test("6.3 should not generate definitions for built-in scalars (handled by excluding them from customScalars)", () => {
    const result = buildDocumentNode({
      baseTypes: [],
      inputTypes: [],
      typeExtensions: [],
      customScalarNames: null,
      customScalars: [
        {
          scalarName: "DateTime",
          description: "Custom scalar only",
        },
      ],
      directiveDefinitions: null,
      hasQuery: false,
      hasMutation: false,
      hasErrors: false,
      diagnostics: [],
    });

    const scalarDefs = result.definitions.filter(
      (def) => def.kind === Kind.SCALAR_TYPE_DEFINITION,
    );

    expect(scalarDefs).toHaveLength(1);
    expect(
      scalarDefs[0]?.kind === Kind.SCALAR_TYPE_DEFINITION &&
        scalarDefs[0]?.name.value,
    ).toBe("DateTime");
  });

  test("should handle null customScalars (backward compatibility)", () => {
    const result = buildDocumentNode({
      baseTypes: [],
      inputTypes: [],
      typeExtensions: [],
      customScalarNames: null,
      customScalars: null,
      directiveDefinitions: null,
      hasQuery: false,
      hasMutation: false,
      hasErrors: false,
      diagnostics: [],
    });

    const scalarDefs = result.definitions.filter(
      (def) => def.kind === Kind.SCALAR_TYPE_DEFINITION,
    );

    expect(scalarDefs).toHaveLength(0);
  });

  test("should handle customScalarNames for backward compatibility", () => {
    const result = buildDocumentNode({
      baseTypes: [],
      inputTypes: [],
      typeExtensions: [],
      customScalarNames: ["DateTime", "URL"],
      customScalars: null,
      directiveDefinitions: null,
      hasQuery: false,
      hasMutation: false,
      hasErrors: false,
      diagnostics: [],
    });

    const scalarDefs = result.definitions.filter(
      (def) => def.kind === Kind.SCALAR_TYPE_DEFINITION,
    );

    expect(scalarDefs).toHaveLength(2);
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
          implementedInterfaces: null,
          directives: null,
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
              directives: null,
            },
          ],
        },
      ],
      inputTypes: [],
      typeExtensions: [],
      customScalarNames: null,
      customScalars: null,
      directiveDefinitions: null,
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
          implementedInterfaces: null,
          directives: null,
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
              directives: null,
            },
          ],
        },
      ],
      inputTypes: [],
      typeExtensions: [],
      customScalarNames: null,
      customScalars: null,
      directiveDefinitions: null,
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
          implementedInterfaces: null,
          directives: null,
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
      customScalars: null,
      directiveDefinitions: null,
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
          implementedInterfaces: null,
          directives: null,
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
      customScalars: null,
      directiveDefinitions: null,
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
