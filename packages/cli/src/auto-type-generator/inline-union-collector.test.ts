import { describe, expect, it } from "vitest";
import type {
  ExtractResolversResult,
  GraphQLInputValue,
} from "../resolver-extractor/index.js";
import type {
  ExtractedTypeInfo,
  FieldDefinition,
  InlineObjectPropertyDef,
  TSTypeReference,
} from "../type-extractor/types/index.js";
import {
  collectInlineUnionsFromResolvers,
  collectInlineUnionsFromTypes,
  type InlineUnionWithContext,
} from "./inline-union-collector.js";

function createUnionTsType(
  members: TSTypeReference[],
  nullable = false,
): TSTypeReference {
  return {
    kind: "union",
    name: null,
    elementType: null,
    members,
    nullable,
    scalarInfo: null,
    inlineObjectProperties: null,
    inlineEnumMembers: null,
    externalEnumSymbol: null,
    externalEnumDescription: null,
    externalEnumDeprecated: null,
  };
}

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
  };
}

function createArrayTsType(
  elementType: TSTypeReference,
  nullable = false,
): TSTypeReference {
  return {
    kind: "array",
    name: null,
    elementType,
    members: null,
    nullable,
    scalarInfo: null,
    inlineObjectProperties: null,
    inlineEnumMembers: null,
    externalEnumSymbol: null,
    externalEnumDescription: null,
    externalEnumDeprecated: null,
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
  };
}

