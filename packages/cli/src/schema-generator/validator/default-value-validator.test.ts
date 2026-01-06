import { type ConstValueNode, Kind } from "graphql";
import { describe, expect, it } from "vitest";
import type { GraphQLFieldType } from "../../type-extractor/types/graphql.js";
import {
  type ValidationContext,
  validateDefaultValue,
} from "./default-value-validator.js";

function createLocation() {
  return { file: "test.ts", line: 1, column: 1 };
}

function createFieldType(
  typeName: string,
  options: {
    nullable?: boolean;
    list?: boolean;
    listItemNullable?: boolean | null;
  } = {},
): GraphQLFieldType {
  return {
    typeName,
    nullable: options.nullable ?? false,
    list: options.list ?? false,
    listItemNullable: options.listItemNullable ?? null,
  };
}

function stringValue(value: string): ConstValueNode {
  return { kind: Kind.STRING, value };
}

function intValue(value: string): ConstValueNode {
  return { kind: Kind.INT, value };
}

function floatValue(value: string): ConstValueNode {
  return { kind: Kind.FLOAT, value };
}

function booleanValue(value: boolean): ConstValueNode {
  return { kind: Kind.BOOLEAN, value };
}

function nullValue(): ConstValueNode {
  return { kind: Kind.NULL };
}

function enumValue(value: string): ConstValueNode {
  return { kind: Kind.ENUM, value };
}

function listValue(values: ConstValueNode[]): ConstValueNode {
  return { kind: Kind.LIST, values };
}

function objectValue(
  fields: Array<{ name: string; value: ConstValueNode }>,
): ConstValueNode {
  return {
    kind: Kind.OBJECT,
    fields: fields.map((f) => ({
      kind: Kind.OBJECT_FIELD as const,
      name: { kind: Kind.NAME as const, value: f.name },
      value: f.value,
    })),
  };
}

function createContext(
  options: {
    enums?: Record<string, string[]>;
    inputObjects?: Record<
      string,
      { fields: Array<{ name: string; type: GraphQLFieldType }> }
    >;
    customScalars?: string[];
  } = {},
): ValidationContext {
  return {
    knownEnums: new Map(Object.entries(options.enums ?? {})),
    knownInputObjects: new Map(
      Object.entries(options.inputObjects ?? {}).map(([name, info]) => [
        name,
        { name, fields: info.fields },
      ]),
    ),
    customScalars: new Set(options.customScalars ?? []),
  };
}

