/**
 * Tests for scalar collector.
 *
 * This module tests the collection of scalar definitions from detected metadata
 * and validates input/output type constraints.
 */

import { describe, expect, it } from "vitest";
import {
  type ConfigScalarMapping,
  collectDescription,
  collectScalars,
  type DescriptionSource,
} from "./scalar-collector.js";
import type { ScalarMetadataInfo } from "./scalar-metadata-detector.js";

function createScalarInfo(
  scalarName: string,
  typeName: string,
  only: "input" | "output" | null = null,
  sourceFile = "/test.ts",
  line = 1,
): ScalarMetadataInfo {
  return {
    scalarName,
    typeName,
    only,
    sourceFile,
    line,
    description: null,
  };
}

function createConfigScalar(
  name: string,
  tsTypeName: string,
  only?: "input" | "output",
  from?: string,
  description?: string,
): ConfigScalarMapping {
  const tsType: { name: string; from?: string } = { name: tsTypeName };
  if (from !== undefined) {
    tsType.from = from;
  }
  const result: ConfigScalarMapping = { name, tsType };
  if (only !== undefined) {
    (result as { only?: "input" | "output" }).only = only;
  }
  if (description !== undefined) {
    (result as { description?: string }).description = description;
  }
  return result;
}

describe("collectScalars", () => {
  describe("Task 3.1: sourceDir からの custom scalar 収集", () => {
    it("should collect a single scalar definition with no only constraint", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarInfo("DateTime", "DateTime"),
      ];
      const result = collectScalars(scalarInfos, []);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected success");

      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.scalarName).toBe("DateTime");
      expect(result.value[0]?.isCustom).toBe(true);
    });

    it("should collect multiple TypeScript types for the same scalar name", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarInfo("DateTime", "DateTimeInput", "input", "/test.ts", 1),
        createScalarInfo("DateTime", "DateTimeOutput", "output", "/test.ts", 5),
      ];
      const result = collectScalars(scalarInfos, []);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected success");

      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.scalarName).toBe("DateTime");
      expect(result.value[0]?.inputType?.typeName).toBe("DateTimeInput");
      expect(result.value[0]?.outputTypes).toHaveLength(1);
      expect(result.value[0]?.outputTypes[0]?.typeName).toBe("DateTimeOutput");
    });

    it("should merge DefineScalar and config file definitions", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarInfo("DateTime", "DateTimeInput", "input"),
      ];
      const configScalars: ConfigScalarMapping[] = [
        createConfigScalar("DateTime", "DateTimeOutput", "output"),
      ];
      const result = collectScalars(scalarInfos, configScalars);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected success");

      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.scalarName).toBe("DateTime");
      expect(result.value[0]?.inputType?.typeName).toBe("DateTimeInput");
      expect(result.value[0]?.outputTypes[0]?.typeName).toBe("DateTimeOutput");
    });

    it("should not collect built-in scalars (ID, Int, Float, String, Boolean)", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarInfo("ID", "IDString"),
        createScalarInfo("Int", "Int"),
        createScalarInfo("Float", "Float"),
        createScalarInfo("String", null!),
        createScalarInfo("Boolean", null!),
        createScalarInfo("DateTime", "DateTime"),
      ];
      const result = collectScalars(scalarInfos, []);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected success");

      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.scalarName).toBe("DateTime");
    });
  });

  describe("Task 3.2: Input/Output 型パラメータの構築", () => {
    it("should use only-less type as both input and output (8.1)", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarInfo("DateTime", "DateTime", null),
      ];
      const result = collectScalars(scalarInfos, []);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected success");

      const scalar = result.value[0]!;
      expect(scalar.inputType?.typeName).toBe("DateTime");
      expect(scalar.outputTypes).toHaveLength(1);
      expect(scalar.outputTypes[0]?.typeName).toBe("DateTime");
    });

    it("should use only: 'input' type as input parameter (8.2)", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarInfo("DateTime", "DateTimeInput", "input"),
        createScalarInfo("DateTime", "DateTimeOutput", "output"),
      ];
      const result = collectScalars(scalarInfos, []);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected success");

      const scalar = result.value[0]!;
      expect(scalar.inputType?.typeName).toBe("DateTimeInput");
    });

    it("should build union of multiple only: 'output' types (8.3)", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarInfo("DateTime", "DateTimeInput", "input"),
        createScalarInfo(
          "DateTime",
          "DateTimeOutput1",
          "output",
          "/test.ts",
          1,
        ),
        createScalarInfo(
          "DateTime",
          "DateTimeOutput2",
          "output",
          "/test.ts",
          5,
        ),
      ];
      const result = collectScalars(scalarInfos, []);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected success");

      const scalar = result.value[0]!;
      expect(scalar.outputTypes).toHaveLength(2);
      const outputTypeNames = scalar.outputTypes.map((t) => t.typeName);
      expect(outputTypeNames).toContain("DateTimeOutput1");
      expect(outputTypeNames).toContain("DateTimeOutput2");
    });

    it("should include both only-less and only: 'output' types in output union (8.4)", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarInfo("DateTime", "DateTime", null, "/test.ts", 1),
        createScalarInfo("DateTime", "DateTimeOutput", "output", "/test.ts", 5),
      ];
      const result = collectScalars(scalarInfos, []);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected success");

      const scalar = result.value[0]!;
      expect(scalar.inputType?.typeName).toBe("DateTime");
      expect(scalar.outputTypes).toHaveLength(2);
      const outputTypeNames = scalar.outputTypes.map((t) => t.typeName);
      expect(outputTypeNames).toContain("DateTime");
      expect(outputTypeNames).toContain("DateTimeOutput");
    });
  });

  describe("Task 3.3: Input 型の複数マッピングエラー検出", () => {
    it("should error when multiple only: 'input' types are defined for same scalar (12.1)", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarInfo("DateTime", "DateTimeInput1", "input", "/test.ts", 1),
        createScalarInfo("DateTime", "DateTimeInput2", "input", "/test.ts", 5),
        createScalarInfo(
          "DateTime",
          "DateTimeOutput",
          "output",
          "/test.ts",
          10,
        ),
      ];
      const result = collectScalars(scalarInfos, []);

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Expected error");

      expect(result.error).toHaveLength(1);
      expect(result.error[0]?.code).toBe("MULTIPLE_INPUT_TYPES");
      expect(result.error[0]?.message).toContain("DateTimeInput1");
      expect(result.error[0]?.message).toContain("DateTimeInput2");
    });

    it("should error when multiple only-less types are defined for same scalar (12.2)", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarInfo("DateTime", "DateTime1", null, "/test.ts", 1),
        createScalarInfo("DateTime", "DateTime2", null, "/test.ts", 5),
      ];
      const result = collectScalars(scalarInfos, []);

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Expected error");

      expect(result.error).toHaveLength(1);
      expect(result.error[0]?.code).toBe("MULTIPLE_INPUT_TYPES");
      expect(result.error[0]?.message).toContain("DateTime1");
      expect(result.error[0]?.message).toContain("DateTime2");
    });

    it("should error when only-less and only: 'input' types are both defined (12.3)", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarInfo("DateTime", "DateTime", null, "/test.ts", 1),
        createScalarInfo("DateTime", "DateTimeInput", "input", "/test.ts", 5),
        createScalarInfo(
          "DateTime",
          "DateTimeOutput",
          "output",
          "/test.ts",
          10,
        ),
      ];
      const result = collectScalars(scalarInfos, []);

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Expected error");

      expect(result.error).toHaveLength(1);
      expect(result.error[0]?.code).toBe("MULTIPLE_INPUT_TYPES");
      expect(result.error[0]?.message).toContain("DateTime");
      expect(result.error[0]?.message).toContain("DateTimeInput");
    });

    it("should include conflicting type names and locations in error message (12.4)", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarInfo(
          "DateTime",
          "DateTimeInput1",
          "input",
          "/src/a.ts",
          10,
        ),
        createScalarInfo(
          "DateTime",
          "DateTimeInput2",
          "input",
          "/src/b.ts",
          20,
        ),
        createScalarInfo("DateTime", "DateTimeOutput", "output"),
      ];
      const result = collectScalars(scalarInfos, []);

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Expected error");

      expect(result.error[0]?.message).toContain("DateTimeInput1");
      expect(result.error[0]?.message).toContain("DateTimeInput2");
      expect(result.error[0]?.message).toContain("/src/a.ts");
      expect(result.error[0]?.message).toContain("/src/b.ts");
    });
  });

  describe("Task 3.4: Input/Output 型の不足エラー検出", () => {
    it("should error when custom scalar has no output type (13.1)", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarInfo("DateTime", "DateTimeInput", "input"),
      ];
      const result = collectScalars(scalarInfos, []);

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Expected error");

      expect(result.error).toHaveLength(1);
      expect(result.error[0]?.code).toBe("MISSING_OUTPUT_TYPE");
      expect(result.error[0]?.message).toContain("DateTime");
    });

    it("should error when custom scalar has no input type (13.2)", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarInfo("DateTime", "DateTimeOutput", "output"),
      ];
      const result = collectScalars(scalarInfos, []);

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Expected error");

      expect(result.error).toHaveLength(1);
      expect(result.error[0]?.code).toBe("MISSING_INPUT_TYPE");
      expect(result.error[0]?.message).toContain("DateTime");
    });

    it("should specify missing usage (input/output) in error message (13.3)", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarInfo("DateTime", "DateTimeInput", "input"),
        createScalarInfo("URL", "URLOutput", "output"),
      ];
      const result = collectScalars(scalarInfos, []);

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Expected error");

      expect(result.error).toHaveLength(2);

      const dateTimeError = result.error.find((e) =>
        e.message.includes("DateTime"),
      );
      const urlError = result.error.find((e) => e.message.includes("URL"));

      expect(dateTimeError?.code).toBe("MISSING_OUTPUT_TYPE");
      expect(dateTimeError?.message).toContain("output");
      expect(urlError?.code).toBe("MISSING_INPUT_TYPE");
      expect(urlError?.message).toContain("input");
    });
  });

  describe("Edge cases", () => {
    it("should return empty array when no custom scalars are found", () => {
      const result = collectScalars([], []);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected success");

      expect(result.value).toHaveLength(0);
    });

    it("should collect scalars defined only in config file", () => {
      const configScalars: ConfigScalarMapping[] = [
        createConfigScalar("DateTime", "Date"),
      ];
      const result = collectScalars([], configScalars);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected success");

      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.scalarName).toBe("DateTime");
      expect(result.value[0]?.inputType?.typeName).toBe("Date");
      expect(result.value[0]?.outputTypes[0]?.typeName).toBe("Date");
    });

    it("should handle config scalar with only: 'output'", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarInfo("DateTime", "DateTimeInput", "input"),
      ];
      const configScalars: ConfigScalarMapping[] = [
        createConfigScalar("DateTime", "Date", "output"),
      ];
      const result = collectScalars(scalarInfos, configScalars);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected success");

      const scalar = result.value[0]!;
      expect(scalar.inputType?.typeName).toBe("DateTimeInput");
      expect(scalar.outputTypes).toHaveLength(1);
      expect(scalar.outputTypes[0]?.typeName).toBe("Date");
    });

    it("should handle config scalar with only: 'input'", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarInfo("DateTime", "DateTimeOutput", "output"),
      ];
      const configScalars: ConfigScalarMapping[] = [
        createConfigScalar("DateTime", "Date", "input"),
      ];
      const result = collectScalars(scalarInfos, configScalars);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected success");

      const scalar = result.value[0]!;
      expect(scalar.inputType?.typeName).toBe("Date");
      expect(scalar.outputTypes[0]?.typeName).toBe("DateTimeOutput");
    });

    it("should collect description from scalar metadata", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        {
          scalarName: "DateTime",
          typeName: "DateTime",
          only: null,
          sourceFile: "/test.ts",
          line: 1,
          description: "ISO 8601 date-time",
        },
      ];
      const result = collectScalars(scalarInfos, []);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected success");

      expect(result.value[0]?.descriptions).toHaveLength(1);
      expect(result.value[0]?.descriptions[0]?.text).toBe("ISO 8601 date-time");
    });

    it("should collect description from config scalar", () => {
      const configScalars: ConfigScalarMapping[] = [
        createConfigScalar(
          "DateTime",
          "Date",
          undefined,
          undefined,
          "Date and time",
        ),
      ];
      const result = collectScalars([], configScalars);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected success");

      expect(result.value[0]?.descriptions).toHaveLength(1);
      expect(result.value[0]?.descriptions[0]?.text).toBe("Date and time");
      expect(result.value[0]?.descriptions[0]?.fromConfig).toBe(true);
    });

    it("should sort scalars by name for deterministic output", () => {
      const scalarInfos: ScalarMetadataInfo[] = [
        createScalarInfo("URL", "URL"),
        createScalarInfo("DateTime", "DateTime"),
        createScalarInfo("Email", "Email"),
      ];
      const result = collectScalars(scalarInfos, []);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected success");

      expect(result.value[0]?.scalarName).toBe("DateTime");
      expect(result.value[1]?.scalarName).toBe("Email");
      expect(result.value[2]?.scalarName).toBe("URL");
    });
  });
});

