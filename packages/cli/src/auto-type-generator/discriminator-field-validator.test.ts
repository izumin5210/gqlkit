import { describe, expect, it } from "vitest";
import type { InlineObjectMember, TSTypeReference } from "../core/index.js";
import type {
  ExtractedTypeInfo,
  FieldDefinition,
} from "../type-extractor/index.js";
import { validateDiscriminatorFields } from "./discriminator-field-validator.js";

function createStringLiteralTsType(value: string): TSTypeReference {
  return {
    kind: "stringLiteral",
    name: value,
    elementType: null,
    members: null,
    nullable: false,
    scalarInfo: null,
    inlineObjectProperties: null,
    inlineObjectDescription: null,
    inlineObjectDeprecated: null,
    inlineEnumMembers: null,
    inlineObjectHintName: null,
    externalEnumSymbol: null,
    externalEnumDescription: null,
    externalEnumDeprecated: null,
  };
}

function createStringLiteralField(
  fieldName: string,
  value: string,
): FieldDefinition {
  return {
    name: fieldName,
    tsType: createStringLiteralTsType(value),
    description: null,
    deprecated: null,
    directives: null,
    optional: false,
    defaultValue: null,
    sourceLocation: null,
  };
}

function createUnionType(
  name: string,
  unionMembers: string[],
): ExtractedTypeInfo {
  return {
    metadata: {
      name,
      kind: "union",
      sourceFile: "src/types.ts",
      sourceLocation: { file: "src/types.ts", line: 1, column: 1 },
      exportKind: "named",
      description: null,
      deprecated: null,
      directives: null,
    },
    fields: [],
    unionMembers,
    inlineObjectMembers: null,
    enumMembers: null,
    implementedInterfaces: null,
  };
}

function createObjectType(
  name: string,
  fields: FieldDefinition[],
): ExtractedTypeInfo {
  return {
    metadata: {
      name,
      kind: "object",
      sourceFile: "src/types.ts",
      sourceLocation: { file: "src/types.ts", line: 1, column: 1 },
      exportKind: "named",
      description: null,
      deprecated: null,
      directives: null,
    },
    fields,
    unionMembers: null,
    inlineObjectMembers: null,
    enumMembers: null,
    implementedInterfaces: null,
  };
}

function createUnionTypeWithInlineMembers(
  name: string,
  unionMembers: string[],
  inlineObjectMembers: InlineObjectMember[],
): ExtractedTypeInfo {
  return {
    metadata: {
      name,
      kind: "union",
      sourceFile: "src/types.ts",
      sourceLocation: { file: "src/types.ts", line: 1, column: 1 },
      exportKind: "named",
      description: null,
      deprecated: null,
      directives: null,
    },
    fields: [],
    unionMembers,
    inlineObjectMembers,
    enumMembers: null,
    implementedInterfaces: null,
  };
}

function createInlineObjectMember(
  properties: ReadonlyArray<{ name: string; tsType: TSTypeReference }>,
): InlineObjectMember {
  return {
    properties: properties.map((p) => ({
      propertyName: p.name,
      propertyType: p.tsType,
      description: null,
      deprecated: null,
    })),
  };
}

