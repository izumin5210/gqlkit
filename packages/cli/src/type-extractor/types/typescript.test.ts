import { describe, expect, it } from "vitest";
import type {
  FieldDefinition,
  InlineObjectPropertyDef,
  TSTypeReference,
} from "./typescript.js";

describe("TSTypeReference", () => {
  describe("inlineObject kind", () => {
    it("should support inlineObject kind with inlineObjectProperties", () => {
      const inlineObjectRef: TSTypeReference = {
        kind: "inlineObject",
        name: null,
        elementType: null,
        members: null,
        nullable: false,
        scalarInfo: null,
        inlineObjectProperties: [
          {
            name: "street",
            tsType: {
              kind: "primitive",
              name: "string",
              elementType: null,
              members: null,
              nullable: false,
              scalarInfo: null,
              inlineObjectProperties: null,
            },
            optional: false,
            description: "Street address",
            deprecated: null,
            directives: null,
            defaultValue: null,
          },
        ],
      };

      expect(inlineObjectRef.kind).toBe("inlineObject");
      expect(inlineObjectRef.inlineObjectProperties).toHaveLength(1);
      expect(inlineObjectRef.inlineObjectProperties?.[0]?.name).toBe("street");
    });

    it("should support nested inline objects", () => {
      const nestedInlineObject: TSTypeReference = {
        kind: "inlineObject",
        name: null,
        elementType: null,
        members: null,
        nullable: false,
        scalarInfo: null,
        inlineObjectProperties: [
          {
            name: "address",
            tsType: {
              kind: "inlineObject",
              name: null,
              elementType: null,
              members: null,
              nullable: false,
              scalarInfo: null,
              inlineObjectProperties: [
                {
                  name: "city",
                  tsType: {
                    kind: "primitive",
                    name: "string",
                    elementType: null,
                    members: null,
                    nullable: false,
                    scalarInfo: null,
                    inlineObjectProperties: null,
                  },
                  optional: false,
                  description: null,
                  deprecated: null,
                  directives: null,
                  defaultValue: null,
                },
              ],
            },
            optional: false,
            description: null,
            deprecated: null,
            directives: null,
            defaultValue: null,
          },
        ],
      };

      expect(nestedInlineObject.kind).toBe("inlineObject");
      const addressProp = nestedInlineObject.inlineObjectProperties?.[0];
      expect(addressProp?.tsType.kind).toBe("inlineObject");
      expect(addressProp?.tsType.inlineObjectProperties?.[0]?.name).toBe(
        "city",
      );
    });

    it("should support nullable inline objects", () => {
      const nullableInlineObject: TSTypeReference = {
        kind: "inlineObject",
        name: null,
        elementType: null,
        members: null,
        nullable: true,
        scalarInfo: null,
        inlineObjectProperties: [],
      };

      expect(nullableInlineObject.nullable).toBe(true);
    });
  });
});

describe("InlineObjectPropertyDef", () => {
  it("should have all required properties", () => {
    const property: InlineObjectPropertyDef = {
      name: "profile",
      tsType: {
        kind: "primitive",
        name: "string",
        elementType: null,
        members: null,
        nullable: false,
        scalarInfo: null,
        inlineObjectProperties: null,
      },
      optional: true,
      description: "User profile",
      deprecated: { isDeprecated: true, reason: "Use newProfile instead" },
      directives: [
        {
          name: "deprecated",
          args: [
            {
              name: "reason",
              value: { kind: "string", value: "Use newProfile instead" },
            },
          ],
        },
      ],
      defaultValue: { kind: "string", value: "default" },
    };

    expect(property.name).toBe("profile");
    expect(property.tsType.kind).toBe("primitive");
    expect(property.optional).toBe(true);
    expect(property.description).toBe("User profile");
    expect(property.deprecated?.reason).toBe("Use newProfile instead");
    expect(property.directives).toHaveLength(1);
    expect(property.defaultValue).toEqual({ kind: "string", value: "default" });
  });

  it("should allow null for optional metadata fields", () => {
    const minimalProperty: InlineObjectPropertyDef = {
      name: "id",
      tsType: {
        kind: "scalar",
        name: "ID",
        elementType: null,
        members: null,
        nullable: false,
        scalarInfo: {
          scalarName: "ID",
          typeName: "IDString",
          baseType: "string",
          isCustom: false,
          only: null,
        },
        inlineObjectProperties: null,
      },
      optional: false,
      description: null,
      deprecated: null,
      directives: null,
      defaultValue: null,
    };

    expect(minimalProperty.description).toBeNull();
    expect(minimalProperty.deprecated).toBeNull();
    expect(minimalProperty.directives).toBeNull();
    expect(minimalProperty.defaultValue).toBeNull();
  });
});

describe("FieldDefinition with inline object type", () => {
  it("should support tsType with inlineObject kind", () => {
    const field: FieldDefinition = {
      name: "profile",
      tsType: {
        kind: "inlineObject",
        name: null,
        elementType: null,
        members: null,
        nullable: false,
        scalarInfo: null,
        inlineObjectProperties: [
          {
            name: "bio",
            tsType: {
              kind: "primitive",
              name: "string",
              elementType: null,
              members: null,
              nullable: true,
              scalarInfo: null,
              inlineObjectProperties: null,
            },
            optional: true,
            description: "User biography",
            deprecated: null,
            directives: null,
            defaultValue: null,
          },
        ],
      },
      optional: false,
      description: "User profile information",
      deprecated: null,
      directives: null,
      defaultValue: null,
    };

    expect(field.tsType.kind).toBe("inlineObject");
    expect(field.tsType.inlineObjectProperties).toHaveLength(1);
  });
});

describe("Backward compatibility", () => {
  it("should support existing kind values with null inlineObjectProperties", () => {
    const primitiveRef: TSTypeReference = {
      kind: "primitive",
      name: "string",
      elementType: null,
      members: null,
      nullable: false,
      scalarInfo: null,
      inlineObjectProperties: null,
    };
    expect(primitiveRef.kind).toBe("primitive");
    expect(primitiveRef.inlineObjectProperties).toBeNull();

    const referenceRef: TSTypeReference = {
      kind: "reference",
      name: "User",
      elementType: null,
      members: null,
      nullable: false,
      scalarInfo: null,
      inlineObjectProperties: null,
    };
    expect(referenceRef.kind).toBe("reference");

    const arrayRef: TSTypeReference = {
      kind: "array",
      name: null,
      elementType: primitiveRef,
      members: null,
      nullable: false,
      scalarInfo: null,
      inlineObjectProperties: null,
    };
    expect(arrayRef.kind).toBe("array");

    const unionRef: TSTypeReference = {
      kind: "union",
      name: null,
      elementType: null,
      members: [primitiveRef],
      nullable: false,
      scalarInfo: null,
      inlineObjectProperties: null,
    };
    expect(unionRef.kind).toBe("union");

    const literalRef: TSTypeReference = {
      kind: "literal",
      name: "active",
      elementType: null,
      members: null,
      nullable: false,
      scalarInfo: null,
      inlineObjectProperties: null,
    };
    expect(literalRef.kind).toBe("literal");

    const scalarRef: TSTypeReference = {
      kind: "scalar",
      name: "DateTime",
      elementType: null,
      members: null,
      nullable: false,
      scalarInfo: {
        scalarName: "DateTime",
        typeName: "DateTime",
        baseType: undefined,
        isCustom: true,
        only: null,
      },
      inlineObjectProperties: null,
    };
    expect(scalarRef.kind).toBe("scalar");
  });
});
