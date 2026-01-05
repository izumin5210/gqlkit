/**
 * Tests for OnlyValidator.
 *
 * This module tests the validation of only constraints for scalar types.
 * Requirements 10.1-10.4: only constraint validation
 */

import { describe, expect, it } from "vitest";
import type { ScalarMetadataInfo } from "../../shared/scalar-metadata-detector.js";
import type { TSTypeReference } from "../../type-extractor/types/index.js";
import type { DefineApiResolverInfo } from "../extractor/define-api-extractor.js";
import { validateOnlyConstraints } from "./only-validator.js";

function createScalarMetadataInfo(
  scalarName: string,
  typeName: string,
  only: "input" | "output" | null = null,
): ScalarMetadataInfo {
  return {
    scalarName,
    typeName,
    only,
    sourceFile: "/src/scalars.ts",
    line: 1,
    description: null,
  };
}

function createTSTypeReference(
  name: string,
  scalarName: string | null = null,
): TSTypeReference {
  return {
    kind: scalarName ? "scalar" : "reference",
    name,
    elementType: null,
    members: null,
    nullable: false,
    scalarInfo: scalarName
      ? {
          scalarName,
          brandName: name,
          baseType: undefined,
          isCustom: true,
        }
      : null,
  };
}

function createResolverInfo(
  overrides: Partial<DefineApiResolverInfo>,
): DefineApiResolverInfo {
  return {
    fieldName: "testField",
    resolverType: "query",
    parentTypeName: null,
    argsType: null,
    args: null,
    returnType: {
      kind: "primitive",
      name: "string",
      elementType: null,
      members: null,
      nullable: false,
      scalarInfo: null,
    },
    sourceFile: "/src/resolvers/test.ts",
    exportedInputTypes: [],
    description: null,
    deprecated: null,
    ...overrides,
  };
}

