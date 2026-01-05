/**
 * Tests for OnlyValidator.
 *
 * These tests verify that the OnlyValidator correctly detects
 * only constraint violations in resolver argument types and return types.
 */

import { describe, expect, it } from "vitest";
import type { TSTypeReference } from "../../type-extractor/types/index.js";
import { validateOnlyConstraints } from "./only-validator.js";

function createScalarTypeRef(
  scalarName: string,
  only: "input" | "output" | null,
): TSTypeReference {
  return {
    kind: "scalar",
    name: scalarName,
    elementType: null,
    members: null,
    nullable: false,
    scalarInfo: {
      scalarName,
      brandName: scalarName,
      baseType: undefined,
      isCustom: true,
      only,
    },
  };
}

function createArrayTypeRef(elementType: TSTypeReference): TSTypeReference {
  return {
    kind: "array",
    name: null,
    elementType,
    members: null,
    nullable: false,
    scalarInfo: null,
  };
}

function createNullableTypeRef(inner: TSTypeReference): TSTypeReference {
  return {
    ...inner,
    nullable: true,
  };
}

function createObjectTypeRef(name: string): TSTypeReference {
  return {
    kind: "reference",
    name,
    elementType: null,
    members: null,
    nullable: false,
    scalarInfo: null,
  };
}