describe("validateDiscriminatorFields", () => {
  describe("validatedEntries", () => {
    it("returns validated entries for named union members with single discriminator field", () => {
      const textPart = createObjectType("TextPart", [
        createStringLiteralField("type", "text"),
      ]);
      const imagePart = createObjectType("ImagePart", [
        createStringLiteralField("type", "image"),
      ]);
      const contentPart = createUnionType("ContentPart", [
        "TextPart",
        "ImagePart",
      ]);

      const typeMap = new Map<string, ExtractedTypeInfo>([
        ["ContentPart", contentPart],
        ["TextPart", textPart],
        ["ImagePart", imagePart],
      ]);

      const result = validateDiscriminatorFields({
        inlineDiscriminatorUnionNames: new Set(),
        discriminatorFields: new Map([["ContentPart", ["type"]]]),
        extractedTypes: [contentPart, textPart, imagePart],
        typeMap,
      });

      expect(result.diagnostics).toHaveLength(0);
      expect(result.validatedEntries).toHaveLength(1);
      expect(result.validatedEntries[0]).toEqual({
        unionTypeName: "ContentPart",
        fieldNames: ["type"],
        memberValueTuples: [
          {
            memberTypeName: "TextPart",
            memberIndex: 0,
            values: ["text"],
            isInlineObject: false,
          },
          {
            memberTypeName: "ImagePart",
            memberIndex: 1,
            values: ["image"],
            isInlineObject: false,
          },
        ],
      });
    });

    it("returns validated entries for multiple discriminator fields with named members", () => {
      const textContent = createObjectType("TextContent", [
        createStringLiteralField("type", "text"),
      ]);
      const jpegContent = createObjectType("JpegContent", [
        createStringLiteralField("type", "media"),
        createStringLiteralField("mediaType", "jpeg"),
      ]);
      const pngContent = createObjectType("PngContent", [
        createStringLiteralField("type", "media"),
        createStringLiteralField("mediaType", "png"),
      ]);
      const content = createUnionType("Content", [
        "TextContent",
        "JpegContent",
        "PngContent",
      ]);

      const typeMap = new Map<string, ExtractedTypeInfo>([
        ["Content", content],
        ["TextContent", textContent],
        ["JpegContent", jpegContent],
        ["PngContent", pngContent],
      ]);

      const result = validateDiscriminatorFields({
        inlineDiscriminatorUnionNames: new Set(),
        discriminatorFields: new Map([["Content", ["type", "mediaType"]]]),
        extractedTypes: [content, textContent, jpegContent, pngContent],
        typeMap,
      });

      expect(result.diagnostics).toHaveLength(0);
      expect(result.validatedEntries).toHaveLength(1);
      expect(result.validatedEntries[0]).toEqual({
        unionTypeName: "Content",
        fieldNames: ["type", "mediaType"],
        memberValueTuples: [
          {
            memberTypeName: "TextContent",
            memberIndex: 0,
            values: ["text", null],
            isInlineObject: false,
          },
          {
            memberTypeName: "JpegContent",
            memberIndex: 1,
            values: ["media", "jpeg"],
            isInlineObject: false,
          },
          {
            memberTypeName: "PngContent",
            memberIndex: 2,
            values: ["media", "png"],
            isInlineObject: false,
          },
        ],
      });
    });

    it("returns validated entries for inline object members", () => {
      const inlineText = createInlineObjectMember([
        { name: "type", tsType: createStringLiteralTsType("text") },
      ]);
      const inlineImage = createInlineObjectMember([
        { name: "type", tsType: createStringLiteralTsType("image") },
      ]);
      const contentPart = createUnionTypeWithInlineMembers(
        "ContentPart",
        [],
        [inlineText, inlineImage],
      );

      const typeMap = new Map<string, ExtractedTypeInfo>([
        ["ContentPart", contentPart],
      ]);

      const result = validateDiscriminatorFields({
        inlineDiscriminatorUnionNames: new Set(),
        discriminatorFields: new Map([["ContentPart", ["type"]]]),
        extractedTypes: [contentPart],
        typeMap,
      });

      expect(result.diagnostics).toHaveLength(0);
      expect(result.validatedEntries).toHaveLength(1);
      expect(result.validatedEntries[0]).toEqual({
        unionTypeName: "ContentPart",
        fieldNames: ["type"],
        memberValueTuples: [
          {
            memberTypeName: null,
            memberIndex: 0,
            values: ["text"],
            isInlineObject: true,
          },
          {
            memberTypeName: null,
            memberIndex: 1,
            values: ["image"],
            isInlineObject: true,
          },
        ],
      });
    });

    it("returns empty validatedEntries when there are validation errors", () => {
      const textPart = createObjectType("TextPart", []);
      const contentPart = createUnionType("ContentPart", ["TextPart"]);

      const typeMap = new Map<string, ExtractedTypeInfo>([
        ["ContentPart", contentPart],
        ["TextPart", textPart],
      ]);

      const result = validateDiscriminatorFields({
        inlineDiscriminatorUnionNames: new Set(),
        discriminatorFields: new Map([["ContentPart", ["type"]]]),
        extractedTypes: [contentPart, textPart],
        typeMap,
      });

      expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
      // When primary field errors occur, the entry should not be in validatedEntries
      expect(result.validatedEntries).toHaveLength(0);
    });

    it("excludes entries for unknown unions from validatedEntries", () => {
      const result = validateDiscriminatorFields({
        inlineDiscriminatorUnionNames: new Set(),
        discriminatorFields: new Map([["NonExistent", ["type"]]]),
        extractedTypes: [],
        typeMap: new Map(),
      });

      expect(result.validatedEntries).toHaveLength(0);
    });
  });

  describe("DISCRIMINATOR_UNKNOWN_UNION warning", () => {
    it("emits a warning when a union name in discriminatorFields does not exist in typeMap", () => {
      const discriminatorFields = new Map<string, ReadonlyArray<string>>([
        ["NonExistentUnion", ["type"]],
      ]);

      const result = validateDiscriminatorFields({
        inlineDiscriminatorUnionNames: new Set(),
        discriminatorFields,
        extractedTypes: [],
        typeMap: new Map(),
      });

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "DISCRIMINATOR_UNKNOWN_UNION",
        severity: "warning",
        message:
          "Union type 'NonExistentUnion' specified in discriminatorFields does not exist.",
        location: null,
      });
    });

    it("emits warnings for multiple unknown union names", () => {
      const textPart = createObjectType("TextPart", [
        createStringLiteralField("type", "text"),
      ]);
      const imagePart = createObjectType("ImagePart", [
        createStringLiteralField("type", "image"),
      ]);
      const contentPart = createUnionType("ContentPart", [
        "TextPart",
        "ImagePart",
      ]);

      const typeMap = new Map<string, ExtractedTypeInfo>([
        ["ContentPart", contentPart],
        ["TextPart", textPart],
        ["ImagePart", imagePart],
      ]);

      const discriminatorFields = new Map<string, ReadonlyArray<string>>([
        ["ContentPart", ["type"]],
        ["UnknownA", ["kind"]],
        ["UnknownB", ["tag"]],
      ]);

      const result = validateDiscriminatorFields({
        inlineDiscriminatorUnionNames: new Set(),
        discriminatorFields,
        extractedTypes: [contentPart, textPart, imagePart],
        typeMap,
      });

      const unknownWarnings = result.diagnostics.filter(
        (d) => d.code === "DISCRIMINATOR_UNKNOWN_UNION",
      );
      expect(unknownWarnings).toHaveLength(2);
      expect(unknownWarnings[0]).toMatchObject({
        code: "DISCRIMINATOR_UNKNOWN_UNION",
        severity: "warning",
        message:
          "Union type 'UnknownA' specified in discriminatorFields does not exist.",
      });
      expect(unknownWarnings[1]).toMatchObject({
        code: "DISCRIMINATOR_UNKNOWN_UNION",
        severity: "warning",
        message:
          "Union type 'UnknownB' specified in discriminatorFields does not exist.",
      });
    });

    it("does not emit a warning for known union names", () => {
      const textPart = createObjectType("TextPart", [
        createStringLiteralField("type", "text"),
      ]);
      const imagePart = createObjectType("ImagePart", [
        createStringLiteralField("type", "image"),
      ]);
      const contentPart = createUnionType("ContentPart", [
        "TextPart",
        "ImagePart",
      ]);

      const typeMap = new Map<string, ExtractedTypeInfo>([
        ["ContentPart", contentPart],
        ["TextPart", textPart],
        ["ImagePart", imagePart],
      ]);

      const discriminatorFields = new Map<string, ReadonlyArray<string>>([
        ["ContentPart", ["type"]],
      ]);

      const result = validateDiscriminatorFields({
        inlineDiscriminatorUnionNames: new Set(),
        discriminatorFields,
        extractedTypes: [contentPart, textPart, imagePart],
        typeMap,
      });

      const unknownWarnings = result.diagnostics.filter(
        (d) => d.code === "DISCRIMINATOR_UNKNOWN_UNION",
      );
      expect(unknownWarnings).toHaveLength(0);
    });
  });
});
