/**
 * Tests for ScalarCollector.
 *
 * These tests verify that the ScalarCollector correctly collects scalar
 * definitions from types and config, validates input/output type constraints,
 * and builds type parameters.
 */

import { describe, expect, it } from "vitest";
import type { ScalarMetadataInfo } from "./scalar-collector.js";
import { collectScalars, mergeDescriptions } from "./scalar-collector.js";

describe("ScalarCollector", () => {
  describe("3.1 sourceDir custom scalar collection", () => {
    it("should collect a single custom scalar with no only constraint", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        {
          scalarName: "DateTime",
          typeName: "DateTime",
          only: null,
          sourceFile: "/src/types/scalars.ts",
          line: 10,
          description: "ISO 8601 date time",
        },
      ];

      const result = collectScalars(scalarInfos, []);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error("Expected success");

      expect(result.data).toHaveLength(1);
      const scalar = result.data[0]!;
      expect(scalar.scalarName).toBe("DateTime");
      expect(scalar.inputType?.typeName).toBe("DateTime");
      expect(scalar.outputTypes).toHaveLength(1);
      expect(scalar.outputTypes[0]?.typeName).toBe("DateTime");
      expect(scalar.isCustom).toBe(true);
    });

    it("should collect multiple TypeScript types for the same scalar name", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        {
          scalarName: "DateTime",
          typeName: "DateTimeInput",
          only: "input",
          sourceFile: "/src/types/scalars.ts",
          line: 10,
          description: "Input type for DateTime",
        },
        {
          scalarName: "DateTime",
          typeName: "DateTimeOutput",
          only: "output",
          sourceFile: "/src/types/scalars.ts",
          line: 15,
          description: "Output type for DateTime",
        },
      ];

      const result = collectScalars(scalarInfos, []);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error("Expected success");

      expect(result.data).toHaveLength(1);
      const scalar = result.data[0]!;
      expect(scalar.scalarName).toBe("DateTime");
      expect(scalar.inputType?.typeName).toBe("DateTimeInput");
      expect(scalar.outputTypes).toHaveLength(1);
      expect(scalar.outputTypes[0]?.typeName).toBe("DateTimeOutput");
    });

    it("should merge DefineScalar and config file definitions", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        {
          scalarName: "DateTime",
          typeName: "DateTimeInput",
          only: "input",
          sourceFile: "/src/types/scalars.ts",
          line: 10,
          description: "Input type",
        },
      ];

      const configScalars = [
        {
          scalarName: "DateTime",
          typeName: "DateTimeOutput",
          only: "output" as const,
          sourceFile: "/src/types/output.ts",
          line: 5,
          description: "Config output type",
          fromConfig: true,
        },
      ];

      const result = collectScalars(scalarInfos, configScalars);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error("Expected success");

      expect(result.data).toHaveLength(1);
      const scalar = result.data[0]!;
      expect(scalar.scalarName).toBe("DateTime");
      expect(scalar.inputType?.typeName).toBe("DateTimeInput");
      expect(scalar.outputTypes).toHaveLength(1);
      expect(scalar.outputTypes[0]?.typeName).toBe("DateTimeOutput");
    });

    it("should exclude built-in scalars from collection", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        {
          scalarName: "Int",
          typeName: "Int",
          only: null,
          sourceFile: "/src/types/scalars.ts",
          line: 1,
          description: null,
        },
        {
          scalarName: "DateTime",
          typeName: "DateTime",
          only: null,
          sourceFile: "/src/types/scalars.ts",
          line: 5,
          description: null,
        },
      ];

      const result = collectScalars(scalarInfos, []);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error("Expected success");

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.scalarName).toBe("DateTime");
    });
  });

  describe("3.2 Input/Output type parameter construction", () => {
    it("should use type without only as both input and output", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        {
          scalarName: "DateTime",
          typeName: "DateTime",
          only: null,
          sourceFile: "/src/types/scalars.ts",
          line: 10,
          description: null,
        },
      ];

      const result = collectScalars(scalarInfos, []);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error("Expected success");

      const scalar = result.data[0]!;
      expect(scalar.inputType?.typeName).toBe("DateTime");
      expect(scalar.outputTypes).toHaveLength(1);
      expect(scalar.outputTypes[0]?.typeName).toBe("DateTime");
    });

    it("should use only: input type as input type", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        {
          scalarName: "DateTime",
          typeName: "DateTimeInput",
          only: "input",
          sourceFile: "/src/types/scalars.ts",
          line: 10,
          description: null,
        },
        {
          scalarName: "DateTime",
          typeName: "DateTimeOutput",
          only: "output",
          sourceFile: "/src/types/scalars.ts",
          line: 15,
          description: null,
        },
      ];

      const result = collectScalars(scalarInfos, []);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error("Expected success");

      const scalar = result.data[0]!;
      expect(scalar.inputType?.typeName).toBe("DateTimeInput");
    });

    it("should build union for multiple only: output types", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        {
          scalarName: "DateTime",
          typeName: "DateTimeInput",
          only: "input",
          sourceFile: "/src/types/scalars.ts",
          line: 10,
          description: null,
        },
        {
          scalarName: "DateTime",
          typeName: "DateTimeOutput1",
          only: "output",
          sourceFile: "/src/types/scalars.ts",
          line: 15,
          description: null,
        },
        {
          scalarName: "DateTime",
          typeName: "DateTimeOutput2",
          only: "output",
          sourceFile: "/src/types/scalars.ts",
          line: 20,
          description: null,
        },
      ];

      const result = collectScalars(scalarInfos, []);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error("Expected success");

      const scalar = result.data[0]!;
      expect(scalar.outputTypes).toHaveLength(2);
      expect(scalar.outputTypes.map((t) => t.typeName).sort()).toEqual([
        "DateTimeOutput1",
        "DateTimeOutput2",
      ]);
    });

    it("should include type without only in output union", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        {
          scalarName: "DateTime",
          typeName: "DateTime",
          only: null,
          sourceFile: "/src/types/scalars.ts",
          line: 10,
          description: null,
        },
        {
          scalarName: "DateTime",
          typeName: "DateTimeString",
          only: "output",
          sourceFile: "/src/types/scalars.ts",
          line: 15,
          description: null,
        },
      ];

      const result = collectScalars(scalarInfos, []);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error("Expected success");

      const scalar = result.data[0]!;
      expect(scalar.inputType?.typeName).toBe("DateTime");
      expect(scalar.outputTypes).toHaveLength(2);
      expect(scalar.outputTypes.map((t) => t.typeName).sort()).toEqual([
        "DateTime",
        "DateTimeString",
      ]);
    });
  });

  describe("3.3 Input type multiple mapping error detection", () => {
    it("should error when multiple only: input types exist for same scalar", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        {
          scalarName: "DateTime",
          typeName: "DateTimeInput1",
          only: "input",
          sourceFile: "/src/types/scalars.ts",
          line: 10,
          description: null,
        },
        {
          scalarName: "DateTime",
          typeName: "DateTimeInput2",
          only: "input",
          sourceFile: "/src/types/scalars.ts",
          line: 15,
          description: null,
        },
      ];

      const result = collectScalars(scalarInfos, []);

      expect(result.success).toBe(false);
      if (result.success) throw new Error("Expected failure");

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.code).toBe("MULTIPLE_INPUT_TYPES");
      expect(result.errors[0]?.message).toContain("DateTime");
      expect(result.errors[0]?.message).toContain("DateTimeInput1");
      expect(result.errors[0]?.message).toContain("DateTimeInput2");
    });

    it("should error when multiple types without only exist for same scalar", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        {
          scalarName: "DateTime",
          typeName: "DateTime1",
          only: null,
          sourceFile: "/src/types/scalars.ts",
          line: 10,
          description: null,
        },
        {
          scalarName: "DateTime",
          typeName: "DateTime2",
          only: null,
          sourceFile: "/src/types/other.ts",
          line: 5,
          description: null,
        },
      ];

      const result = collectScalars(scalarInfos, []);

      expect(result.success).toBe(false);
      if (result.success) throw new Error("Expected failure");

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.code).toBe("MULTIPLE_INPUT_TYPES");
    });

    it("should error when type without only and only: input mix exists", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        {
          scalarName: "DateTime",
          typeName: "DateTime",
          only: null,
          sourceFile: "/src/types/scalars.ts",
          line: 10,
          description: null,
        },
        {
          scalarName: "DateTime",
          typeName: "DateTimeInput",
          only: "input",
          sourceFile: "/src/types/scalars.ts",
          line: 15,
          description: null,
        },
      ];

      const result = collectScalars(scalarInfos, []);

      expect(result.success).toBe(false);
      if (result.success) throw new Error("Expected failure");

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.code).toBe("MULTIPLE_INPUT_TYPES");
    });

    it("should include file and line in error message", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        {
          scalarName: "DateTime",
          typeName: "DateTimeInput1",
          only: "input",
          sourceFile: "/src/types/scalars.ts",
          line: 10,
          description: null,
        },
        {
          scalarName: "DateTime",
          typeName: "DateTimeInput2",
          only: "input",
          sourceFile: "/src/types/other.ts",
          line: 25,
          description: null,
        },
      ];

      const result = collectScalars(scalarInfos, []);

      expect(result.success).toBe(false);
      if (result.success) throw new Error("Expected failure");

      expect(result.errors[0]?.message).toContain("/src/types/scalars.ts:10");
      expect(result.errors[0]?.message).toContain("/src/types/other.ts:25");
    });
  });

  describe("3.4 Input/Output type missing error detection", () => {
    it("should error when custom scalar has no output type", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        {
          scalarName: "DateTime",
          typeName: "DateTimeInput",
          only: "input",
          sourceFile: "/src/types/scalars.ts",
          line: 10,
          description: null,
        },
      ];

      const result = collectScalars(scalarInfos, []);

      expect(result.success).toBe(false);
      if (result.success) throw new Error("Expected failure");

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.code).toBe("MISSING_OUTPUT_TYPE");
      expect(result.errors[0]?.message).toContain("DateTime");
      expect(result.errors[0]?.message).toContain("output");
    });

    it("should error when custom scalar has no input type", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        {
          scalarName: "DateTime",
          typeName: "DateTimeOutput",
          only: "output",
          sourceFile: "/src/types/scalars.ts",
          line: 10,
          description: null,
        },
      ];

      const result = collectScalars(scalarInfos, []);

      expect(result.success).toBe(false);
      if (result.success) throw new Error("Expected failure");

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.code).toBe("MISSING_INPUT_TYPE");
      expect(result.errors[0]?.message).toContain("DateTime");
      expect(result.errors[0]?.message).toContain("input");
    });

    it("should report multiple errors for missing input and output types", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        {
          scalarName: "DateTime",
          typeName: "DateTimeOutput",
          only: "output",
          sourceFile: "/src/types/scalars.ts",
          line: 10,
          description: null,
        },
        {
          scalarName: "URL",
          typeName: "URLInput",
          only: "input",
          sourceFile: "/src/types/scalars.ts",
          line: 15,
          description: null,
        },
      ];

      const result = collectScalars(scalarInfos, []);

      expect(result.success).toBe(false);
      if (result.success) throw new Error("Expected failure");

      expect(result.errors).toHaveLength(2);
      const codes = result.errors.map((e) => e.code);
      expect(codes).toContain("MISSING_INPUT_TYPE");
      expect(codes).toContain("MISSING_OUTPUT_TYPE");
    });
  });

  describe("6.1-6.2 Description collection and merging", () => {
    it("6.1 should collect descriptions from scalar types", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        {
          scalarName: "DateTime",
          typeName: "DateTime",
          only: null,
          sourceFile: "/src/types/scalars.ts",
          line: 10,
          description: "ISO 8601 date time format",
        },
      ];

      const result = collectScalars(scalarInfos, []);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error("Expected success");

      const scalar = result.data[0]!;
      expect(scalar.descriptions).toHaveLength(1);
      expect(scalar.descriptions[0]?.text).toBe("ISO 8601 date time format");
      expect(scalar.descriptions[0]?.fromConfig).toBe(false);
    });

    it("should collect descriptions from config scalars", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        {
          scalarName: "DateTime",
          typeName: "DateTimeInput",
          only: "input",
          sourceFile: "/src/types/scalars.ts",
          line: 10,
          description: null,
        },
      ];

      const configScalars = [
        {
          scalarName: "DateTime",
          typeName: "DateTimeOutput",
          only: "output" as const,
          sourceFile: "/src/types/output.ts",
          line: 5,
          description: "Config description",
          fromConfig: true,
        },
      ];

      const result = collectScalars(scalarInfos, configScalars);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error("Expected success");

      const scalar = result.data[0]!;
      const configDesc = scalar.descriptions.find((d) => d.fromConfig);
      expect(configDesc?.text).toBe("Config description");
    });

    it("6.2 should sort descriptions by file path then line", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        {
          scalarName: "DateTime",
          typeName: "DateTimeZ",
          only: "output",
          sourceFile: "/src/types/z.ts",
          line: 5,
          description: "Z file",
        },
        {
          scalarName: "DateTime",
          typeName: "DateTimeInput",
          only: "input",
          sourceFile: "/src/types/a.ts",
          line: 20,
          description: "A file line 20",
        },
        {
          scalarName: "DateTime",
          typeName: "DateTimeA",
          only: "output",
          sourceFile: "/src/types/a.ts",
          line: 10,
          description: "A file line 10",
        },
      ];

      const result = collectScalars(scalarInfos, []);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error("Expected success");

      const scalar = result.data[0]!;
      expect(scalar.descriptions.map((d) => d.text)).toEqual([
        "A file line 10",
        "A file line 20",
        "Z file",
      ]);
    });
  });

  describe("6.2 mergeDescriptions function", () => {
    it("should merge multiple descriptions with blank line separator", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        {
          scalarName: "DateTime",
          typeName: "DateTimeA",
          only: "output",
          sourceFile: "/src/types/a.ts",
          line: 10,
          description: "First description",
        },
        {
          scalarName: "DateTime",
          typeName: "DateTimeInput",
          only: "input",
          sourceFile: "/src/types/b.ts",
          line: 5,
          description: "Second description",
        },
      ];

      const result = collectScalars(scalarInfos, []);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error("Expected success");

      const scalar = result.data[0]!;
      const mergedDescription = mergeDescriptions(scalar.descriptions);
      expect(mergedDescription).toBe("First description\n\nSecond description");
    });

    it("should return null when no descriptions available", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        {
          scalarName: "DateTime",
          typeName: "DateTime",
          only: null,
          sourceFile: "/src/types/a.ts",
          line: 10,
          description: null,
        },
      ];

      const result = collectScalars(scalarInfos, []);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error("Expected success");

      const scalar = result.data[0]!;
      const mergedDescription = mergeDescriptions(scalar.descriptions);
      expect(mergedDescription).toBeNull();
    });

    it("should return single description without separator when only one", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        {
          scalarName: "DateTime",
          typeName: "DateTime",
          only: null,
          sourceFile: "/src/types/a.ts",
          line: 10,
          description: "Single description",
        },
      ];

      const result = collectScalars(scalarInfos, []);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error("Expected success");

      const scalar = result.data[0]!;
      const mergedDescription = mergeDescriptions(scalar.descriptions);
      expect(mergedDescription).toBe("Single description");
    });
  });

  describe("Multiple scalar handling", () => {
    it("should collect multiple different scalars", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        {
          scalarName: "DateTime",
          typeName: "DateTime",
          only: null,
          sourceFile: "/src/types/scalars.ts",
          line: 10,
          description: null,
        },
        {
          scalarName: "URL",
          typeName: "URL",
          only: null,
          sourceFile: "/src/types/scalars.ts",
          line: 20,
          description: null,
        },
      ];

      const result = collectScalars(scalarInfos, []);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error("Expected success");

      expect(result.data).toHaveLength(2);
      expect(result.data.map((s) => s.scalarName).sort()).toEqual([
        "DateTime",
        "URL",
      ]);
    });
  });
});