describe("OnlyValidator", () => {
  describe("5.1 Detect only: 'output' violation in input position", () => {
    it("should error when output-only type is used in input type field", () => {
      const fieldType = createScalarTypeRef("DateTime", "output");

      const violations = validateOnlyConstraints({
        typeRef: fieldType,
        position: "input",
        context: {
          kind: "inputTypeField",
          typeName: "CreateUserInput",
          fieldName: "createdAt",
          sourceFile: "/src/gql/types/user.ts",
          line: 10,
        },
      });

      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        code: "OUTPUT_ONLY_IN_INPUT_POSITION",
        scalarName: "DateTime",
        only: "output",
        position: "input",
      });
      expect(violations[0]?.message).toContain("DateTime");
      expect(violations[0]?.message).toContain("output-only");
      expect(violations[0]?.message).toContain("input");
    });

    it("should error when output-only type is used in resolver argument type", () => {
      const argType = createScalarTypeRef("DateTimeOutput", "output");

      const violations = validateOnlyConstraints({
        typeRef: argType,
        position: "input",
        context: {
          kind: "resolverArgument",
          resolverName: "createUser",
          argumentName: "createdAt",
          sourceFile: "/src/gql/resolvers/user.ts",
          line: 15,
        },
      });

      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        code: "OUTPUT_ONLY_IN_INPUT_POSITION",
        scalarName: "DateTimeOutput",
        position: "input",
      });
    });

    it("should generate actionable error message", () => {
      const fieldType = createScalarTypeRef("DateTime", "output");

      const violations = validateOnlyConstraints({
        typeRef: fieldType,
        position: "input",
        context: {
          kind: "inputTypeField",
          typeName: "CreateUserInput",
          fieldName: "createdAt",
          sourceFile: "/src/gql/types/user.ts",
          line: 10,
        },
      });

      expect(violations[0]?.message).toContain(
        "Use a type without 'only' constraint or with 'only: \"input\"'",
      );
    });

    it("should error when output-only type is nested in array in input position", () => {
      const outputOnlyScalar = createScalarTypeRef("DateTime", "output");
      const arrayType = createArrayTypeRef(outputOnlyScalar);

      const violations = validateOnlyConstraints({
        typeRef: arrayType,
        position: "input",
        context: {
          kind: "resolverArgument",
          resolverName: "createUsers",
          argumentName: "dates",
          sourceFile: "/src/gql/resolvers/user.ts",
          line: 20,
        },
      });

      expect(violations).toHaveLength(1);
      expect(violations[0]?.scalarName).toBe("DateTime");
    });

    it("should error when output-only type is nullable in input position", () => {
      const outputOnlyScalar = createScalarTypeRef("DateTime", "output");
      const nullableType = createNullableTypeRef(outputOnlyScalar);

      const violations = validateOnlyConstraints({
        typeRef: nullableType,
        position: "input",
        context: {
          kind: "inputTypeField",
          typeName: "CreateUserInput",
          fieldName: "createdAt",
          sourceFile: "/src/gql/types/user.ts",
          line: 10,
        },
      });

      expect(violations).toHaveLength(1);
      expect(violations[0]?.scalarName).toBe("DateTime");
    });

    it("should not error when input-only type is used in input position", () => {
      const inputOnlyScalar = createScalarTypeRef("DateTimeInput", "input");

      const violations = validateOnlyConstraints({
        typeRef: inputOnlyScalar,
        position: "input",
        context: {
          kind: "inputTypeField",
          typeName: "CreateUserInput",
          fieldName: "createdAt",
          sourceFile: "/src/gql/types/user.ts",
          line: 10,
        },
      });

      expect(violations).toHaveLength(0);
    });

    it("should not error when type without only constraint is used in input position", () => {
      const noConstraintScalar = createScalarTypeRef("DateTime", null);

      const violations = validateOnlyConstraints({
        typeRef: noConstraintScalar,
        position: "input",
        context: {
          kind: "inputTypeField",
          typeName: "CreateUserInput",
          fieldName: "createdAt",
          sourceFile: "/src/gql/types/user.ts",
          line: 10,
        },
      });

      expect(violations).toHaveLength(0);
    });

    it("should not error for object types in input position", () => {
      const objectType = createObjectTypeRef("CreateUserInput");

      const violations = validateOnlyConstraints({
        typeRef: objectType,
        position: "input",
        context: {
          kind: "resolverArgument",
          resolverName: "createUser",
          argumentName: "input",
          sourceFile: "/src/gql/resolvers/user.ts",
          line: 15,
        },
      });

      expect(violations).toHaveLength(0);
    });
  });

  describe("5.2 Detect only: 'input' violation in output position", () => {
    it("should error when input-only type is used in object type field", () => {
      const fieldType = createScalarTypeRef("DateTimeInput", "input");

      const violations = validateOnlyConstraints({
        typeRef: fieldType,
        position: "output",
        context: {
          kind: "objectTypeField",
          typeName: "User",
          fieldName: "createdAt",
          sourceFile: "/src/gql/types/user.ts",
          line: 10,
        },
      });

      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        code: "INPUT_ONLY_IN_OUTPUT_POSITION",
        scalarName: "DateTimeInput",
        only: "input",
        position: "output",
      });
      expect(violations[0]?.message).toContain("DateTimeInput");
      expect(violations[0]?.message).toContain("input-only");
      expect(violations[0]?.message).toContain("output");
    });

    it("should error when input-only type is used in resolver return type", () => {
      const returnType = createScalarTypeRef("DateTimeInput", "input");

      const violations = validateOnlyConstraints({
        typeRef: returnType,
        position: "output",
        context: {
          kind: "resolverReturnType",
          resolverName: "getUser",
          sourceFile: "/src/gql/resolvers/user.ts",
          line: 25,
        },
      });

      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        code: "INPUT_ONLY_IN_OUTPUT_POSITION",
        scalarName: "DateTimeInput",
        position: "output",
      });
    });

    it("should generate actionable error message", () => {
      const fieldType = createScalarTypeRef("DateTimeInput", "input");

      const violations = validateOnlyConstraints({
        typeRef: fieldType,
        position: "output",
        context: {
          kind: "objectTypeField",
          typeName: "User",
          fieldName: "createdAt",
          sourceFile: "/src/gql/types/user.ts",
          line: 10,
        },
      });

      expect(violations[0]?.message).toContain(
        "Use a type without 'only' constraint or with 'only: \"output\"'",
      );
    });

    it("should error when input-only type is nested in array in output position", () => {
      const inputOnlyScalar = createScalarTypeRef("DateTimeInput", "input");
      const arrayType = createArrayTypeRef(inputOnlyScalar);

      const violations = validateOnlyConstraints({
        typeRef: arrayType,
        position: "output",
        context: {
          kind: "resolverReturnType",
          resolverName: "getDates",
          sourceFile: "/src/gql/resolvers/user.ts",
          line: 30,
        },
      });

      expect(violations).toHaveLength(1);
      expect(violations[0]?.scalarName).toBe("DateTimeInput");
    });

    it("should error when input-only type is nullable in output position", () => {
      const inputOnlyScalar = createScalarTypeRef("DateTimeInput", "input");
      const nullableType = createNullableTypeRef(inputOnlyScalar);

      const violations = validateOnlyConstraints({
        typeRef: nullableType,
        position: "output",
        context: {
          kind: "objectTypeField",
          typeName: "User",
          fieldName: "createdAt",
          sourceFile: "/src/gql/types/user.ts",
          line: 10,
        },
      });

      expect(violations).toHaveLength(1);
      expect(violations[0]?.scalarName).toBe("DateTimeInput");
    });

    it("should not error when output-only type is used in output position", () => {
      const outputOnlyScalar = createScalarTypeRef("DateTimeOutput", "output");

      const violations = validateOnlyConstraints({
        typeRef: outputOnlyScalar,
        position: "output",
        context: {
          kind: "objectTypeField",
          typeName: "User",
          fieldName: "createdAt",
          sourceFile: "/src/gql/types/user.ts",
          line: 10,
        },
      });

      expect(violations).toHaveLength(0);
    });

    it("should not error when type without only constraint is used in output position", () => {
      const noConstraintScalar = createScalarTypeRef("DateTime", null);

      const violations = validateOnlyConstraints({
        typeRef: noConstraintScalar,
        position: "output",
        context: {
          kind: "objectTypeField",
          typeName: "User",
          fieldName: "createdAt",
          sourceFile: "/src/gql/types/user.ts",
          line: 10,
        },
      });

      expect(violations).toHaveLength(0);
    });

    it("should not error for object types in output position", () => {
      const objectType = createObjectTypeRef("User");

      const violations = validateOnlyConstraints({
        typeRef: objectType,
        position: "output",
        context: {
          kind: "resolverReturnType",
          resolverName: "getUser",
          sourceFile: "/src/gql/resolvers/user.ts",
          line: 25,
        },
      });

      expect(violations).toHaveLength(0);
    });
  });

  describe("Nested types with multiple scalars", () => {
    it("should detect all violations in nested array structure", () => {
      const inputOnlyScalar = createScalarTypeRef("DateTimeInput", "input");
      const nestedArray = createArrayTypeRef(
        createArrayTypeRef(inputOnlyScalar),
      );

      const violations = validateOnlyConstraints({
        typeRef: nestedArray,
        position: "output",
        context: {
          kind: "objectTypeField",
          typeName: "Schedule",
          fieldName: "dates",
          sourceFile: "/src/gql/types/schedule.ts",
          line: 5,
        },
      });

      expect(violations).toHaveLength(1);
      expect(violations[0]?.scalarName).toBe("DateTimeInput");
    });
  });
});
