import { describe, expect, it } from "vitest";
import type {
  ExtractedTypeInfo,
  InlineObjectPropertyDef,
  SourceLocation,
  TSTypeReference,
} from "../type-extractor/types/index.js";
import type { InlineUnionMemberInfo } from "./inline-union-types.js";
import {
  type ValidateOneOfMembersParams,
  type ValidateUnionMembersParams,
  type ValidateUnionMemberTypenamesParams,
  validateOneOfMembers,
  validateUnionMembers,
  validateUnionMemberTypenames,
} from "./inline-union-validator.js";

function createReferenceTsType(
  name: string,
  nullable = false,
): TSTypeReference {
  return {
    kind: "reference",
    name,
    elementType: null,
    members: null,
    nullable,
    scalarInfo: null,
    inlineObjectProperties: null,
    inlineEnumMembers: null,
    externalEnumSymbol: null,
    externalEnumDescription: null,
    externalEnumDeprecated: null,
    inlineObjectDescription: null,
    inlineObjectDeprecated: null,
  };
}

function createPrimitiveTsType(
  name: string,
  nullable = false,
): TSTypeReference {
  return {
    kind: "primitive",
    name,
    elementType: null,
    members: null,
    nullable,
    scalarInfo: null,
    inlineObjectProperties: null,
    inlineEnumMembers: null,
    externalEnumSymbol: null,
    externalEnumDescription: null,
    externalEnumDeprecated: null,
    inlineObjectDescription: null,
    inlineObjectDeprecated: null,
  };
}

function createInlineEnumTsType(
  values: string[],
  nullable = false,
): TSTypeReference {
  return {
    kind: "inlineEnum",
    name: null,
    elementType: null,
    members: null,
    nullable,
    scalarInfo: null,
    inlineObjectProperties: null,
    inlineEnumMembers: values.map((value) => ({
      value,
      description: null,
      deprecated: null,
    })),
    externalEnumSymbol: null,
    externalEnumDescription: null,
    externalEnumDeprecated: null,
    inlineObjectDescription: null,
    inlineObjectDeprecated: null,
  };
}

function createScalarTsType(
  name: string,
  scalarName: string,
  nullable = false,
): TSTypeReference {
  return {
    kind: "scalar",
    name,
    elementType: null,
    members: null,
    nullable,
    scalarInfo: {
      scalarName,
      typeName: name,
      baseType: "string",
      isCustom: false,
      only: null,
    },
    inlineObjectProperties: null,
    inlineEnumMembers: null,
    externalEnumSymbol: null,
    externalEnumDescription: null,
    externalEnumDeprecated: null,
    inlineObjectDescription: null,
    inlineObjectDeprecated: null,
  };
}

function createLiteralTsType(value: string, nullable = false): TSTypeReference {
  return {
    kind: "literal",
    name: value,
    elementType: null,
    members: null,
    nullable,
    scalarInfo: null,
    inlineObjectProperties: null,
    inlineEnumMembers: null,
    externalEnumSymbol: null,
    externalEnumDescription: null,
    externalEnumDeprecated: null,
    inlineObjectDescription: null,
    inlineObjectDeprecated: null,
  };
}

function createInlineObjectTsType(
  properties: InlineObjectPropertyDef[],
  nullable = false,
): TSTypeReference {
  return {
    kind: "inlineObject",
    name: null,
    elementType: null,
    members: null,
    nullable,
    scalarInfo: null,
    inlineObjectProperties: properties,
    inlineEnumMembers: null,
    externalEnumSymbol: null,
    externalEnumDescription: null,
    externalEnumDeprecated: null,
    inlineObjectDescription: null,
    inlineObjectDeprecated: null,
  };
}

function createInlineObjectProperty(
  name: string,
  tsType: TSTypeReference,
  optional = false,
): InlineObjectPropertyDef {
  return {
    name,
    tsType,
    optional,
    description: null,
    deprecated: null,
    directives: null,
    defaultValue: null,
    sourceLocation: null,
  };
}

function createMemberInfo(
  memberType: TSTypeReference,
  needsAutoGeneration: boolean,
): InlineUnionMemberInfo {
  return { memberType, needsAutoGeneration };
}

const defaultSourceLocation: SourceLocation = {
  file: "src/gqlkit/schema/types.ts",
  line: 10,
  column: 1,
};

