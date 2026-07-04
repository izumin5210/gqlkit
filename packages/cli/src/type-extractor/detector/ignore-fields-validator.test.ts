/**
 * Tests for ignoreFields validation.
 *
 * Most scenarios are covered by golden file tests in testdata/:
 * - ignore-fields-single-field/: Valid single field
 * - ignore-fields-with-implements/: Valid multiple fields
 * - ignore-fields-error-unknown-field/: Single unknown field error
 * - ignore-fields-error-multiple-unknown/: Multiple unknown fields error
 * - ignore-fields-error-partial-invalid/: Mixed valid/invalid fields
 * - ignore-fields-error-all-fields/: All fields excluded error
 * - ignore-fields-error-combined/: Combined error types
 *
 * This file only contains tests for edge cases not suitable for golden tests.
 */

import { describe, expect, it } from "vitest";
import { validateIgnoreFields } from "./ignore-fields-validator.js";

const defaultSourceLocation = {
  file: "test.ts",
  line: 1,
  column: 1,
};

describe("validateIgnoreFields", () => {
  describe("edge cases", () => {
    it("handles empty ignoreFields set (defensive programming)", () => {
      const diagnostics = validateIgnoreFields({
        typeName: "User",
        ignoreFields: new Set(),
        allFieldNames: new Set(["id", "name"]),
        sourceLocation: defaultSourceLocation,
      });

      expect(diagnostics).toHaveLength(0);
    });
  });
});