describe("collectDescription", () => {
  describe("Task 6.2: Multiple description merging", () => {
    it("should return null when no descriptions are provided", () => {
      const result = collectDescription([]);
      expect(result).toBeNull();
    });

    it("should return single description as-is", () => {
      const sources: DescriptionSource[] = [
        {
          text: "ISO 8601 format datetime",
          sourceFile: "/src/types.ts",
          line: 10,
          fromConfig: false,
        },
      ];
      const result = collectDescription(sources);
      expect(result).toBe("ISO 8601 format datetime");
    });

    it("should merge multiple descriptions with blank line separator", () => {
      const sources: DescriptionSource[] = [
        {
          text: "First description",
          sourceFile: "/src/a.ts",
          line: 10,
          fromConfig: false,
        },
        {
          text: "Second description",
          sourceFile: "/src/b.ts",
          line: 20,
          fromConfig: false,
        },
      ];
      const result = collectDescription(sources);
      expect(result).toBe("First description\n\nSecond description");
    });

    it("should sort descriptions by file path alphabetically", () => {
      const sources: DescriptionSource[] = [
        {
          text: "From z.ts",
          sourceFile: "/src/z.ts",
          line: 10,
          fromConfig: false,
        },
        {
          text: "From a.ts",
          sourceFile: "/src/a.ts",
          line: 10,
          fromConfig: false,
        },
        {
          text: "From m.ts",
          sourceFile: "/src/m.ts",
          line: 10,
          fromConfig: false,
        },
      ];
      const result = collectDescription(sources);
      expect(result).toBe("From a.ts\n\nFrom m.ts\n\nFrom z.ts");
    });

    it("should maintain line order within the same file", () => {
      const sources: DescriptionSource[] = [
        {
          text: "Third in file",
          sourceFile: "/src/types.ts",
          line: 30,
          fromConfig: false,
        },
        {
          text: "First in file",
          sourceFile: "/src/types.ts",
          line: 10,
          fromConfig: false,
        },
        {
          text: "Second in file",
          sourceFile: "/src/types.ts",
          line: 20,
          fromConfig: false,
        },
      ];
      const result = collectDescription(sources);
      expect(result).toBe("First in file\n\nSecond in file\n\nThird in file");
    });

    it("should sort by file path first, then by line number", () => {
      const sources: DescriptionSource[] = [
        {
          text: "B file line 20",
          sourceFile: "/src/b.ts",
          line: 20,
          fromConfig: false,
        },
        {
          text: "A file line 30",
          sourceFile: "/src/a.ts",
          line: 30,
          fromConfig: false,
        },
        {
          text: "B file line 10",
          sourceFile: "/src/b.ts",
          line: 10,
          fromConfig: false,
        },
        {
          text: "A file line 10",
          sourceFile: "/src/a.ts",
          line: 10,
          fromConfig: false,
        },
      ];
      const result = collectDescription(sources);
      expect(result).toBe(
        "A file line 10\n\nA file line 30\n\nB file line 10\n\nB file line 20",
      );
    });

    it("should include config file descriptions", () => {
      const sources: DescriptionSource[] = [
        {
          text: "From source file",
          sourceFile: "/src/types.ts",
          line: 10,
          fromConfig: false,
        },
        {
          text: "From config file",
          sourceFile: null,
          line: null,
          fromConfig: true,
        },
      ];
      const result = collectDescription(sources);
      expect(result).toContain("From source file");
      expect(result).toContain("From config file");
    });

    it("should handle null source file in sorting", () => {
      const sources: DescriptionSource[] = [
        {
          text: "From config",
          sourceFile: null,
          line: null,
          fromConfig: true,
        },
        {
          text: "From source",
          sourceFile: "/src/types.ts",
          line: 10,
          fromConfig: false,
        },
      ];
      const result = collectDescription(sources);
      expect(result).not.toBeNull();
      expect(result).toContain("From config");
      expect(result).toContain("From source");
    });
  });
});
