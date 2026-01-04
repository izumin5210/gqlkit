import { Kind } from "graphql";
import { describe, expect, test } from "vitest";
import type { DeprecationInfo } from "../../shared/tsdoc-parser.js";
import { buildDocumentNode } from "./ast-builder.js";

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
