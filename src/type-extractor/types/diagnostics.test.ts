import assert from "node:assert";
import { describe, it } from "node:test";
import type {
  Diagnostic,
  DiagnosticCode,
  Diagnostics,
  SourceLocation,
} from "./diagnostics.js";

describe("Diagnostics types", () => {
  describe("SourceLocation", () => {
    it("should have file, line, and column properties", () => {
      const location: SourceLocation = {
        file: "/path/to/file.ts",
        line: 10,
        column: 5,
      };

      assert.strictEqual(location.file, "/path/to/file.ts");
      assert.strictEqual(location.line, 10);
      assert.strictEqual(location.column, 5);
    });
  });

  describe("DiagnosticCode", () => {
    it("should support DIRECTORY_NOT_FOUND code", () => {
      const code: DiagnosticCode = "DIRECTORY_NOT_FOUND";
      assert.strictEqual(code, "DIRECTORY_NOT_FOUND");
    });

    it("should support PARSE_ERROR code", () => {
      const code: DiagnosticCode = "PARSE_ERROR";
      assert.strictEqual(code, "PARSE_ERROR");
    });

    it("should support UNSUPPORTED_SYNTAX code", () => {
      const code: DiagnosticCode = "UNSUPPORTED_SYNTAX";
      assert.strictEqual(code, "UNSUPPORTED_SYNTAX");
    });

    it("should support RESERVED_TYPE_NAME code", () => {
      const code: DiagnosticCode = "RESERVED_TYPE_NAME";
      assert.strictEqual(code, "RESERVED_TYPE_NAME");
    });

    it("should support UNRESOLVED_REFERENCE code", () => {
      const code: DiagnosticCode = "UNRESOLVED_REFERENCE";
      assert.strictEqual(code, "UNRESOLVED_REFERENCE");
    });
  });

  describe("Diagnostic", () => {
    it("should support error severity", () => {
      const diagnostic: Diagnostic = {
        code: "DIRECTORY_NOT_FOUND",
        message: "Directory not found: /path/to/dir",
        severity: "error",
      };

      assert.strictEqual(diagnostic.severity, "error");
      assert.strictEqual(diagnostic.code, "DIRECTORY_NOT_FOUND");
      assert.strictEqual(
        diagnostic.message,
        "Directory not found: /path/to/dir",
      );
      assert.strictEqual(diagnostic.location, undefined);
    });

    it("should support warning severity", () => {
      const diagnostic: Diagnostic = {
        code: "UNSUPPORTED_SYNTAX",
        message: "Generics are not supported",
        severity: "warning",
      };

      assert.strictEqual(diagnostic.severity, "warning");
    });

    it("should support optional location", () => {
      const diagnostic: Diagnostic = {
        code: "PARSE_ERROR",
        message: "Unexpected token",
        severity: "error",
        location: {
          file: "/path/to/file.ts",
          line: 10,
          column: 5,
        },
      };

      assert.deepStrictEqual(diagnostic.location, {
        file: "/path/to/file.ts",
        line: 10,
        column: 5,
      });
    });
  });

  describe("Diagnostics", () => {
    it("should separate errors and warnings", () => {
      const diagnostics: Diagnostics = {
        errors: [
          {
            code: "DIRECTORY_NOT_FOUND",
            message: "Directory not found",
            severity: "error",
          },
        ],
        warnings: [
          {
            code: "UNSUPPORTED_SYNTAX",
            message: "Unsupported syntax",
            severity: "warning",
          },
        ],
      };

      assert.strictEqual(diagnostics.errors.length, 1);
      assert.strictEqual(diagnostics.warnings.length, 1);
      assert.strictEqual(diagnostics.errors[0]?.severity, "error");
      assert.strictEqual(diagnostics.warnings[0]?.severity, "warning");
    });

    it("should be readonly", () => {
      const diagnostics: Diagnostics = {
        errors: [],
        warnings: [],
      };

      assert.ok(Array.isArray(diagnostics.errors));
      assert.ok(Array.isArray(diagnostics.warnings));
    });
  });
});