describe("validateOnlyConstraints", () => {
  describe("Task 5.1: Input position での only: 'output' 違反検出", () => {
    it("should detect output-only scalar in resolver args (10.2)", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarMetadataInfo("DateTime", "DateTimeOutput", "output"),
        createScalarMetadataInfo("DateTime", "DateTimeInput", "input"),
      ];

      const resolverInfo = createResolverInfo({
        fieldName: "getEvent",
        args: [
          {
            name: "startDate",
            tsType: createTSTypeReference("DateTimeOutput", "DateTime"),
            optional: false,
            description: null,
            deprecated: null,
          },
        ],
      });

      const violations = validateOnlyConstraints(resolverInfo, scalarInfos);

      expect(violations).toHaveLength(1);
      expect(violations[0]?.code).toBe("OUTPUT_ONLY_IN_INPUT_POSITION");
      expect(violations[0]?.position).toBe("argument");
      expect(violations[0]?.typeName).toBe("DateTimeOutput");
      expect(violations[0]?.scalarName).toBe("DateTime");
    });

    it("should detect output-only scalar in nested args type", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarMetadataInfo("DateTime", "DateTimeOutput", "output"),
        createScalarMetadataInfo("DateTime", "DateTimeInput", "input"),
      ];

      const resolverInfo = createResolverInfo({
        fieldName: "getEvents",
        args: [
          {
            name: "filter",
            tsType: {
              kind: "reference",
              name: "EventFilter",
              elementType: null,
              members: null,
              nullable: false,
              scalarInfo: null,
            },
            optional: false,
            description: null,
            deprecated: null,
          },
        ],
        argsType: {
          kind: "reference",
          name: "GetEventsArgs",
          elementType: null,
          members: null,
          nullable: false,
          scalarInfo: null,
        },
      });

      const violations = validateOnlyConstraints(resolverInfo, scalarInfos);

      expect(violations).toHaveLength(0);
    });

    it("should detect output-only scalar in array args", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarMetadataInfo("DateTime", "DateTimeOutput", "output"),
        createScalarMetadataInfo("DateTime", "DateTimeInput", "input"),
      ];

      const resolverInfo = createResolverInfo({
        fieldName: "getEvents",
        args: [
          {
            name: "dates",
            tsType: {
              kind: "array",
              name: null,
              elementType: createTSTypeReference("DateTimeOutput", "DateTime"),
              members: null,
              nullable: false,
              scalarInfo: null,
            },
            optional: false,
            description: null,
            deprecated: null,
          },
        ],
      });

      const violations = validateOnlyConstraints(resolverInfo, scalarInfos);

      expect(violations).toHaveLength(1);
      expect(violations[0]?.code).toBe("OUTPUT_ONLY_IN_INPUT_POSITION");
    });

    it("should not report error for input-only scalar in args", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarMetadataInfo("DateTime", "DateTimeInput", "input"),
        createScalarMetadataInfo("DateTime", "DateTimeOutput", "output"),
      ];

      const resolverInfo = createResolverInfo({
        fieldName: "getEvent",
        args: [
          {
            name: "date",
            tsType: createTSTypeReference("DateTimeInput", "DateTime"),
            optional: false,
            description: null,
            deprecated: null,
          },
        ],
      });

      const violations = validateOnlyConstraints(resolverInfo, scalarInfos);

      expect(violations).toHaveLength(0);
    });

    it("should not report error for scalar without only constraint in args", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarMetadataInfo("DateTime", "DateTime", null),
      ];

      const resolverInfo = createResolverInfo({
        fieldName: "getEvent",
        args: [
          {
            name: "date",
            tsType: createTSTypeReference("DateTime", "DateTime"),
            optional: false,
            description: null,
            deprecated: null,
          },
        ],
      });

      const violations = validateOnlyConstraints(resolverInfo, scalarInfos);

      expect(violations).toHaveLength(0);
    });

    it("should generate actionable error message for input position violation", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarMetadataInfo("DateTime", "DateTimeOutput", "output"),
        createScalarMetadataInfo("DateTime", "DateTimeInput", "input"),
      ];

      const resolverInfo = createResolverInfo({
        fieldName: "createEvent",
        args: [
          {
            name: "startDate",
            tsType: createTSTypeReference("DateTimeOutput", "DateTime"),
            optional: false,
            description: null,
            deprecated: null,
          },
        ],
        sourceFile: "/src/resolvers/event.ts",
      });

      const violations = validateOnlyConstraints(resolverInfo, scalarInfos);

      expect(violations).toHaveLength(1);
      const violation = violations[0]!;
      expect(violation.message).toContain("DateTimeOutput");
      expect(violation.message).toContain("output-only");
      expect(violation.message).toContain("input");
    });
  });

  describe("Task 5.2: Output position での only: 'input' 違反検出", () => {
    it("should detect input-only scalar in resolver return type (10.4)", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarMetadataInfo("DateTime", "DateTimeInput", "input"),
        createScalarMetadataInfo("DateTime", "DateTimeOutput", "output"),
      ];

      const resolverInfo = createResolverInfo({
        fieldName: "getEvent",
        returnType: createTSTypeReference("DateTimeInput", "DateTime"),
      });

      const violations = validateOnlyConstraints(resolverInfo, scalarInfos);

      expect(violations).toHaveLength(1);
      expect(violations[0]?.code).toBe("INPUT_ONLY_IN_OUTPUT_POSITION");
      expect(violations[0]?.position).toBe("return");
      expect(violations[0]?.typeName).toBe("DateTimeInput");
      expect(violations[0]?.scalarName).toBe("DateTime");
    });

    it("should detect input-only scalar in array return type", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarMetadataInfo("DateTime", "DateTimeInput", "input"),
        createScalarMetadataInfo("DateTime", "DateTimeOutput", "output"),
      ];

      const resolverInfo = createResolverInfo({
        fieldName: "getEvents",
        returnType: {
          kind: "array",
          name: null,
          elementType: createTSTypeReference("DateTimeInput", "DateTime"),
          members: null,
          nullable: false,
          scalarInfo: null,
        },
      });

      const violations = validateOnlyConstraints(resolverInfo, scalarInfos);

      expect(violations).toHaveLength(1);
      expect(violations[0]?.code).toBe("INPUT_ONLY_IN_OUTPUT_POSITION");
    });

    it("should detect input-only scalar in nullable return type", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarMetadataInfo("DateTime", "DateTimeInput", "input"),
        createScalarMetadataInfo("DateTime", "DateTimeOutput", "output"),
      ];

      const resolverInfo = createResolverInfo({
        fieldName: "getEvent",
        returnType: {
          ...createTSTypeReference("DateTimeInput", "DateTime"),
          nullable: true,
        },
      });

      const violations = validateOnlyConstraints(resolverInfo, scalarInfos);

      expect(violations).toHaveLength(1);
      expect(violations[0]?.code).toBe("INPUT_ONLY_IN_OUTPUT_POSITION");
    });

    it("should not report error for output-only scalar in return type", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarMetadataInfo("DateTime", "DateTimeInput", "input"),
        createScalarMetadataInfo("DateTime", "DateTimeOutput", "output"),
      ];

      const resolverInfo = createResolverInfo({
        fieldName: "getEvent",
        returnType: createTSTypeReference("DateTimeOutput", "DateTime"),
      });

      const violations = validateOnlyConstraints(resolverInfo, scalarInfos);

      expect(violations).toHaveLength(0);
    });

    it("should not report error for scalar without only constraint in return type", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarMetadataInfo("DateTime", "DateTime", null),
      ];

      const resolverInfo = createResolverInfo({
        fieldName: "getEvent",
        returnType: createTSTypeReference("DateTime", "DateTime"),
      });

      const violations = validateOnlyConstraints(resolverInfo, scalarInfos);

      expect(violations).toHaveLength(0);
    });

    it("should generate actionable error message for output position violation", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarMetadataInfo("DateTime", "DateTimeInput", "input"),
        createScalarMetadataInfo("DateTime", "DateTimeOutput", "output"),
      ];

      const resolverInfo = createResolverInfo({
        fieldName: "getEvent",
        returnType: createTSTypeReference("DateTimeInput", "DateTime"),
        sourceFile: "/src/resolvers/event.ts",
      });

      const violations = validateOnlyConstraints(resolverInfo, scalarInfos);

      expect(violations).toHaveLength(1);
      const violation = violations[0]!;
      expect(violation.message).toContain("DateTimeInput");
      expect(violation.message).toContain("input-only");
      expect(violation.message).toContain("output");
    });
  });

  describe("Edge cases", () => {
    it("should handle resolver with no args", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarMetadataInfo("DateTime", "DateTimeInput", "input"),
      ];

      const resolverInfo = createResolverInfo({
        fieldName: "now",
        args: null,
        returnType: {
          kind: "primitive",
          name: "string",
          elementType: null,
          members: null,
          nullable: false,
          scalarInfo: null,
        },
      });

      const violations = validateOnlyConstraints(resolverInfo, scalarInfos);

      expect(violations).toHaveLength(0);
    });

    it("should handle empty scalar infos", () => {
      const resolverInfo = createResolverInfo({
        fieldName: "getEvent",
        args: [
          {
            name: "date",
            tsType: createTSTypeReference("DateTime", "DateTime"),
            optional: false,
            description: null,
            deprecated: null,
          },
        ],
        returnType: createTSTypeReference("DateTime", "DateTime"),
      });

      const violations = validateOnlyConstraints(resolverInfo, []);

      expect(violations).toHaveLength(0);
    });

    it("should handle multiple violations in same resolver", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarMetadataInfo("DateTime", "DateTimeInput", "input"),
        createScalarMetadataInfo("DateTime", "DateTimeOutput", "output"),
      ];

      const resolverInfo = createResolverInfo({
        fieldName: "processEvent",
        args: [
          {
            name: "date",
            tsType: createTSTypeReference("DateTimeOutput", "DateTime"),
            optional: false,
            description: null,
            deprecated: null,
          },
        ],
        returnType: createTSTypeReference("DateTimeInput", "DateTime"),
      });

      const violations = validateOnlyConstraints(resolverInfo, scalarInfos);

      expect(violations).toHaveLength(2);
      expect(
        violations.some((v) => v.code === "OUTPUT_ONLY_IN_INPUT_POSITION"),
      ).toBe(true);
      expect(
        violations.some((v) => v.code === "INPUT_ONLY_IN_OUTPUT_POSITION"),
      ).toBe(true);
    });

    it("should detect violations in union type members", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarMetadataInfo("DateTime", "DateTimeInput", "input"),
        createScalarMetadataInfo("DateTime", "DateTimeOutput", "output"),
      ];

      const resolverInfo = createResolverInfo({
        fieldName: "getEvent",
        returnType: {
          kind: "union",
          name: null,
          elementType: null,
          members: [
            createTSTypeReference("DateTimeInput", "DateTime"),
            {
              kind: "primitive",
              name: "null",
              elementType: null,
              members: null,
              nullable: false,
              scalarInfo: null,
            },
          ],
          nullable: true,
          scalarInfo: null,
        },
      });

      const violations = validateOnlyConstraints(resolverInfo, scalarInfos);

      expect(violations).toHaveLength(1);
      expect(violations[0]?.code).toBe("INPUT_ONLY_IN_OUTPUT_POSITION");
    });

    it("should validate field resolver return types", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarMetadataInfo("DateTime", "DateTimeInput", "input"),
        createScalarMetadataInfo("DateTime", "DateTimeOutput", "output"),
      ];

      const resolverInfo = createResolverInfo({
        fieldName: "createdAt",
        resolverType: "field",
        parentTypeName: "Event",
        returnType: createTSTypeReference("DateTimeInput", "DateTime"),
      });

      const violations = validateOnlyConstraints(resolverInfo, scalarInfos);

      expect(violations).toHaveLength(1);
      expect(violations[0]?.code).toBe("INPUT_ONLY_IN_OUTPUT_POSITION");
    });
  });
});
