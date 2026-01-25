/**
 * Tests for ignoreFields validation.
 */

import { describe, expect, it } from "vitest";
import type { Diagnostic } from "../type-extractor/types/diagnostics.js";
import { validateIgnoreFields } from "./ignore-fields-validator.js";

const defaultSourceLocation = {
  file: "test.ts",
  line: 1,
  column: 1,
};

describe("validateIgnoreFields", () => {
  describe("when all specified fields exist in the type", () => {
    it("returns isValid true with no diagnostics for single field", () => {
      const result = validateIgnoreFields({
        typeName: "User",
        ignoreFields: new Set(["internalId"]),
        allFieldNames: new Set(["id", "name", "internalId"]),
        sourceLocation: defaultSourceLocation,
      });

      expect(result.isValid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it("returns isValid true with no diagnostics for multiple fields", () => {
      const result = validateIgnoreFields({
        typeName: "User",
        ignoreFields: new Set(["internalId", "cacheKey"]),
        allFieldNames: new Set(["id", "name", "internalId", "cacheKey"]),
        sourceLocation: defaultSourceLocation,
      });

      expect(result.isValid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });
  });

  describe("when specified field does not exist in the type", () => {
    it("returns IGNORE_FIELD_NOT_FOUND error for unknown field", () => {
      const result = validateIgnoreFields({
        typeName: "User",
        ignoreFields: new Set(["nonExistentField"]),
        allFieldNames: new Set(["id", "name"]),
        sourceLocation: defaultSourceLocation,
      });

      expect(result.isValid).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "IGNORE_FIELD_NOT_FOUND",
        severity: "error",
        location: defaultSourceLocation,
      });
      expect(result.diagnostics[0]?.message).toContain("User");
      expect(result.diagnostics[0]?.message).toContain("nonExistentField");
      expect(result.diagnostics[0]?.message).toContain("id");
      expect(result.diagnostics[0]?.message).toContain("name");
    });

    it("returns IGNORE_FIELD_NOT_FOUND error for each unknown field when multiple are invalid", () => {
      const result = validateIgnoreFields({
        typeName: "User",
        ignoreFields: new Set(["unknown1", "unknown2"]),
        allFieldNames: new Set(["id", "name"]),
        sourceLocation: defaultSourceLocation,
      });

      expect(result.isValid).toBe(false);
      expect(result.diagnostics).toHaveLength(2);
      expect(
        result.diagnostics.every(
          (d: Diagnostic) => d.code === "IGNORE_FIELD_NOT_FOUND",
        ),
      ).toBe(true);
    });

    it("includes available field names sorted alphabetically in error message", () => {
      const result = validateIgnoreFields({
        typeName: "User",
        ignoreFields: new Set(["unknown"]),
        allFieldNames: new Set(["zebra", "apple", "middle"]),
        sourceLocation: defaultSourceLocation,
      });

      expect(result.diagnostics[0]?.message).toMatch(/apple.*middle.*zebra/);
    });
  });

  describe("when some fields exist and some do not", () => {
    it("returns errors only for non-existent fields", () => {
      const result = validateIgnoreFields({
        typeName: "User",
        ignoreFields: new Set(["internalId", "nonExistent"]),
        allFieldNames: new Set(["id", "name", "internalId"]),
        sourceLocation: defaultSourceLocation,
      });

      expect(result.isValid).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.code).toBe("IGNORE_FIELD_NOT_FOUND");
      expect(result.diagnostics[0]?.message).toContain("nonExistent");
    });
  });

  describe("when all fields would be excluded", () => {
    it("returns IGNORE_ALL_FIELDS error", () => {
      const result = validateIgnoreFields({
        typeName: "User",
        ignoreFields: new Set(["id", "name"]),
        allFieldNames: new Set(["id", "name"]),
        sourceLocation: defaultSourceLocation,
      });

      expect(result.isValid).toBe(false);
      expect(
        result.diagnostics.some(
          (d: Diagnostic) => d.code === "IGNORE_ALL_FIELDS",
        ),
      ).toBe(true);
      const allFieldsError = result.diagnostics.find(
        (d: Diagnostic) => d.code === "IGNORE_ALL_FIELDS",
      );
      expect(allFieldsError?.message).toContain("User");
      expect(allFieldsError?.message).toContain(
        "At least one field must remain",
      );
      expect(allFieldsError?.severity).toBe("error");
    });
  });

  describe("when both unknown field and all fields excluded errors occur", () => {
    it("returns both error types", () => {
      const result = validateIgnoreFields({
        typeName: "User",
        ignoreFields: new Set(["id", "unknown"]),
        allFieldNames: new Set(["id"]),
        sourceLocation: defaultSourceLocation,
      });

      expect(result.isValid).toBe(false);
      expect(
        result.diagnostics.some(
          (d: Diagnostic) => d.code === "IGNORE_FIELD_NOT_FOUND",
        ),
      ).toBe(true);
      expect(
        result.diagnostics.some(
          (d: Diagnostic) => d.code === "IGNORE_ALL_FIELDS",
        ),
      ).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles empty ignoreFields set (should not be called in practice)", () => {
      const result = validateIgnoreFields({
        typeName: "User",
        ignoreFields: new Set(),
        allFieldNames: new Set(["id", "name"]),
        sourceLocation: defaultSourceLocation,
      });

      expect(result.isValid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it("uses provided source location in diagnostics", () => {
      const customLocation = {
        file: "/path/to/schema.ts",
        line: 42,
        column: 10,
      };
      const result = validateIgnoreFields({
        typeName: "User",
        ignoreFields: new Set(["unknown"]),
        allFieldNames: new Set(["id"]),
        sourceLocation: customLocation,
      });

      expect(result.diagnostics[0]?.location).toEqual(customLocation);
    });
  });
});
