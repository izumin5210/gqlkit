import { describe, expect, it } from "vitest";
import type { GraphQLTypeInfo } from "../type-extractor/types/graphql.js";
import { validateInterfaceImplementations } from "./interface-validator.js";

describe("validateInterfaceImplementations", () => {
  it("should detect missing interface field", () => {
    const types: GraphQLTypeInfo[] = [
      {
        name: "Node",
        kind: "Interface",
        fields: [
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
            directives: null,
            defaultValue: null,
          },
        ],
        unionMembers: null,
        enumValues: null,
        implementedInterfaces: null,
        sourceFile: "src/node.ts",
        description: null,
        deprecated: null,
        directives: null,
      },
      {
        name: "User",
        kind: "Object",
        fields: [
          {
            name: "name",
            type: {
              typeName: "String",
              nullable: false,
              list: false,
              listItemNullable: null,
            },
            description: null,
            deprecated: null,
            directives: null,
            defaultValue: null,
          },
        ],
        unionMembers: null,
        enumValues: null,
        implementedInterfaces: ["Node"],
        sourceFile: "src/user.ts",
        description: null,
        deprecated: null,
        directives: null,
      },
    ];

    const result = validateInterfaceImplementations(types);

    expect(result.isValid).toBe(false);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: "INTERFACE_MISSING_FIELD",
      message:
        "Type 'User' implements interface 'Node' but is missing field 'id'",
      severity: "error",
    });
  });

  it("should pass when all interface fields are implemented", () => {
    const types: GraphQLTypeInfo[] = [
      {
        name: "Node",
        kind: "Interface",
        fields: [
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
            directives: null,
            defaultValue: null,
          },
        ],
        unionMembers: null,
        enumValues: null,
        implementedInterfaces: null,
        sourceFile: "src/node.ts",
        description: null,
        deprecated: null,
        directives: null,
      },
      {
        name: "User",
        kind: "Object",
        fields: [
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
            directives: null,
            defaultValue: null,
          },
          {
            name: "name",
            type: {
              typeName: "String",
              nullable: false,
              list: false,
              listItemNullable: null,
            },
            description: null,
            deprecated: null,
            directives: null,
            defaultValue: null,
          },
        ],
        unionMembers: null,
        enumValues: null,
        implementedInterfaces: ["Node"],
        sourceFile: "src/user.ts",
        description: null,
        deprecated: null,
        directives: null,
      },
    ];

    const result = validateInterfaceImplementations(types);

    expect(result.isValid).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });
});
