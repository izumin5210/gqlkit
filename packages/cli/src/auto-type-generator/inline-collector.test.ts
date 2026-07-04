import { describe, expect, it } from "vitest";
import {
  createArrayType,
  createInlineEnumType,
  createInlineObjectType,
  createReferenceType,
  createUnionType,
  type InlineEnumMemberInfo,
  type InlineObjectPropertyDef,
  type SourceLocation,
  type TSTypeReference,
} from "../core/index.js";
import type {
  ExtractedTypeInfo,
  FieldDefinition,
} from "../type-extractor/types/index.js";
import { collectInlineEnumsFromTypes } from "./inline-enum-collector.js";
import { collectInlineUnionsFromTypes } from "./inline-union-collector.js";

const sourceLocation: SourceLocation = {
  file: "src/gqlkit/schema/types.ts",
  line: 1,
  column: 1,
};

function createField(name: string, tsType: TSTypeReference): FieldDefinition {
  return {
    name,
    tsType,
    optional: false,
    description: null,
    deprecated: null,
    directives: null,
    defaultValue: null,
    sourceLocation,
  };
}

function createProperty(
  name: string,
  tsType: TSTypeReference,
): InlineObjectPropertyDef {
  return {
    name,
    tsType,
    optional: false,
    description: null,
    deprecated: null,
    directives: null,
    defaultValue: null,
    sourceLocation,
  };
}

function createExtractedType(
  fields: ReadonlyArray<FieldDefinition>,
): ExtractedTypeInfo {
  return {
    metadata: {
      name: "Container",
      kind: "object",
      sourceFile: sourceLocation.file,
      sourceLocation,
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

describe("inline collectors", () => {
  it("collects nested inline enums from array-backed inline objects", () => {
    const enumMembers: ReadonlyArray<InlineEnumMemberInfo> = [
      { value: "open", description: null, deprecated: null },
      { value: "closed", description: null, deprecated: null },
    ];
    const partsField = createField(
      "parts",
      createArrayType(
        createInlineObjectType({
          properties: [
            createProperty(
              "status",
              createInlineEnumType({
                members: enumMembers,
                nullable: false,
                externalEnumSymbol: null,
                externalEnumDescription: null,
                externalEnumDeprecated: null,
              }),
            ),
          ],
          description: null,
          deprecated: null,
          hintName: null,
        }),
      ),
    );

    const result = collectInlineEnumsFromTypes([
      createExtractedType([partsField]),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      context: {
        kind: "objectField",
        parentTypeName: "Container",
        fieldPath: ["part", "status"],
      },
      nullable: false,
    });
    expect(result[0]?.members.map((member) => member.value)).toEqual([
      "open",
      "closed",
    ]);
  });

  it("collects nested inline unions from array-backed inline objects", () => {
    const partsField = createField(
      "parts",
      createArrayType(
        createInlineObjectType({
          properties: [
            createProperty(
              "owner",
              createUnionType({
                members: [
                  createReferenceType({ name: "User", nullable: false }),
                  createReferenceType({ name: "Bot", nullable: false }),
                ],
                nullable: false,
                aliasName: null,
              }),
            ),
          ],
          description: null,
          deprecated: null,
          hintName: null,
        }),
      ),
    );

    const result = collectInlineUnionsFromTypes({
      extractedTypes: [createExtractedType([partsField])],
      knownTypeNames: new Set(["User", "Bot"]),
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      context: {
        kind: "objectField",
        parentTypeName: "Container",
        fieldPath: ["part", "owner"],
      },
      nullable: false,
      isInputContext: false,
    });
    expect(
      result[0]?.members.map((member) => ({
        name: member.memberType.name,
        needsAutoGeneration: member.needsAutoGeneration,
      })),
    ).toEqual([
      { name: "User", needsAutoGeneration: false },
      { name: "Bot", needsAutoGeneration: false },
    ]);
  });
});
