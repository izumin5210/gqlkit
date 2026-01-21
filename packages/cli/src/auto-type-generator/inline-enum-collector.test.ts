import type ts from "typescript";
import { describe, expect, it } from "vitest";
import type {
  ExtractResolversResult,
  GraphQLInputValue,
} from "../resolver-extractor/index.js";
import type {
  ExtractedTypeInfo,
  FieldDefinition,
  InlineEnumMemberInfo,
  InlineObjectPropertyDef,
  TSTypeReference,
} from "../type-extractor/types/index.js";
import {
  collectInlineEnumsFromResolvers,
  collectInlineEnumsFromTypes,
} from "./inline-enum-collector.js";

function createInlineEnumTsType(
  members: InlineEnumMemberInfo[],
  nullable = false,
  externalEnumSymbol: ts.Symbol | null = null,
): TSTypeReference {
  return {
    kind: "inlineEnum",
    name: null,
    elementType: null,
    members: null,
    nullable,
    scalarInfo: null,
    inlineObjectProperties: null,
    inlineEnumMembers: members,
    externalEnumSymbol,
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

function createEnumMember(
  value: string,
  description: string | null = null,
): InlineEnumMemberInfo {
  return {
    value,
    description,
    deprecated: null,
  };
}

function createField(
  name: string,
  tsType: TSTypeReference,
  optional = false,
  description: string | null = null,
): FieldDefinition {
  return {
    name,
    tsType,
    optional,
    description,
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

describe("collectInlineEnumsFromTypes", () => {
  describe("Object type field inline enums", () => {
    it("collects inline enum from Object type field", () => {
      const statusMembers = [
        createEnumMember("active"),
        createEnumMember("inactive"),
        createEnumMember("pending"),
      ];

      const extractedTypes: ExtractedTypeInfo[] = [
        createExtractedType("User", [
          createField("id", createPrimitiveTsType("string")),
          createField("status", createInlineEnumTsType(statusMembers)),
        ]),
      ];

      const result = collectInlineEnumsFromTypes(extractedTypes);

      expect(result).toHaveLength(1);
      expect(result[0]!.members).toEqual(statusMembers);
      expect(result[0]!.context).toEqual({
        kind: "objectField",
        parentTypeName: "User",
        fieldPath: ["status"],
      });
      expect(result[0]!.nullable).toBe(false);
      expect(result[0]!.externalEnumSymbol).toBeNull();
    });

    it("collects nullable inline enum from Object type field", () => {
      const statusMembers = [
        createEnumMember("active"),
        createEnumMember("inactive"),
      ];

      const extractedTypes: ExtractedTypeInfo[] = [
        createExtractedType("User", [
          createField("status", createInlineEnumTsType(statusMembers, true)),
        ]),
      ];

      const result = collectInlineEnumsFromTypes(extractedTypes);

      expect(result).toHaveLength(1);
      expect(result[0]!.nullable).toBe(true);
    });

    it("collects multiple inline enums from same type", () => {
      const statusMembers = [
        createEnumMember("active"),
        createEnumMember("inactive"),
      ];
      const roleMembers = [createEnumMember("admin"), createEnumMember("user")];

      const extractedTypes: ExtractedTypeInfo[] = [
        createExtractedType("User", [
          createField("status", createInlineEnumTsType(statusMembers)),
          createField("role", createInlineEnumTsType(roleMembers)),
        ]),
      ];

      const result = collectInlineEnumsFromTypes(extractedTypes);

      expect(result).toHaveLength(2);
      expect(
        result.map(
          (r) => r.context.kind === "objectField" && r.context.fieldPath[0],
        ),
      ).toEqual(["status", "role"]);
    });

    it("preserves external enum symbol for deduplication", () => {
      const mockSymbol = { name: "TestEnum" } as unknown as ts.Symbol;
      const statusMembers = [
        createEnumMember("active"),
        createEnumMember("inactive"),
      ];

      const extractedTypes: ExtractedTypeInfo[] = [
        createExtractedType("User", [
          createField(
            "status",
            createInlineEnumTsType(statusMembers, false, mockSymbol),
          ),
        ]),
      ];

      const result = collectInlineEnumsFromTypes(extractedTypes);

      expect(result).toHaveLength(1);
      expect(result[0]!.externalEnumSymbol).toBe(mockSymbol);
    });
  });

  describe("Input type field inline enums", () => {
    it("collects inline enum from Input type field", () => {
      const priorityMembers = [
        createEnumMember("high"),
        createEnumMember("medium"),
        createEnumMember("low"),
      ];

      const extractedTypes: ExtractedTypeInfo[] = [
        createExtractedType("CreateTaskInput", [
          createField("title", createPrimitiveTsType("string")),
          createField("priority", createInlineEnumTsType(priorityMembers)),
        ]),
      ];

      const result = collectInlineEnumsFromTypes(extractedTypes);

      expect(result).toHaveLength(1);
      expect(result[0]!.members).toEqual(priorityMembers);
      expect(result[0]!.context).toEqual({
        kind: "inputField",
        parentTypeName: "CreateTaskInput",
        fieldPath: ["priority"],
      });
    });
  });

  describe("Inline enums in inline object properties", () => {
    it("collects inline enum from nested inline object properties", () => {
      const statusMembers = [
        createEnumMember("published"),
        createEnumMember("draft"),
      ];

      const inlineObjectType: TSTypeReference = {
        kind: "inlineObject",
        name: null,
        elementType: null,
        members: null,
        nullable: false,
        scalarInfo: null,
        inlineObjectProperties: [
          {
            name: "status",
            tsType: createInlineEnumTsType(statusMembers),
            optional: false,
            description: null,
            deprecated: null,
            directives: null,
            defaultValue: null,
            sourceLocation: null,
          } satisfies InlineObjectPropertyDef,
        ],
        inlineEnumMembers: null,
        externalEnumSymbol: null,
        externalEnumDescription: null,
        externalEnumDeprecated: null,
      };

      const extractedTypes: ExtractedTypeInfo[] = [
        createExtractedType("Post", [
          createField("metadata", inlineObjectType),
        ]),
      ];

      const result = collectInlineEnumsFromTypes(extractedTypes);

      expect(result).toHaveLength(1);
      expect(result[0]!.context).toEqual({
        kind: "objectField",
        parentTypeName: "Post",
        fieldPath: ["metadata", "status"],
      });
    });
  });

  describe("Ignores non-inline-enum fields", () => {
    it("ignores primitive type fields", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        createExtractedType("User", [
          createField("name", createPrimitiveTsType("string")),
        ]),
      ];

      const result = collectInlineEnumsFromTypes(extractedTypes);

      expect(result).toHaveLength(0);
    });

    it("ignores reference type fields", () => {
      const refType: TSTypeReference = {
        kind: "reference",
        name: "Status",
        elementType: null,
        members: null,
        nullable: false,
        scalarInfo: null,
        inlineObjectProperties: null,
        inlineEnumMembers: null,
        externalEnumSymbol: null,
        externalEnumDescription: null,
        externalEnumDeprecated: null,
      };

      const extractedTypes: ExtractedTypeInfo[] = [
        createExtractedType("User", [createField("status", refType)]),
      ];

      const result = collectInlineEnumsFromTypes(extractedTypes);

      expect(result).toHaveLength(0);
    });
  });
});

describe("collectInlineEnumsFromResolvers", () => {
  describe("Query resolver inline enums", () => {
    it("collects inline enum from Query resolver argument", () => {
      const sortByMembers = [
        createEnumMember("name"),
        createEnumMember("createdAt"),
        createEnumMember("updatedAt"),
      ];

      const resolversResult: ExtractResolversResult = {
        queryFields: {
          fields: [
            {
              name: "listUsers",
              type: {
                typeName: "User",
                nullable: false,
                list: true,
                listItemNullable: false,
              },
              args: [
                {
                  name: "sortBy",
                  type: {
                    typeName: "__INLINE_ENUM__",
                    nullable: false,
                    list: false,
                    listItemNullable: null,
                  },
                  description: "Sort field",
                  deprecated: null,
                  defaultValue: null,
                  inlineObjectProperties: null,
                  inlineEnumMembers: sortByMembers,
                  externalEnumSymbol: null,
                  externalEnumDescription: null,
                  externalEnumDeprecated: null,
                  inlineUnionMembers: null,
                } satisfies GraphQLInputValue,
              ],
              sourceLocation: {
                file: "src/gqlkit/schema/resolvers.ts",
                line: 10,
                column: 1,
              },
              resolverExportName: "listUsers",
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

      const result = collectInlineEnumsFromResolvers(resolversResult);

      expect(result).toHaveLength(1);
      expect(result[0]!.members).toEqual(sortByMembers);
      expect(result[0]!.context).toEqual({
        kind: "resolverArg",
        resolverType: "query",
        fieldName: "listUsers",
        argName: "sortBy",
        parentTypeName: null,
        fieldPath: [],
      });
    });
  });

  describe("Mutation resolver inline enums", () => {
    it("collects inline enum from Mutation resolver argument", () => {
      const statusMembers = [
        createEnumMember("active"),
        createEnumMember("archived"),
      ];

      const resolversResult: ExtractResolversResult = {
        queryFields: { fields: [] },
        mutationFields: {
          fields: [
            {
              name: "updateUser",
              type: {
                typeName: "User",
                nullable: false,
                list: false,
                listItemNullable: null,
              },
              args: [
                {
                  name: "status",
                  type: {
                    typeName: "__INLINE_ENUM__",
                    nullable: false,
                    list: false,
                    listItemNullable: null,
                  },
                  description: null,
                  deprecated: null,
                  defaultValue: null,
                  inlineObjectProperties: null,
                  inlineEnumMembers: statusMembers,
                  externalEnumSymbol: null,
                  externalEnumDescription: null,
                  externalEnumDeprecated: null,
                  inlineUnionMembers: null,
                } satisfies GraphQLInputValue,
              ],
              sourceLocation: {
                file: "src/gqlkit/schema/resolvers.ts",
                line: 20,
                column: 1,
              },
              resolverExportName: "updateUser",
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

      const result = collectInlineEnumsFromResolvers(resolversResult);

      expect(result).toHaveLength(1);
      expect(result[0]!.members).toEqual(statusMembers);
      expect(result[0]!.context).toEqual({
        kind: "resolverArg",
        resolverType: "mutation",
        fieldName: "updateUser",
        argName: "status",
        parentTypeName: null,
        fieldPath: [],
      });
    });
  });

  describe("Field resolver inline enums", () => {
    it("collects inline enum from Field resolver argument", () => {
      const formatMembers = [
        createEnumMember("short"),
        createEnumMember("long"),
      ];

      const resolversResult: ExtractResolversResult = {
        queryFields: { fields: [] },
        mutationFields: { fields: [] },
        typeExtensions: [
          {
            targetTypeName: "User",
            fields: [
              {
                name: "displayName",
                type: {
                  typeName: "String",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                args: [
                  {
                    name: "format",
                    type: {
                      typeName: "__INLINE_ENUM__",
                      nullable: true,
                      list: false,
                      listItemNullable: null,
                    },
                    description: "Name format",
                    deprecated: null,
                    defaultValue: null,
                    inlineObjectProperties: null,
                    inlineEnumMembers: formatMembers,
                    externalEnumSymbol: null,
                    externalEnumDescription: null,
                    externalEnumDeprecated: null,
                    inlineUnionMembers: null,
                  } satisfies GraphQLInputValue,
                ],
                sourceLocation: {
                  file: "src/gqlkit/schema/resolvers.ts",
                  line: 30,
                  column: 1,
                },
                resolverExportName: "displayName",
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

      const result = collectInlineEnumsFromResolvers(resolversResult);

      expect(result).toHaveLength(1);
      expect(result[0]!.members).toEqual(formatMembers);
      expect(result[0]!.context).toEqual({
        kind: "resolverArg",
        resolverType: "field",
        fieldName: "displayName",
        argName: "format",
        parentTypeName: "User",
        fieldPath: [],
      });
      expect(result[0]!.nullable).toBe(true);
    });
  });

  describe("Inline enums in inline object arguments", () => {
    it("collects inline enum from nested inline object in resolver argument", () => {
      const orderMembers = [createEnumMember("asc"), createEnumMember("desc")];

      const resolversResult: ExtractResolversResult = {
        queryFields: {
          fields: [
            {
              name: "searchUsers",
              type: {
                typeName: "User",
                nullable: false,
                list: true,
                listItemNullable: false,
              },
              args: [
                {
                  name: "filter",
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
                    {
                      name: "order",
                      tsType: createInlineEnumTsType(orderMembers),
                      optional: false,
                      description: null,
                      deprecated: null,
                      directives: null,
                      defaultValue: null,
                      sourceLocation: null,
                    } satisfies InlineObjectPropertyDef,
                  ],
                  inlineEnumMembers: null,
                  externalEnumSymbol: null,
                  externalEnumDescription: null,
                  externalEnumDeprecated: null,
                  inlineUnionMembers: null,
                } satisfies GraphQLInputValue,
              ],
              sourceLocation: {
                file: "src/gqlkit/schema/resolvers.ts",
                line: 40,
                column: 1,
              },
              resolverExportName: "searchUsers",
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

      const result = collectInlineEnumsFromResolvers(resolversResult);

      expect(result).toHaveLength(1);
      expect(result[0]!.context).toEqual({
        kind: "resolverArg",
        resolverType: "query",
        fieldName: "searchUsers",
        argName: "filter",
        parentTypeName: null,
        fieldPath: ["order"],
      });
    });
  });

  describe("External enum symbol preservation", () => {
    it("preserves external enum symbol from resolver argument", () => {
      const mockSymbol = { name: "SortOrder" } as unknown as ts.Symbol;
      const orderMembers = [createEnumMember("asc"), createEnumMember("desc")];

      const resolversResult: ExtractResolversResult = {
        queryFields: {
          fields: [
            {
              name: "listUsers",
              type: {
                typeName: "User",
                nullable: false,
                list: true,
                listItemNullable: false,
              },
              args: [
                {
                  name: "order",
                  type: {
                    typeName: "__INLINE_ENUM__",
                    nullable: false,
                    list: false,
                    listItemNullable: null,
                  },
                  description: null,
                  deprecated: null,
                  defaultValue: null,
                  inlineObjectProperties: null,
                  inlineEnumMembers: orderMembers,
                  externalEnumSymbol: mockSymbol,
                  externalEnumDescription: null,
                  externalEnumDeprecated: null,
                  inlineUnionMembers: null,
                } satisfies GraphQLInputValue,
              ],
              sourceLocation: {
                file: "src/gqlkit/schema/resolvers.ts",
                line: 50,
                column: 1,
              },
              resolverExportName: "listUsers",
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

      const result = collectInlineEnumsFromResolvers(resolversResult);

      expect(result).toHaveLength(1);
      expect(result[0]!.externalEnumSymbol).toBe(mockSymbol);
    });
  });
});

describe("InlineEnumWithContext type name generation", () => {
  it("generates correct name for Object field enum: {ParentTypeName}{PascalCaseFieldName}", () => {
    const statusMembers = [
      createEnumMember("active"),
      createEnumMember("inactive"),
    ];

    const extractedTypes: ExtractedTypeInfo[] = [
      createExtractedType("User", [
        createField("accountStatus", createInlineEnumTsType(statusMembers)),
      ]),
    ];

    const result = collectInlineEnumsFromTypes(extractedTypes);

    expect(result).toHaveLength(1);
    expect(result[0]!.context).toEqual({
      kind: "objectField",
      parentTypeName: "User",
      fieldPath: ["accountStatus"],
    });
  });

  it("generates correct name for Input field enum: {ParentTypeNameWithoutInputSuffix}{PascalCaseFieldName}Input", () => {
    const priorityMembers = [createEnumMember("high"), createEnumMember("low")];

    const extractedTypes: ExtractedTypeInfo[] = [
      createExtractedType("CreateTaskInput", [
        createField("priority", createInlineEnumTsType(priorityMembers)),
      ]),
    ];

    const result = collectInlineEnumsFromTypes(extractedTypes);

    expect(result).toHaveLength(1);
    expect(result[0]!.context).toEqual({
      kind: "inputField",
      parentTypeName: "CreateTaskInput",
      fieldPath: ["priority"],
    });
  });

  it("generates correct name for Query/Mutation arg enum: {PascalCaseFieldName}{PascalCaseArgName}Input", () => {
    const orderMembers = [createEnumMember("asc"), createEnumMember("desc")];

    const resolversResult: ExtractResolversResult = {
      queryFields: {
        fields: [
          {
            name: "listUsers",
            type: {
              typeName: "User",
              nullable: false,
              list: true,
              listItemNullable: false,
            },
            args: [
              {
                name: "sortOrder",
                type: {
                  typeName: "__INLINE_ENUM__",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
                defaultValue: null,
                inlineObjectProperties: null,
                inlineEnumMembers: orderMembers,
                externalEnumSymbol: null,
                externalEnumDescription: null,
                externalEnumDeprecated: null,
                inlineUnionMembers: null,
              } satisfies GraphQLInputValue,
            ],
            sourceLocation: {
              file: "src/gqlkit/schema/resolvers.ts",
              line: 1,
              column: 1,
            },
            resolverExportName: "listUsers",
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

    const result = collectInlineEnumsFromResolvers(resolversResult);

    expect(result).toHaveLength(1);
    expect(result[0]!.context).toEqual({
      kind: "resolverArg",
      resolverType: "query",
      fieldName: "listUsers",
      argName: "sortOrder",
      parentTypeName: null,
      fieldPath: [],
    });
  });

  it("generates correct name for Field resolver arg enum: {ParentTypeName}{PascalCaseFieldName}{PascalCaseArgName}Input", () => {
    const formatMembers = [createEnumMember("short"), createEnumMember("long")];

    const resolversResult: ExtractResolversResult = {
      queryFields: { fields: [] },
      mutationFields: { fields: [] },
      typeExtensions: [
        {
          targetTypeName: "User",
          fields: [
            {
              name: "formattedName",
              type: {
                typeName: "String",
                nullable: false,
                list: false,
                listItemNullable: null,
              },
              args: [
                {
                  name: "style",
                  type: {
                    typeName: "__INLINE_ENUM__",
                    nullable: false,
                    list: false,
                    listItemNullable: null,
                  },
                  description: null,
                  deprecated: null,
                  defaultValue: null,
                  inlineObjectProperties: null,
                  inlineEnumMembers: formatMembers,
                  externalEnumSymbol: null,
                  externalEnumDescription: null,
                  externalEnumDeprecated: null,
                  inlineUnionMembers: null,
                } satisfies GraphQLInputValue,
              ],
              sourceLocation: {
                file: "src/gqlkit/schema/resolvers.ts",
                line: 1,
                column: 1,
              },
              resolverExportName: "formattedName",
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

    const result = collectInlineEnumsFromResolvers(resolversResult);

    expect(result).toHaveLength(1);
    expect(result[0]!.context).toEqual({
      kind: "resolverArg",
      resolverType: "field",
      fieldName: "formattedName",
      argName: "style",
      parentTypeName: "User",
      fieldPath: [],
    });
  });
});
