import { describe, expect, it } from "vitest";
import {
  createArrayType,
  createInlineEnumType,
  createInlineObjectType,
  createReferenceType,
  createUnionType,
  type InlineEnumMemberInfo,
  type PropertyDef,
  type SourceLocation,
  type TSTypeReference,
} from "../core/index.js";
import {
  createExtractedObjectType,
  createPropertyDef,
} from "../testing/type-fixtures.js";
import type { ExtractedTypeInfo } from "../type-extractor/index.js";
import { collectInlineEnumsFromTypes } from "./inline-enum-collector.js";
import { collectInlineUnionsFromTypes } from "./inline-union-collector.js";

const sourceLocation: SourceLocation = {
  file: "src/gqlkit/schema/types.ts",
  line: 1,
  column: 1,
};

// `createField`/`createProperty` are the same builder under two names, kept
// distinct only for call-site readability (a top-level field vs. a nested
// property within it).
function createField(name: string, tsType: TSTypeReference): PropertyDef {
  return createPropertyDef({ name, tsType, sourceLocation });
}

function createProperty(name: string, tsType: TSTypeReference): PropertyDef {
  return createPropertyDef({ name, tsType, sourceLocation });
}

function createExtractedType(
  fields: ReadonlyArray<PropertyDef>,
): ExtractedTypeInfo {
  return createExtractedObjectType({ name: "Container", fields });
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