function createField(
  name: string,
  tsType: TSTypeReference,
  optional = false,
): FieldDefinition {
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

function createExtractedType(
  name: string,
  fields: FieldDefinition[],
  kind: "object" | "interface" = "object",
): ExtractedTypeInfo {
  return {
    metadata: {
      name,
      kind,
      sourceFile: "src/gqlkit/schema/types.ts",
      sourceLocation: {
        file: "src/gqlkit/schema/types.ts",
        line: 1,
        column: 1,
      },
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

describe("collectInlineUnionsFromTypes", () => {
  describe("Object type field inline unions", () => {
    it("collects inline union from Object type field", () => {
      const members = [
        createReferenceTsType("Cat"),
        createReferenceTsType("Dog"),
      ];

      const extractedTypes: ExtractedTypeInfo[] = [
        createExtractedType("Owner", [
          createField("id", createPrimitiveTsType("string")),
          createField("pet", createUnionTsType(members)),
        ]),
      ];

      const result = collectInlineUnionsFromTypes({
        extractedTypes,
        knownTypeNames: new Set(["Cat", "Dog"]),
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.members).toHaveLength(2);
      expect(result[0]!.members[0]!.memberType.name).toBe("Cat");
      expect(result[0]!.members[0]!.needsAutoGeneration).toBe(false);
      expect(result[0]!.members[1]!.memberType.name).toBe("Dog");
      expect(result[0]!.members[1]!.needsAutoGeneration).toBe(false);
      expect(result[0]!.context).toEqual({
        kind: "objectField",
        parentTypeName: "Owner",
        fieldPath: ["pet"],
      });
      expect(result[0]!.nullable).toBe(false);
      expect(result[0]!.isInputContext).toBe(false);
    });

    it("collects nullable inline union from Object type field", () => {
      const members = [
        createReferenceTsType("Success"),
        createReferenceTsType("Failure"),
      ];

      const extractedTypes: ExtractedTypeInfo[] = [
        createExtractedType("Operation", [
          createField("result", createUnionTsType(members, true)),
        ]),
      ];

      const result = collectInlineUnionsFromTypes({
        extractedTypes,
        knownTypeNames: new Set(["Success", "Failure"]),
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.nullable).toBe(true);
    });

    it("marks unknown members as needing auto-generation", () => {
      const members = [
        createReferenceTsType("KnownType"),
        createInlineObjectTsType([
          createInlineObjectProperty("field", createPrimitiveTsType("string")),
        ]),
      ];

      const extractedTypes: ExtractedTypeInfo[] = [
        createExtractedType("Container", [
          createField("item", createUnionTsType(members)),
        ]),
      ];

      const result = collectInlineUnionsFromTypes({
        extractedTypes,
        knownTypeNames: new Set(["KnownType"]),
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.members[0]!.needsAutoGeneration).toBe(false);
      expect(result[0]!.members[1]!.needsAutoGeneration).toBe(true);
    });

    it("collects multiple inline unions from same type", () => {
      const petMembers = [
        createReferenceTsType("Cat"),
        createReferenceTsType("Dog"),
      ];
      const vehicleMembers = [
        createReferenceTsType("Car"),
        createReferenceTsType("Bike"),
      ];

      const extractedTypes: ExtractedTypeInfo[] = [
        createExtractedType("Person", [
          createField("pet", createUnionTsType(petMembers)),
          createField("vehicle", createUnionTsType(vehicleMembers)),
        ]),
      ];

      const result = collectInlineUnionsFromTypes({
        extractedTypes,
        knownTypeNames: new Set(["Cat", "Dog", "Car", "Bike"]),
      });

      expect(result).toHaveLength(2);
      expect(
        result.map((r: InlineUnionWithContext) =>
          r.context.kind === "objectField" ? r.context.fieldPath[0] : null,
        ),
      ).toEqual(["pet", "vehicle"]);
    });
  });

  describe("Input type field inline unions (OneOf)", () => {
    it("collects inline union from Input type field as OneOf", () => {
      const members = [
        createReferenceTsType("TextInput"),
        createReferenceTsType("FileInput"),
      ];

      const extractedTypes: ExtractedTypeInfo[] = [
        createExtractedType("CreateMessageInput", [
          createField("content", createUnionTsType(members)),
        ]),
      ];

      const result = collectInlineUnionsFromTypes({
        extractedTypes,
        knownTypeNames: new Set(["TextInput", "FileInput"]),
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.context).toEqual({
        kind: "inputField",
        parentTypeName: "CreateMessageInput",
        fieldPath: ["content"],
      });
      expect(result[0]!.isInputContext).toBe(true);
    });
  });

  describe("Array element inline unions", () => {
    it("collects inline union from array element type", () => {
      const members = [
        createReferenceTsType("Photo"),
        createReferenceTsType("Video"),
      ];

      const extractedTypes: ExtractedTypeInfo[] = [
        createExtractedType("Gallery", [
          createField("media", createArrayTsType(createUnionTsType(members))),
        ]),
      ];

      const result = collectInlineUnionsFromTypes({
        extractedTypes,
        knownTypeNames: new Set(["Photo", "Video"]),
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.members).toHaveLength(2);
      expect(result[0]!.context).toEqual({
        kind: "objectField",
        parentTypeName: "Gallery",
        fieldPath: ["media"],
      });
    });
  });

  describe("Inline unions in inline object properties", () => {
    it("collects inline union from nested inline object properties", () => {
      const unionMembers = [
        createReferenceTsType("TypeA"),
        createReferenceTsType("TypeB"),
      ];

      const inlineObjectType = createInlineObjectTsType([
        createInlineObjectProperty("nested", createUnionTsType(unionMembers)),
      ]);

      const extractedTypes: ExtractedTypeInfo[] = [
        createExtractedType("Wrapper", [createField("data", inlineObjectType)]),
      ];

      const result = collectInlineUnionsFromTypes({
        extractedTypes,
        knownTypeNames: new Set(["TypeA", "TypeB"]),
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.context).toEqual({
        kind: "objectField",
        parentTypeName: "Wrapper",
        fieldPath: ["data", "nested"],
      });
    });
  });

  describe("Ignores non-union fields", () => {
    it("ignores primitive type fields", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        createExtractedType("User", [
          createField("name", createPrimitiveTsType("string")),
        ]),
      ];

      const result = collectInlineUnionsFromTypes({
        extractedTypes,
        knownTypeNames: new Set(),
      });

      expect(result).toHaveLength(0);
    });

    it("ignores reference type fields", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        createExtractedType("User", [
          createField("profile", createReferenceTsType("Profile")),
        ]),
      ];

      const result = collectInlineUnionsFromTypes({
        extractedTypes,
        knownTypeNames: new Set(["Profile"]),
      });

      expect(result).toHaveLength(0);
    });
  });
});

describe("collectInlineUnionsFromResolvers", () => {
  describe("Query resolver inline unions", () => {
    it("collects inline union from Query resolver argument as OneOf", () => {
      const unionMembers = [
        createInlineObjectTsType([
          createInlineObjectProperty("byId", createPrimitiveTsType("string")),
        ]),
        createInlineObjectTsType([
          createInlineObjectProperty(
            "byEmail",
            createPrimitiveTsType("string"),
          ),
        ]),
      ];

      const resolversResult: ExtractResolversResult = {
        queryFields: {
          fields: [
            {
              name: "getUser",
              type: {
                typeName: "User",
                nullable: true,
                list: false,
                listItemNullable: null,
              },
              args: [
                {
                  name: "filter",
                  type: {
                    typeName: "__INLINE_UNION__",
                    nullable: false,
                    list: false,
                    listItemNullable: null,
                  },
                  description: null,
                  deprecated: null,
                  defaultValue: null,
                  inlineObjectProperties: null,
                  inlineEnumMembers: null,
                  externalEnumSymbol: null,
                  externalEnumDescription: null,
                  externalEnumDeprecated: null,
                  inlineUnionMembers: unionMembers,
                } as GraphQLInputValue & {
                  inlineUnionMembers: TSTypeReference[];
                },
              ],
              sourceLocation: {
                file: "src/gqlkit/schema/resolvers.ts",
                line: 10,
                column: 1,
              },
              resolverExportName: "getUser",
              description: null,
              deprecated: null,
              directives: null,
            },
          ],
        },
        mutationFields: { fields: [] },
        typeExtensions: [],
        abstractTypeResolvers: [],
        diagnostics: { errors: [], warnings: [] },
      };

      const result = collectInlineUnionsFromResolvers({
        resolversResult,
        knownTypeNames: new Set(),
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.members).toHaveLength(2);
      expect(result[0]!.context).toEqual({
        kind: "resolverArg",
        resolverType: "query",
        fieldName: "getUser",
        argName: "filter",
        parentTypeName: null,
        fieldPath: [],
      });
      expect(result[0]!.isInputContext).toBe(true);
    });
  });

  describe("Mutation resolver inline unions", () => {
    it("collects inline union from Mutation resolver argument as OneOf", () => {
      const unionMembers = [
        createReferenceTsType("TextContentInput"),
        createReferenceTsType("ImageContentInput"),
      ];

      const resolversResult: ExtractResolversResult = {
        queryFields: { fields: [] },
        mutationFields: {
          fields: [
            {
              name: "createPost",
              type: {
                typeName: "Post",
                nullable: false,
                list: false,
                listItemNullable: null,
              },
              args: [
                {
                  name: "content",
                  type: {
                    typeName: "__INLINE_UNION__",
                    nullable: false,
                    list: false,
                    listItemNullable: null,
                  },
                  description: null,
                  deprecated: null,
                  defaultValue: null,
                  inlineObjectProperties: null,
                  inlineEnumMembers: null,
                  externalEnumSymbol: null,
                  externalEnumDescription: null,
                  externalEnumDeprecated: null,
                  inlineUnionMembers: unionMembers,
                } as GraphQLInputValue & {
                  inlineUnionMembers: TSTypeReference[];
                },
              ],
              sourceLocation: {
                file: "src/gqlkit/schema/resolvers.ts",
                line: 20,
                column: 1,
              },
              resolverExportName: "createPost",
              description: null,
              deprecated: null,
              directives: null,
            },
          ],
        },
        typeExtensions: [],
        abstractTypeResolvers: [],
        diagnostics: { errors: [], warnings: [] },
      };

      const result = collectInlineUnionsFromResolvers({
        resolversResult,
        knownTypeNames: new Set(["TextContentInput", "ImageContentInput"]),
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.members[0]!.needsAutoGeneration).toBe(false);
      expect(result[0]!.members[1]!.needsAutoGeneration).toBe(false);
      expect(result[0]!.context).toEqual({
        kind: "resolverArg",
        resolverType: "mutation",
        fieldName: "createPost",
        argName: "content",
        parentTypeName: null,
        fieldPath: [],
      });
    });
  });

  describe("Field resolver inline unions", () => {
    it("collects inline union from Field resolver argument as OneOf", () => {
      const unionMembers = [
        createReferenceTsType("DateRangeInput"),
        createReferenceTsType("RelativeDateInput"),
      ];

      const resolversResult: ExtractResolversResult = {
        queryFields: { fields: [] },
        mutationFields: { fields: [] },
        typeExtensions: [
          {
            targetTypeName: "User",
            fields: [
              {
                name: "posts",
                type: {
                  typeName: "Post",
                  nullable: false,
                  list: true,
                  listItemNullable: false,
                },
                args: [
                  {
                    name: "dateFilter",
                    type: {
                      typeName: "__INLINE_UNION__",
                      nullable: true,
                      list: false,
                      listItemNullable: null,
                    },
                    description: null,
                    deprecated: null,
                    defaultValue: null,
                    inlineObjectProperties: null,
                    inlineEnumMembers: null,
                    externalEnumSymbol: null,
                    externalEnumDescription: null,
                    externalEnumDeprecated: null,
                    inlineUnionMembers: unionMembers,
                  } as GraphQLInputValue & {
                    inlineUnionMembers: TSTypeReference[];
                  },
                ],
                sourceLocation: {
                  file: "src/gqlkit/schema/resolvers.ts",
                  line: 30,
                  column: 1,
                },
                resolverExportName: "posts",
                description: null,
                deprecated: null,
                directives: null,
              },
            ],
          },
        ],
        abstractTypeResolvers: [],
        diagnostics: { errors: [], warnings: [] },
      };

      const result = collectInlineUnionsFromResolvers({
        resolversResult,
        knownTypeNames: new Set(["DateRangeInput", "RelativeDateInput"]),
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.context).toEqual({
        kind: "resolverArg",
        resolverType: "field",
        fieldName: "posts",
        argName: "dateFilter",
        parentTypeName: "User",
        fieldPath: [],
      });
      expect(result[0]!.nullable).toBe(true);
      expect(result[0]!.isInputContext).toBe(true);
    });
  });

  describe("Inline unions in inline object arguments", () => {
    it("collects inline union from nested inline object in resolver argument", () => {
      const unionMembers = [
        createReferenceTsType("AscOrder"),
        createReferenceTsType("DescOrder"),
      ];

      const resolversResult: ExtractResolversResult = {
        queryFields: {
          fields: [
            {
              name: "searchItems",
              type: {
                typeName: "Item",
                nullable: false,
                list: true,
                listItemNullable: false,
              },
              args: [
                {
                  name: "options",
                  type: {
                    typeName: "__INLINE_OBJECT__",
                    nullable: false,
                    list: false,
                    listItemNullable: null,
                  },
                  description: null,
                  deprecated: null,
                  defaultValue: null,
                  inlineObjectProperties: [
                    createInlineObjectProperty(
                      "sortOrder",
                      createUnionTsType(unionMembers),
                    ),
                  ],
                  inlineEnumMembers: null,
                  externalEnumSymbol: null,
                  externalEnumDescription: null,
                  externalEnumDeprecated: null,
                } satisfies GraphQLInputValue,
              ],
              sourceLocation: {
                file: "src/gqlkit/schema/resolvers.ts",
                line: 40,
                column: 1,
              },
              resolverExportName: "searchItems",
              description: null,
              deprecated: null,
              directives: null,
            },
          ],
        },
        mutationFields: { fields: [] },
        typeExtensions: [],
        abstractTypeResolvers: [],
        diagnostics: { errors: [], warnings: [] },
      };

      const result = collectInlineUnionsFromResolvers({
        resolversResult,
        knownTypeNames: new Set(["AscOrder", "DescOrder"]),
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.context).toEqual({
        kind: "resolverArg",
        resolverType: "query",
        fieldName: "searchItems",
        argName: "options",
        parentTypeName: null,
        fieldPath: ["sortOrder"],
      });
    });
  });

  describe("Ignores non-union arguments", () => {
    it("ignores resolver arguments without union types", () => {
      const resolversResult: ExtractResolversResult = {
        queryFields: {
          fields: [
            {
              name: "getUser",
              type: {
                typeName: "User",
                nullable: true,
                list: false,
                listItemNullable: null,
              },
              args: [
                {
                  name: "id",
                  type: {
                    typeName: "ID",
                    nullable: false,
                    list: false,
                    listItemNullable: null,
                  },
                  description: null,
                  deprecated: null,
                  defaultValue: null,
                  inlineObjectProperties: null,
                  inlineEnumMembers: null,
                  externalEnumSymbol: null,
                  externalEnumDescription: null,
                  externalEnumDeprecated: null,
                } satisfies GraphQLInputValue,
              ],
              sourceLocation: {
                file: "src/gqlkit/schema/resolvers.ts",
                line: 1,
                column: 1,
              },
              resolverExportName: "getUser",
              description: null,
              deprecated: null,
              directives: null,
            },
          ],
        },
        mutationFields: { fields: [] },
        typeExtensions: [],
        abstractTypeResolvers: [],
        diagnostics: { errors: [], warnings: [] },
      };

      const result = collectInlineUnionsFromResolvers({
        resolversResult,
        knownTypeNames: new Set(),
      });

      expect(result).toHaveLength(0);
    });
  });
});