function createExtractedType(
  name: string,
  kind: "object" | "enum" | "interface" = "object",
): ExtractedTypeInfo {
  return {
    metadata: {
      name,
      kind,
      sourceFile: "src/gqlkit/schema/types.ts",
      sourceLocation: defaultSourceLocation,
      exportKind: "named",
      description: null,
      deprecated: null,
      directives: null,
    },
    fields: [],
    unionMembers: null,
    inlineObjectMembers: null,
    enumMembers: kind === "enum" ? [] : null,
    implementedInterfaces: null,
  };
}

describe("validateUnionMembers", () => {
  describe("valid union members", () => {
    it("returns valid for union with object type references", () => {
      const params: ValidateUnionMembersParams = {
        members: [
          createMemberInfo(createReferenceTsType("Cat"), false),
          createMemberInfo(createReferenceTsType("Dog"), false),
        ],
        typeName: "Pet",
        sourceLocation: defaultSourceLocation,
        typeMap: new Map([
          ["Cat", createExtractedType("Cat", "object")],
          ["Dog", createExtractedType("Dog", "object")],
        ]),
      };

      const result = validateUnionMembers(params);

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it("returns valid for union with inline object members", () => {
      const params: ValidateUnionMembersParams = {
        members: [
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty("id", createPrimitiveTsType("string")),
            ]),
            true,
          ),
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty(
                "name",
                createPrimitiveTsType("string"),
              ),
            ]),
            true,
          ),
        ],
        typeName: "Result",
        sourceLocation: defaultSourceLocation,
        typeMap: new Map(),
      };

      const result = validateUnionMembers(params);

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it("returns valid for union mixing object references and inline objects", () => {
      const params: ValidateUnionMembersParams = {
        members: [
          createMemberInfo(createReferenceTsType("KnownType"), false),
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty("id", createPrimitiveTsType("string")),
            ]),
            true,
          ),
        ],
        typeName: "Mixed",
        sourceLocation: defaultSourceLocation,
        typeMap: new Map([["KnownType", createExtractedType("KnownType")]]),
      };

      const result = validateUnionMembers(params);

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });
  });

  describe("primitive type member errors", () => {
    it("reports error for string primitive member", () => {
      const params: ValidateUnionMembersParams = {
        members: [
          createMemberInfo(createReferenceTsType("Cat"), false),
          createMemberInfo(createPrimitiveTsType("string"), true),
        ],
        typeName: "Pet",
        sourceLocation: defaultSourceLocation,
        typeMap: new Map([["Cat", createExtractedType("Cat")]]),
      };

      const result = validateUnionMembers(params);

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "INLINE_UNION_PRIMITIVE_MEMBER",
        severity: "error",
        location: defaultSourceLocation,
      });
      expect(result.diagnostics[0]?.message).toContain("Pet");
      expect(result.diagnostics[0]?.message).toContain("string");
    });

    it("reports error for number primitive member", () => {
      const params: ValidateUnionMembersParams = {
        members: [createMemberInfo(createPrimitiveTsType("number"), true)],
        typeName: "Value",
        sourceLocation: defaultSourceLocation,
        typeMap: new Map(),
      };

      const result = validateUnionMembers(params);

      expect(result.valid).toBe(false);
      expect(result.diagnostics[0]?.code).toBe("INLINE_UNION_PRIMITIVE_MEMBER");
      expect(result.diagnostics[0]?.message).toContain("number");
    });

    it("reports error for boolean primitive member", () => {
      const params: ValidateUnionMembersParams = {
        members: [createMemberInfo(createPrimitiveTsType("boolean"), true)],
        typeName: "Flag",
        sourceLocation: defaultSourceLocation,
        typeMap: new Map(),
      };

      const result = validateUnionMembers(params);

      expect(result.valid).toBe(false);
      expect(result.diagnostics[0]?.code).toBe("INLINE_UNION_PRIMITIVE_MEMBER");
      expect(result.diagnostics[0]?.message).toContain("boolean");
    });

    it("reports multiple errors for multiple primitive members", () => {
      const params: ValidateUnionMembersParams = {
        members: [
          createMemberInfo(createPrimitiveTsType("string"), true),
          createMemberInfo(createPrimitiveTsType("number"), true),
        ],
        typeName: "Invalid",
        sourceLocation: defaultSourceLocation,
        typeMap: new Map(),
      };

      const result = validateUnionMembers(params);

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toHaveLength(2);
      expect(
        result.diagnostics.every(
          (d) => d.code === "INLINE_UNION_PRIMITIVE_MEMBER",
        ),
      ).toBe(true);
    });
  });

  describe("enum type member errors", () => {
    it("reports error for inline enum member", () => {
      const params: ValidateUnionMembersParams = {
        members: [
          createMemberInfo(createReferenceTsType("Cat"), false),
          createMemberInfo(
            createInlineEnumTsType(["active", "inactive"]),
            true,
          ),
        ],
        typeName: "Pet",
        sourceLocation: defaultSourceLocation,
        typeMap: new Map([["Cat", createExtractedType("Cat")]]),
      };

      const result = validateUnionMembers(params);

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "INLINE_UNION_ENUM_MEMBER",
        severity: "error",
        location: defaultSourceLocation,
      });
      expect(result.diagnostics[0]?.message).toContain("Pet");
      expect(result.diagnostics[0]?.message).toContain("enum");
    });

    it("reports error for reference to enum type", () => {
      const params: ValidateUnionMembersParams = {
        members: [
          createMemberInfo(createReferenceTsType("Cat"), false),
          createMemberInfo(createReferenceTsType("Status"), false),
        ],
        typeName: "Pet",
        sourceLocation: defaultSourceLocation,
        typeMap: new Map([
          ["Cat", createExtractedType("Cat", "object")],
          ["Status", createExtractedType("Status", "enum")],
        ]),
      };

      const result = validateUnionMembers(params);

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.code).toBe("INLINE_UNION_ENUM_MEMBER");
      expect(result.diagnostics[0]?.message).toContain("Status");
    });
  });

  describe("unresolvable member errors", () => {
    it("reports error for scalar type member", () => {
      const params: ValidateUnionMembersParams = {
        members: [
          createMemberInfo(createReferenceTsType("Cat"), false),
          createMemberInfo(createScalarTsType("ID", "ID"), true),
        ],
        typeName: "Pet",
        sourceLocation: defaultSourceLocation,
        typeMap: new Map([["Cat", createExtractedType("Cat")]]),
      };

      const result = validateUnionMembers(params);

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "INLINE_UNION_UNRESOLVABLE_MEMBER",
        severity: "error",
        location: defaultSourceLocation,
      });
    });

    it("reports error for unknown reference not in typeMap", () => {
      const params: ValidateUnionMembersParams = {
        members: [
          createMemberInfo(createReferenceTsType("Cat"), false),
          createMemberInfo(createReferenceTsType("UnknownType"), true),
        ],
        typeName: "Pet",
        sourceLocation: defaultSourceLocation,
        typeMap: new Map([["Cat", createExtractedType("Cat")]]),
      };

      const result = validateUnionMembers(params);

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.code).toBe(
        "INLINE_UNION_UNRESOLVABLE_MEMBER",
      );
      expect(result.diagnostics[0]?.message).toContain("UnknownType");
    });
  });

  describe("mixed errors", () => {
    it("reports all types of errors when present", () => {
      const params: ValidateUnionMembersParams = {
        members: [
          createMemberInfo(createPrimitiveTsType("string"), true),
          createMemberInfo(createInlineEnumTsType(["a", "b"]), true),
          createMemberInfo(createScalarTsType("ID", "ID"), true),
        ],
        typeName: "Invalid",
        sourceLocation: defaultSourceLocation,
        typeMap: new Map(),
      };

      const result = validateUnionMembers(params);

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toHaveLength(3);
      expect(
        result.diagnostics.some(
          (d) => d.code === "INLINE_UNION_PRIMITIVE_MEMBER",
        ),
      ).toBe(true);
      expect(
        result.diagnostics.some((d) => d.code === "INLINE_UNION_ENUM_MEMBER"),
      ).toBe(true);
      expect(
        result.diagnostics.some(
          (d) => d.code === "INLINE_UNION_UNRESOLVABLE_MEMBER",
        ),
      ).toBe(true);
    });
  });
});

