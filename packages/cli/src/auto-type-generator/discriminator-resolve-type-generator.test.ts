import { describe, expect, it } from "vitest";
import type { InlineObjectProperty, TSTypeReference } from "../core/index.js";
import type { ExtractedTypeInfo } from "../type-extractor/index.js";
import {
  collectDiscriminatorResolveTypes,
  type ValidatedDiscriminatorEntry,
} from "./discriminator-resolve-type-generator.js";

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

function createPrimitiveTsType(name: string): TSTypeReference {
  return {
    kind: "primitive",
    name,
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

function createInlineProperty(
  propertyName: string,
  propertyType: TSTypeReference,
): InlineObjectProperty {
  return {
    propertyName,
    propertyType,
    description: null,
    deprecated: null,
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

function createObjectType(name: string): ExtractedTypeInfo {
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
    fields: [],
    unionMembers: null,
    inlineObjectMembers: null,
    enumMembers: null,
    implementedInterfaces: null,
  };
}

describe("collectDiscriminatorResolveTypes", () => {
  describe("single discriminator field", () => {
    it("generates direct value-to-type-name mappings for named members", () => {
      const textPart = createObjectType("TextPart");
      const imagePart = createObjectType("ImagePart");
      const contentPart = createUnionType("ContentPart", [
        "TextPart",
        "ImagePart",
      ]);

      const extractedTypes = [contentPart, textPart, imagePart];
      const typeMap = new Map<string, ExtractedTypeInfo>(
        extractedTypes.map((t) => [t.metadata.name, t]),
      );

      const validatedEntries: ValidatedDiscriminatorEntry[] = [
        {
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
        },
      ];

      const result = collectDiscriminatorResolveTypes({
        validatedEntries,
        manualResolveTypeNames: new Set(),
        extractedTypes,
        typeMap,
      });

      expect(result.discriminatorResolveTypes).toHaveLength(1);
      expect(result.discriminatorResolveTypes[0]).toEqual({
        unionTypeName: "ContentPart",
        fieldNames: ["type"],
        valueMappings: [
          { memberGraphQLTypeName: "TextPart", values: ["text"] },
          { memberGraphQLTypeName: "ImagePart", values: ["image"] },
        ],
      });
      expect(result.discriminatorResolveTypeNames.has("ContentPart")).toBe(
        true,
      );
    });

    it("generates type names for inline object members using discriminator naming", () => {
      const contentPart = createUnionType("ContentPart", []);
      // Simulate a union with only inline object members
      const inlineContentPart: ExtractedTypeInfo = {
        ...contentPart,
        inlineObjectMembers: [
          {
            properties: [
              createInlineProperty("type", createStringLiteralTsType("text")),
            ],
          },
          {
            properties: [
              createInlineProperty("type", createStringLiteralTsType("image")),
            ],
          },
        ],
      };

      const extractedTypes = [inlineContentPart];
      const typeMap = new Map<string, ExtractedTypeInfo>([
        ["ContentPart", inlineContentPart],
      ]);

      const validatedEntries: ValidatedDiscriminatorEntry[] = [
        {
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
        },
      ];

      const result = collectDiscriminatorResolveTypes({
        validatedEntries,
        manualResolveTypeNames: new Set(),
        extractedTypes,
        typeMap,
      });

      expect(result.discriminatorResolveTypes).toHaveLength(1);
      expect(result.discriminatorResolveTypes[0]).toEqual({
        unionTypeName: "ContentPart",
        fieldNames: ["type"],
        valueMappings: [
          { memberGraphQLTypeName: "ContentPartText", values: ["text"] },
          { memberGraphQLTypeName: "ContentPartImage", values: ["image"] },
        ],
      });
      expect(result.discriminatorResolveTypeNames.has("ContentPart")).toBe(
        true,
      );
    });
  });

  describe("multiple discriminator fields", () => {
    it("generates value tuple mappings for multiple fields", () => {
      const content = createUnionType("Content", []);
      const inlineContent: ExtractedTypeInfo = {
        ...content,
        inlineObjectMembers: [
          { properties: [] },
          { properties: [] },
          { properties: [] },
        ],
      };

      const extractedTypes = [inlineContent];
      const typeMap = new Map<string, ExtractedTypeInfo>([
        ["Content", inlineContent],
      ]);

      const validatedEntries: ValidatedDiscriminatorEntry[] = [
        {
          unionTypeName: "Content",
          fieldNames: ["type", "mediaType"],
          memberValueTuples: [
            {
              memberTypeName: null,
              memberIndex: 0,
              values: ["text", null],
              isInlineObject: true,
            },
            {
              memberTypeName: null,
              memberIndex: 1,
              values: ["media", "jpeg"],
              isInlineObject: true,
            },
            {
              memberTypeName: null,
              memberIndex: 2,
              values: ["media", "png"],
              isInlineObject: true,
            },
          ],
        },
      ];

      const result = collectDiscriminatorResolveTypes({
        validatedEntries,
        manualResolveTypeNames: new Set(),
        extractedTypes,
        typeMap,
      });

      expect(result.discriminatorResolveTypes).toHaveLength(1);
      expect(result.discriminatorResolveTypes[0]).toEqual({
        unionTypeName: "Content",
        fieldNames: ["type", "mediaType"],
        valueMappings: [
          { memberGraphQLTypeName: "ContentText", values: ["text", null] },
          {
            memberGraphQLTypeName: "ContentMediaJpeg",
            values: ["media", "jpeg"],
          },
          {
            memberGraphQLTypeName: "ContentMediaPng",
            values: ["media", "png"],
          },
        ],
      });
    });
  });

  describe("manual defineResolveType skipping", () => {
    it("skips unions that have manual defineResolveType", () => {
      const textPart = createObjectType("TextPart");
      const imagePart = createObjectType("ImagePart");
      const contentPart = createUnionType("ContentPart", [
        "TextPart",
        "ImagePart",
      ]);

      const extractedTypes = [contentPart, textPart, imagePart];
      const typeMap = new Map<string, ExtractedTypeInfo>(
        extractedTypes.map((t) => [t.metadata.name, t]),
      );

      const validatedEntries: ValidatedDiscriminatorEntry[] = [
        {
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
        },
      ];

      const result = collectDiscriminatorResolveTypes({
        validatedEntries,
        manualResolveTypeNames: new Set(["ContentPart"]),
        extractedTypes,
        typeMap,
      });

      expect(result.discriminatorResolveTypes).toHaveLength(0);
      expect(result.discriminatorResolveTypeNames.size).toBe(0);
    });

    it("processes unions without manual defineResolveType while skipping those with it", () => {
      const textPart = createObjectType("TextPart");
      const imagePart = createObjectType("ImagePart");
      const catType = createObjectType("Cat");
      const dogType = createObjectType("Dog");
      const contentPart = createUnionType("ContentPart", [
        "TextPart",
        "ImagePart",
      ]);
      const animal = createUnionType("Animal", ["Cat", "Dog"]);

      const extractedTypes = [
        contentPart,
        textPart,
        imagePart,
        animal,
        catType,
        dogType,
      ];
      const typeMap = new Map<string, ExtractedTypeInfo>(
        extractedTypes.map((t) => [t.metadata.name, t]),
      );

      const validatedEntries: ValidatedDiscriminatorEntry[] = [
        {
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
        },
        {
          unionTypeName: "Animal",
          fieldNames: ["kind"],
          memberValueTuples: [
            {
              memberTypeName: "Cat",
              memberIndex: 0,
              values: ["cat"],
              isInlineObject: false,
            },
            {
              memberTypeName: "Dog",
              memberIndex: 1,
              values: ["dog"],
              isInlineObject: false,
            },
          ],
        },
      ];

      const result = collectDiscriminatorResolveTypes({
        validatedEntries,
        manualResolveTypeNames: new Set(["ContentPart"]),
        extractedTypes,
        typeMap,
      });

      expect(result.discriminatorResolveTypes).toHaveLength(1);
      expect(result.discriminatorResolveTypes[0]!.unionTypeName).toBe("Animal");
      expect(result.discriminatorResolveTypeNames.has("Animal")).toBe(true);
      expect(result.discriminatorResolveTypeNames.has("ContentPart")).toBe(
        false,
      );
    });
  });

  describe("autoResolveTypeNames suppression", () => {
    it("adds all processed union type names to discriminatorResolveTypeNames", () => {
      const textPart = createObjectType("TextPart");
      const imagePart = createObjectType("ImagePart");
      const catType = createObjectType("Cat");
      const dogType = createObjectType("Dog");
      const contentPart = createUnionType("ContentPart", [
        "TextPart",
        "ImagePart",
      ]);
      const animal = createUnionType("Animal", ["Cat", "Dog"]);

      const extractedTypes = [
        contentPart,
        textPart,
        imagePart,
        animal,
        catType,
        dogType,
      ];
      const typeMap = new Map<string, ExtractedTypeInfo>(
        extractedTypes.map((t) => [t.metadata.name, t]),
      );

      const validatedEntries: ValidatedDiscriminatorEntry[] = [
        {
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
        },
        {
          unionTypeName: "Animal",
          fieldNames: ["kind"],
          memberValueTuples: [
            {
              memberTypeName: "Cat",
              memberIndex: 0,
              values: ["cat"],
              isInlineObject: false,
            },
            {
              memberTypeName: "Dog",
              memberIndex: 1,
              values: ["dog"],
              isInlineObject: false,
            },
          ],
        },
      ];

      const result = collectDiscriminatorResolveTypes({
        validatedEntries,
        manualResolveTypeNames: new Set(),
        extractedTypes,
        typeMap,
      });

      expect(result.discriminatorResolveTypeNames.has("ContentPart")).toBe(
        true,
      );
      expect(result.discriminatorResolveTypeNames.has("Animal")).toBe(true);
      expect(result.discriminatorResolveTypeNames.size).toBe(2);
    });
  });

  describe("generated object types for inline members", () => {
    it("generates AutoGeneratedType entries for inline object members", () => {
      const contentPart: ExtractedTypeInfo = {
        metadata: {
          name: "ContentPart",
          kind: "union",
          sourceFile: "src/types.ts",
          sourceLocation: { file: "src/types.ts", line: 1, column: 1 },
          exportKind: "named",
          description: null,
          deprecated: null,
          directives: null,
        },
        fields: [],
        unionMembers: [],
        inlineObjectMembers: [
          {
            properties: [
              createInlineProperty("type", createStringLiteralTsType("text")),
              createInlineProperty("content", createPrimitiveTsType("string")),
            ],
          },
        ],
        enumMembers: null,
        implementedInterfaces: null,
      };

      const extractedTypes = [contentPart];
      const typeMap = new Map<string, ExtractedTypeInfo>([
        ["ContentPart", contentPart],
      ]);

      const validatedEntries: ValidatedDiscriminatorEntry[] = [
        {
          unionTypeName: "ContentPart",
          fieldNames: ["type"],
          memberValueTuples: [
            {
              memberTypeName: null,
              memberIndex: 0,
              values: ["text"],
              isInlineObject: true,
            },
          ],
        },
      ];

      const result = collectDiscriminatorResolveTypes({
        validatedEntries,
        manualResolveTypeNames: new Set(),
        extractedTypes,
        typeMap,
      });

      expect(result.generatedObjectTypes).toHaveLength(1);
      expect(result.generatedObjectTypes[0]!.name).toBe("ContentPartText");
      expect(result.generatedObjectTypes[0]!.kind).toBe("Object");
      expect(result.generatedObjectTypes[0]!.generatedFrom).toEqual({
        parentTypeName: "ContentPart",
        fieldPath: [],
        context: "typeField",
      });
    });

    it("does not generate object types for named members", () => {
      const textPart = createObjectType("TextPart");
      const contentPart = createUnionType("ContentPart", ["TextPart"]);

      const extractedTypes = [contentPart, textPart];
      const typeMap = new Map<string, ExtractedTypeInfo>(
        extractedTypes.map((t) => [t.metadata.name, t]),
      );

      const validatedEntries: ValidatedDiscriminatorEntry[] = [
        {
          unionTypeName: "ContentPart",
          fieldNames: ["type"],
          memberValueTuples: [
            {
              memberTypeName: "TextPart",
              memberIndex: 0,
              values: ["text"],
              isInlineObject: false,
            },
          ],
        },
      ];

      const result = collectDiscriminatorResolveTypes({
        validatedEntries,
        manualResolveTypeNames: new Set(),
        extractedTypes,
        typeMap,
      });

      expect(result.generatedObjectTypes).toHaveLength(0);
    });
  });

  describe("empty entries", () => {
    it("returns empty results when no validated entries are provided", () => {
      const result = collectDiscriminatorResolveTypes({
        validatedEntries: [],
        manualResolveTypeNames: new Set(),
        extractedTypes: [],
        typeMap: new Map(),
      });

      expect(result.discriminatorResolveTypes).toHaveLength(0);
      expect(result.discriminatorResolveTypeNames.size).toBe(0);
      expect(result.generatedObjectTypes).toHaveLength(0);
    });
  });

  describe("mixed named and inline members", () => {
    it("handles unions with both named and inline object members", () => {
      const textPart = createObjectType("TextPart");
      const contentPart: ExtractedTypeInfo = {
        metadata: {
          name: "ContentPart",
          kind: "union",
          sourceFile: "src/types.ts",
          sourceLocation: { file: "src/types.ts", line: 1, column: 1 },
          exportKind: "named",
          description: null,
          deprecated: null,
          directives: null,
        },
        fields: [],
        unionMembers: ["TextPart"],
        inlineObjectMembers: [
          {
            properties: [
              createInlineProperty("type", createStringLiteralTsType("image")),
            ],
          },
        ],
        enumMembers: null,
        implementedInterfaces: null,
      };

      const extractedTypes = [contentPart, textPart];
      const typeMap = new Map<string, ExtractedTypeInfo>(
        extractedTypes.map((t) => [t.metadata.name, t]),
      );

      const validatedEntries: ValidatedDiscriminatorEntry[] = [
        {
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
              memberTypeName: null,
              memberIndex: 1,
              values: ["image"],
              isInlineObject: true,
            },
          ],
        },
      ];

      const result = collectDiscriminatorResolveTypes({
        validatedEntries,
        manualResolveTypeNames: new Set(),
        extractedTypes,
        typeMap,
      });

      expect(result.discriminatorResolveTypes).toHaveLength(1);
      expect(result.discriminatorResolveTypes[0]!.valueMappings).toEqual([
        { memberGraphQLTypeName: "TextPart", values: ["text"] },
        { memberGraphQLTypeName: "ContentPartImage", values: ["image"] },
      ]);

      // Only inline members generate object types
      expect(result.generatedObjectTypes).toHaveLength(1);
      expect(result.generatedObjectTypes[0]!.name).toBe("ContentPartImage");
    });
  });
});