describe("validateDefaultValue", () => {
  describe("String type validation", () => {
    it("should accept string value for String type", () => {
      const result = validateDefaultValue(
        createFieldType("String", { nullable: true }),
        stringValue("hello"),
        "testField",
        createLocation(),
        createContext(),
      );
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it("should reject integer value for String type", () => {
      const result = validateDefaultValue(
        createFieldType("String", { nullable: true }),
        intValue("123"),
        "testField",
        createLocation(),
        createContext(),
      );
      expect(result.valid).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.code).toBe("DEFAULT_VALUE_TYPE_MISMATCH");
      expect(result.diagnostics[0]?.message).toContain("String");
    });

    it("should reject boolean value for String type", () => {
      const result = validateDefaultValue(
        createFieldType("String", { nullable: true }),
        booleanValue(true),
        "testField",
        createLocation(),
        createContext(),
      );
      expect(result.valid).toBe(false);
      expect(result.diagnostics[0]?.code).toBe("DEFAULT_VALUE_TYPE_MISMATCH");
    });
  });

  describe("Int type validation", () => {
    it("should accept integer value for Int type", () => {
      const result = validateDefaultValue(
        createFieldType("Int", { nullable: true }),
        intValue("42"),
        "testField",
        createLocation(),
        createContext(),
      );
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it("should reject string value for Int type", () => {
      const result = validateDefaultValue(
        createFieldType("Int", { nullable: true }),
        stringValue("not a number"),
        "testField",
        createLocation(),
        createContext(),
      );
      expect(result.valid).toBe(false);
      expect(result.diagnostics[0]?.code).toBe("DEFAULT_VALUE_TYPE_MISMATCH");
      expect(result.diagnostics[0]?.message).toContain("Int");
    });

    it("should reject float value for Int type", () => {
      const result = validateDefaultValue(
        createFieldType("Int", { nullable: true }),
        floatValue("3.14"),
        "testField",
        createLocation(),
        createContext(),
      );
      expect(result.valid).toBe(false);
      expect(result.diagnostics[0]?.code).toBe("DEFAULT_VALUE_TYPE_MISMATCH");
    });
  });

  describe("Float type validation", () => {
    it("should accept float value for Float type", () => {
      const result = validateDefaultValue(
        createFieldType("Float", { nullable: true }),
        floatValue("3.14"),
        "testField",
        createLocation(),
        createContext(),
      );
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it("should accept integer value for Float type", () => {
      const result = validateDefaultValue(
        createFieldType("Float", { nullable: true }),
        intValue("42"),
        "testField",
        createLocation(),
        createContext(),
      );
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it("should reject string value for Float type", () => {
      const result = validateDefaultValue(
        createFieldType("Float", { nullable: true }),
        stringValue("not a float"),
        "testField",
        createLocation(),
        createContext(),
      );
      expect(result.valid).toBe(false);
      expect(result.diagnostics[0]?.code).toBe("DEFAULT_VALUE_TYPE_MISMATCH");
      expect(result.diagnostics[0]?.message).toContain("Float");
    });
  });

  describe("Boolean type validation", () => {
    it("should accept boolean value for Boolean type", () => {
      const result = validateDefaultValue(
        createFieldType("Boolean", { nullable: true }),
        booleanValue(true),
        "testField",
        createLocation(),
        createContext(),
      );
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it("should reject string value for Boolean type", () => {
      const result = validateDefaultValue(
        createFieldType("Boolean", { nullable: true }),
        stringValue("true"),
        "testField",
        createLocation(),
        createContext(),
      );
      expect(result.valid).toBe(false);
      expect(result.diagnostics[0]?.code).toBe("DEFAULT_VALUE_TYPE_MISMATCH");
      expect(result.diagnostics[0]?.message).toContain("Boolean");
    });
  });

  describe("ID type validation", () => {
    it("should accept string value for ID type", () => {
      const result = validateDefaultValue(
        createFieldType("ID", { nullable: true }),
        stringValue("abc123"),
        "testField",
        createLocation(),
        createContext(),
      );
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it("should accept integer value for ID type", () => {
      const result = validateDefaultValue(
        createFieldType("ID", { nullable: true }),
        intValue("123"),
        "testField",
        createLocation(),
        createContext(),
      );
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it("should reject boolean value for ID type", () => {
      const result = validateDefaultValue(
        createFieldType("ID", { nullable: true }),
        booleanValue(true),
        "testField",
        createLocation(),
        createContext(),
      );
      expect(result.valid).toBe(false);
      expect(result.diagnostics[0]?.code).toBe("DEFAULT_VALUE_TYPE_MISMATCH");
    });
  });

  describe("Non-null type validation", () => {
    it("should reject null value for non-null type", () => {
      const result = validateDefaultValue(
        createFieldType("String", { nullable: false }),
        nullValue(),
        "testField",
        createLocation(),
        createContext(),
      );
      expect(result.valid).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.code).toBe("NULL_DEFAULT_FOR_NON_NULL");
    });

    it("should accept null value for nullable type", () => {
      const result = validateDefaultValue(
        createFieldType("String", { nullable: true }),
        nullValue(),
        "testField",
        createLocation(),
        createContext(),
      );
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });
  });

  describe("Enum type validation", () => {
    const context = createContext({
      enums: {
        Status: ["ACTIVE", "INACTIVE", "PENDING"],
      },
    });

    it("should accept valid enum value", () => {
      const result = validateDefaultValue(
        createFieldType("Status", { nullable: true }),
        enumValue("ACTIVE"),
        "testField",
        createLocation(),
        context,
      );
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it("should reject invalid enum value", () => {
      const result = validateDefaultValue(
        createFieldType("Status", { nullable: true }),
        enumValue("UNKNOWN"),
        "testField",
        createLocation(),
        context,
      );
      expect(result.valid).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.code).toBe("UNKNOWN_ENUM_VALUE");
      expect(result.diagnostics[0]?.message).toContain("UNKNOWN");
      expect(result.diagnostics[0]?.message).toContain("Status");
    });

    it("should reject non-enum value for enum type", () => {
      const result = validateDefaultValue(
        createFieldType("Status", { nullable: true }),
        stringValue("ACTIVE"),
        "testField",
        createLocation(),
        context,
      );
      expect(result.valid).toBe(false);
      expect(result.diagnostics[0]?.code).toBe("DEFAULT_VALUE_TYPE_MISMATCH");
    });
  });

  describe("List type validation", () => {
    it("should accept list value for list type", () => {
      const result = validateDefaultValue(
        createFieldType("String", { nullable: true, list: true }),
        listValue([stringValue("a"), stringValue("b")]),
        "testField",
        createLocation(),
        createContext(),
      );
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it("should reject non-list value for list type", () => {
      const result = validateDefaultValue(
        createFieldType("String", { nullable: true, list: true }),
        stringValue("not a list"),
        "testField",
        createLocation(),
        createContext(),
      );
      expect(result.valid).toBe(false);
      expect(result.diagnostics[0]?.code).toBe("DEFAULT_VALUE_TYPE_MISMATCH");
      expect(result.diagnostics[0]?.message).toContain("list");
    });

    it("should validate each element type in list", () => {
      const result = validateDefaultValue(
        createFieldType("Int", { nullable: true, list: true }),
        listValue([intValue("1"), stringValue("not int"), intValue("3")]),
        "testField",
        createLocation(),
        createContext(),
      );
      expect(result.valid).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.code).toBe("DEFAULT_VALUE_TYPE_MISMATCH");
    });

    it("should accept empty list", () => {
      const result = validateDefaultValue(
        createFieldType("String", { nullable: true, list: true }),
        listValue([]),
        "testField",
        createLocation(),
        createContext(),
      );
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it("should validate null elements based on listItemNullable", () => {
      const resultNullable = validateDefaultValue(
        createFieldType("String", {
          nullable: true,
          list: true,
          listItemNullable: true,
        }),
        listValue([stringValue("a"), nullValue()]),
        "testField",
        createLocation(),
        createContext(),
      );
      expect(resultNullable.valid).toBe(true);

      const resultNonNullable = validateDefaultValue(
        createFieldType("String", {
          nullable: true,
          list: true,
          listItemNullable: false,
        }),
        listValue([stringValue("a"), nullValue()]),
        "testField",
        createLocation(),
        createContext(),
      );
      expect(resultNonNullable.valid).toBe(false);
      expect(resultNonNullable.diagnostics[0]?.code).toBe(
        "NULL_DEFAULT_FOR_NON_NULL",
      );
    });
  });

  describe("Input Object type validation", () => {
    const context = createContext({
      inputObjects: {
        UserInput: {
          fields: [
            {
              name: "name",
              type: {
                typeName: "String",
                nullable: false,
                list: false,
                listItemNullable: null,
              },
            },
            {
              name: "age",
              type: {
                typeName: "Int",
                nullable: true,
                list: false,
                listItemNullable: null,
              },
            },
          ],
        },
      },
    });

    it("should accept valid object value", () => {
      const result = validateDefaultValue(
        createFieldType("UserInput", { nullable: true }),
        objectValue([
          { name: "name", value: stringValue("John") },
          { name: "age", value: intValue("30") },
        ]),
        "testField",
        createLocation(),
        context,
      );
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it("should reject non-object value for Input Object type", () => {
      const result = validateDefaultValue(
        createFieldType("UserInput", { nullable: true }),
        stringValue("not an object"),
        "testField",
        createLocation(),
        context,
      );
      expect(result.valid).toBe(false);
      expect(result.diagnostics[0]?.code).toBe("DEFAULT_VALUE_TYPE_MISMATCH");
    });

    it("should reject object with unknown field", () => {
      const result = validateDefaultValue(
        createFieldType("UserInput", { nullable: true }),
        objectValue([
          { name: "name", value: stringValue("John") },
          { name: "unknownField", value: stringValue("value") },
        ]),
        "testField",
        createLocation(),
        context,
      );
      expect(result.valid).toBe(false);
      expect(result.diagnostics[0]?.code).toBe("INVALID_INPUT_OBJECT_FIELD");
      expect(result.diagnostics[0]?.message).toContain("unknownField");
    });

    it("should validate field types in object", () => {
      const result = validateDefaultValue(
        createFieldType("UserInput", { nullable: true }),
        objectValue([
          { name: "name", value: stringValue("John") },
          { name: "age", value: stringValue("not a number") },
        ]),
        "testField",
        createLocation(),
        context,
      );
      expect(result.valid).toBe(false);
      expect(result.diagnostics[0]?.code).toBe("DEFAULT_VALUE_TYPE_MISMATCH");
    });

    it("should accept object with optional fields omitted", () => {
      const result = validateDefaultValue(
        createFieldType("UserInput", { nullable: true }),
        objectValue([{ name: "name", value: stringValue("John") }]),
        "testField",
        createLocation(),
        context,
      );
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });
  });

  describe("Custom scalar type validation", () => {
    const context = createContext({
      customScalars: ["DateTime", "JSON"],
    });

    it("should accept any value for custom scalar (no value validation)", () => {
      const resultString = validateDefaultValue(
        createFieldType("DateTime", { nullable: true }),
        stringValue("2023-01-01T00:00:00Z"),
        "testField",
        createLocation(),
        context,
      );
      expect(resultString.valid).toBe(true);

      const resultInt = validateDefaultValue(
        createFieldType("DateTime", { nullable: true }),
        intValue("1234567890"),
        "testField",
        createLocation(),
        context,
      );
      expect(resultInt.valid).toBe(true);
    });
  });

  describe("Error message quality", () => {
    it("should include expected type and actual value kind in error message", () => {
      const result = validateDefaultValue(
        createFieldType("Int", { nullable: true }),
        stringValue("hello"),
        "myField",
        createLocation(),
        createContext(),
      );
      expect(result.diagnostics[0]?.message).toContain("Int");
      expect(result.diagnostics[0]?.message).toContain("myField");
    });
  });
});