describe("validateOneOfMembers", () => {
  describe("valid oneOf members", () => {
    it("returns valid for members with single property each", () => {
      const params: ValidateOneOfMembersParams = {
        members: [
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty(
                "byId",
                createPrimitiveTsType("string"),
              ),
            ]),
            true,
          ),
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty(
                "byEmail",
                createPrimitiveTsType("string"),
              ),
            ]),
            true,
          ),
        ],
        typeName: "UserFilterInput",
        sourceLocation: defaultSourceLocation,
        typeMap: new Map(),
      };

      const result = validateOneOfMembers(params);

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it("returns valid for members with scalar field types", () => {
      const params: ValidateOneOfMembersParams = {
        members: [
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty("id", createScalarTsType("ID", "ID")),
            ]),
            true,
          ),
        ],
        typeName: "FilterInput",
        sourceLocation: defaultSourceLocation,
        typeMap: new Map(),
      };

      const result = validateOneOfMembers(params);

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it("returns valid for members with enum field types", () => {
      const params: ValidateOneOfMembersParams = {
        members: [
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty(
                "status",
                createInlineEnumTsType(["active", "inactive"]),
              ),
            ]),
            true,
          ),
        ],
        typeName: "StatusFilterInput",
        sourceLocation: defaultSourceLocation,
        typeMap: new Map(),
      };

      const result = validateOneOfMembers(params);

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it("returns valid for members with input object reference types", () => {
      const params: ValidateOneOfMembersParams = {
        members: [
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty(
                "filter",
                createReferenceTsType("DateRangeInput"),
              ),
            ]),
            true,
          ),
        ],
        typeName: "SearchInput",
        sourceLocation: defaultSourceLocation,
        typeMap: new Map([
          ["DateRangeInput", createExtractedType("DateRangeInput")],
        ]),
      };

      const result = validateOneOfMembers(params);

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });
  });

  describe("empty object errors", () => {
    it("reports error for empty object member", () => {
      const params: ValidateOneOfMembersParams = {
        members: [
          createMemberInfo(createInlineObjectTsType([]), true),
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty("id", createPrimitiveTsType("string")),
            ]),
            true,
          ),
        ],
        typeName: "FilterInput",
        sourceLocation: defaultSourceLocation,
        typeMap: new Map(),
      };

      const result = validateOneOfMembers(params);

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "ONEOF_EMPTY_OBJECT",
        severity: "error",
        location: defaultSourceLocation,
      });
      expect(result.diagnostics[0]?.message).toContain("FilterInput");
    });
  });

  describe("multiple properties errors", () => {
    it("reports error for member with multiple properties", () => {
      const params: ValidateOneOfMembersParams = {
        members: [
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty("id", createPrimitiveTsType("string")),
              createInlineObjectProperty(
                "name",
                createPrimitiveTsType("string"),
              ),
            ]),
            true,
          ),
        ],
        typeName: "FilterInput",
        sourceLocation: defaultSourceLocation,
        typeMap: new Map(),
      };

      const result = validateOneOfMembers(params);

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "ONEOF_MULTIPLE_PROPERTIES",
        severity: "error",
        location: defaultSourceLocation,
      });
      expect(result.diagnostics[0]?.message).toContain("FilterInput");
      expect(result.diagnostics[0]?.message).toContain("2");
    });
  });

  describe("duplicate property name errors", () => {
    it("reports error for duplicate property names across members", () => {
      const params: ValidateOneOfMembersParams = {
        members: [
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty("id", createPrimitiveTsType("string")),
            ]),
            true,
          ),
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty("id", createPrimitiveTsType("number")),
            ]),
            true,
          ),
        ],
        typeName: "FilterInput",
        sourceLocation: defaultSourceLocation,
        typeMap: new Map(),
      };

      const result = validateOneOfMembers(params);

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "ONEOF_DUPLICATE_PROPERTY",
        severity: "error",
        location: defaultSourceLocation,
      });
      expect(result.diagnostics[0]?.message).toContain("FilterInput");
      expect(result.diagnostics[0]?.message).toContain("id");
    });
  });

  describe("invalid field type errors", () => {
    it("reports error for output object type field", () => {
      const params: ValidateOneOfMembersParams = {
        members: [
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty("user", createReferenceTsType("User")),
            ]),
            true,
          ),
        ],
        typeName: "FilterInput",
        sourceLocation: defaultSourceLocation,
        typeMap: new Map([["User", createExtractedType("User", "object")]]),
      };

      const result = validateOneOfMembers(params);

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "ONEOF_INVALID_FIELD_TYPE",
        severity: "error",
        location: defaultSourceLocation,
      });
      expect(result.diagnostics[0]?.message).toContain("FilterInput");
      expect(result.diagnostics[0]?.message).toContain("user");
      expect(result.diagnostics[0]?.message).toContain("User");
    });

    it("reports error for interface type field", () => {
      const params: ValidateOneOfMembersParams = {
        members: [
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty("node", createReferenceTsType("Node")),
            ]),
            true,
          ),
        ],
        typeName: "FilterInput",
        sourceLocation: defaultSourceLocation,
        typeMap: new Map([["Node", createExtractedType("Node", "interface")]]),
      };

      const result = validateOneOfMembers(params);

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.code).toBe("ONEOF_INVALID_FIELD_TYPE");
    });
  });

  describe("reference member handling", () => {
    it("skips validation for reference members (they are validated separately)", () => {
      const params: ValidateOneOfMembersParams = {
        members: [
          createMemberInfo(createReferenceTsType("TextContentInput"), false),
          createMemberInfo(createReferenceTsType("ImageContentInput"), false),
        ],
        typeName: "ContentInput",
        sourceLocation: defaultSourceLocation,
        typeMap: new Map([
          ["TextContentInput", createExtractedType("TextContentInput")],
          ["ImageContentInput", createExtractedType("ImageContentInput")],
        ]),
      };

      const result = validateOneOfMembers(params);

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });
  });

  describe("mixed errors", () => {
    it("reports multiple different types of errors", () => {
      const params: ValidateOneOfMembersParams = {
        members: [
          createMemberInfo(createInlineObjectTsType([]), true),
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty("id", createPrimitiveTsType("string")),
              createInlineObjectProperty(
                "name",
                createPrimitiveTsType("string"),
              ),
            ]),
            true,
          ),
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty("id", createReferenceTsType("User")),
            ]),
            true,
          ),
        ],
        typeName: "InvalidInput",
        sourceLocation: defaultSourceLocation,
        typeMap: new Map([["User", createExtractedType("User", "object")]]),
      };

      const result = validateOneOfMembers(params);

      expect(result.valid).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe("validateUnionMemberTypenames", () => {
  describe("valid union members with __typename", () => {
    it("returns valid when all inline members have __typename with string literal type", () => {
      const params: ValidateUnionMemberTypenamesParams = {
        members: [
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty(
                "__typename",
                createLiteralTsType("UpdateUserSuccess"),
              ),
              createInlineObjectProperty("user", createReferenceTsType("User")),
            ]),
            true,
          ),
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty(
                "__typename",
                createLiteralTsType("UpdateUserError"),
              ),
              createInlineObjectProperty(
                "message",
                createPrimitiveTsType("string"),
              ),
            ]),
            true,
          ),
        ],
        unionTypeName: "UpdateUserPayload",
        sourceLocation: defaultSourceLocation,
      };

      const result = validateUnionMemberTypenames(params);

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
      expect(result.memberTypenames.get(0)).toBe("UpdateUserSuccess");
      expect(result.memberTypenames.get(1)).toBe("UpdateUserError");
    });

    it("skips validation for named type members (needsAutoGeneration: false)", () => {
      const params: ValidateUnionMemberTypenamesParams = {
        members: [
          createMemberInfo(createReferenceTsType("ExistingSuccess"), false),
          createMemberInfo(createReferenceTsType("ExistingError"), false),
        ],
        unionTypeName: "MixedPayload",
        sourceLocation: defaultSourceLocation,
      };

      const result = validateUnionMemberTypenames(params);

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
      expect(result.memberTypenames.size).toBe(0);
    });

    it("validates only inline members in mixed union", () => {
      const params: ValidateUnionMemberTypenamesParams = {
        members: [
          createMemberInfo(createReferenceTsType("ExistingType"), false),
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty(
                "__typename",
                createLiteralTsType("InlineSuccess"),
              ),
              createInlineObjectProperty(
                "data",
                createPrimitiveTsType("string"),
              ),
            ]),
            true,
          ),
        ],
        unionTypeName: "MixedPayload",
        sourceLocation: defaultSourceLocation,
      };

      const result = validateUnionMemberTypenames(params);

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
      expect(result.memberTypenames.size).toBe(1);
      expect(result.memberTypenames.get(1)).toBe("InlineSuccess");
    });
  });

  describe("missing __typename property errors", () => {
    it("reports error when inline member is missing __typename property", () => {
      const params: ValidateUnionMemberTypenamesParams = {
        members: [
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty("user", createReferenceTsType("User")),
              createInlineObjectProperty(
                "message",
                createPrimitiveTsType("string"),
              ),
            ]),
            true,
          ),
        ],
        unionTypeName: "UpdateUserPayload",
        sourceLocation: defaultSourceLocation,
      };

      const result = validateUnionMemberTypenames(params);

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "MISSING_TYPENAME_PROPERTY",
        severity: "error",
        location: defaultSourceLocation,
      });
      expect(result.diagnostics[0]?.message).toContain("UpdateUserPayload");
      expect(result.diagnostics[0]?.message).toContain("0");
    });

    it("reports errors for multiple members missing __typename", () => {
      const params: ValidateUnionMemberTypenamesParams = {
        members: [
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty("id", createPrimitiveTsType("string")),
            ]),
            true,
          ),
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty(
                "name",
                createPrimitiveTsType("string"),
              ),
            ]),
            true,
          ),
        ],
        unionTypeName: "ResultPayload",
        sourceLocation: defaultSourceLocation,
      };

      const result = validateUnionMemberTypenames(params);

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toHaveLength(2);
      expect(
        result.diagnostics.every((d) => d.code === "MISSING_TYPENAME_PROPERTY"),
      ).toBe(true);
    });
  });

  describe("optional __typename property errors", () => {
    it("reports error when __typename is optional", () => {
      const params: ValidateUnionMemberTypenamesParams = {
        members: [
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty(
                "__typename",
                createLiteralTsType("UpdateUserSuccess"),
                true, // optional
              ),
              createInlineObjectProperty("user", createReferenceTsType("User")),
            ]),
            true,
          ),
        ],
        unionTypeName: "UpdateUserPayload",
        sourceLocation: defaultSourceLocation,
      };

      const result = validateUnionMemberTypenames(params);

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "OPTIONAL_TYPENAME_PROPERTY",
        severity: "error",
        location: defaultSourceLocation,
      });
      expect(result.diagnostics[0]?.message).toContain("UpdateUserPayload");
      expect(result.diagnostics[0]?.message).toContain("optional");
    });
  });

  describe("nullable __typename property errors", () => {
    it("reports error when __typename is nullable", () => {
      const params: ValidateUnionMemberTypenamesParams = {
        members: [
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty(
                "__typename",
                createLiteralTsType("UpdateUserSuccess", true), // nullable
              ),
              createInlineObjectProperty("user", createReferenceTsType("User")),
            ]),
            true,
          ),
        ],
        unionTypeName: "UpdateUserPayload",
        sourceLocation: defaultSourceLocation,
      };

      const result = validateUnionMemberTypenames(params);

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "NULLABLE_TYPENAME_PROPERTY",
        severity: "error",
        location: defaultSourceLocation,
      });
      expect(result.diagnostics[0]?.message).toContain("UpdateUserPayload");
      expect(result.diagnostics[0]?.message).toContain("nullable");
    });

    it("reports error when __typename is both optional and nullable", () => {
      const params: ValidateUnionMemberTypenamesParams = {
        members: [
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty(
                "__typename",
                createLiteralTsType("UpdateUserSuccess", true), // nullable
                true, // optional
              ),
            ]),
            true,
          ),
        ],
        unionTypeName: "UpdateUserPayload",
        sourceLocation: defaultSourceLocation,
      };

      const result = validateUnionMemberTypenames(params);

      expect(result.valid).toBe(false);
      // Should report both errors
      expect(result.diagnostics).toHaveLength(2);
      expect(
        result.diagnostics.some((d) => d.code === "OPTIONAL_TYPENAME_PROPERTY"),
      ).toBe(true);
      expect(
        result.diagnostics.some((d) => d.code === "NULLABLE_TYPENAME_PROPERTY"),
      ).toBe(true);
    });
  });

  describe("invalid __typename type errors", () => {
    it("reports error when __typename is not a string literal type (primitive string)", () => {
      const params: ValidateUnionMemberTypenamesParams = {
        members: [
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty(
                "__typename",
                createPrimitiveTsType("string"),
              ),
              createInlineObjectProperty("user", createReferenceTsType("User")),
            ]),
            true,
          ),
        ],
        unionTypeName: "UpdateUserPayload",
        sourceLocation: defaultSourceLocation,
      };

      const result = validateUnionMemberTypenames(params);

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "INVALID_TYPENAME_TYPE",
        severity: "error",
        location: defaultSourceLocation,
      });
      expect(result.diagnostics[0]?.message).toContain("UpdateUserPayload");
      expect(result.diagnostics[0]?.message).toContain("0");
      expect(result.diagnostics[0]?.message).toContain("string literal");
    });

    it("reports error when __typename is a reference type", () => {
      const params: ValidateUnionMemberTypenamesParams = {
        members: [
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty(
                "__typename",
                createReferenceTsType("SomeType"),
              ),
              createInlineObjectProperty(
                "data",
                createPrimitiveTsType("string"),
              ),
            ]),
            true,
          ),
        ],
        unionTypeName: "PayloadUnion",
        sourceLocation: defaultSourceLocation,
      };

      const result = validateUnionMemberTypenames(params);

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.code).toBe("INVALID_TYPENAME_TYPE");
    });

    it("reports error when __typename is a number type", () => {
      const params: ValidateUnionMemberTypenamesParams = {
        members: [
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty(
                "__typename",
                createPrimitiveTsType("number"),
              ),
            ]),
            true,
          ),
        ],
        unionTypeName: "InvalidPayload",
        sourceLocation: defaultSourceLocation,
      };

      const result = validateUnionMemberTypenames(params);

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.code).toBe("INVALID_TYPENAME_TYPE");
    });
  });

  describe("error message content", () => {
    it("includes union type name in error message", () => {
      const params: ValidateUnionMemberTypenamesParams = {
        members: [
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty("id", createPrimitiveTsType("string")),
            ]),
            true,
          ),
        ],
        unionTypeName: "SpecificUnionName",
        sourceLocation: defaultSourceLocation,
      };

      const result = validateUnionMemberTypenames(params);

      expect(result.diagnostics[0]?.message).toContain("SpecificUnionName");
    });

    it("includes member index in error message", () => {
      const params: ValidateUnionMemberTypenamesParams = {
        members: [
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty(
                "__typename",
                createLiteralTsType("ValidType"),
              ),
            ]),
            true,
          ),
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty("id", createPrimitiveTsType("string")),
            ]),
            true,
          ),
        ],
        unionTypeName: "TestPayload",
        sourceLocation: defaultSourceLocation,
      };

      const result = validateUnionMemberTypenames(params);

      expect(result.diagnostics[0]?.message).toContain("1");
    });
  });

  describe("mixed valid and invalid members", () => {
    it("reports only errors for invalid members", () => {
      const params: ValidateUnionMemberTypenamesParams = {
        members: [
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty(
                "__typename",
                createLiteralTsType("ValidSuccess"),
              ),
              createInlineObjectProperty(
                "data",
                createPrimitiveTsType("string"),
              ),
            ]),
            true,
          ),
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty(
                "message",
                createPrimitiveTsType("string"),
              ),
            ]),
            true,
          ),
          createMemberInfo(
            createInlineObjectTsType([
              createInlineObjectProperty(
                "__typename",
                createPrimitiveTsType("string"),
              ),
            ]),
            true,
          ),
        ],
        unionTypeName: "MixedPayload",
        sourceLocation: defaultSourceLocation,
      };

      const result = validateUnionMemberTypenames(params);

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toHaveLength(2);
      expect(
        result.diagnostics.some((d) => d.code === "MISSING_TYPENAME_PROPERTY"),
      ).toBe(true);
      expect(
        result.diagnostics.some((d) => d.code === "INVALID_TYPENAME_TYPE"),
      ).toBe(true);
      expect(result.memberTypenames.get(0)).toBe("ValidSuccess");
      expect(result.memberTypenames.has(1)).toBe(false);
      expect(result.memberTypenames.has(2)).toBe(false);
    });
  });
});
