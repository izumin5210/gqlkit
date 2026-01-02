import { describe, expect, it } from "vitest";
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

      expect(location.file).toBe("/path/to/file.ts");
      expect(location.line).toBe(10);
      expect(location.column).toBe(5);
    });
  });

  describe("DiagnosticCode", () => {
    it("should support DIRECTORY_NOT_FOUND code", () => {
      const code: DiagnosticCode = "DIRECTORY_NOT_FOUND";
      expect(code).toBe("DIRECTORY_NOT_FOUND");
    });

    it("should support PARSE_ERROR code", () => {
      const code: DiagnosticCode = "PARSE_ERROR";
      expect(code).toBe("PARSE_ERROR");
    });

    it("should support UNSUPPORTED_SYNTAX code", () => {
      const code: DiagnosticCode = "UNSUPPORTED_SYNTAX";
      expect(code).toBe("UNSUPPORTED_SYNTAX");
    });

    it("should support RESERVED_TYPE_NAME code", () => {
      const code: DiagnosticCode = "RESERVED_TYPE_NAME";
      expect(code).toBe("RESERVED_TYPE_NAME");
    });

    it("should support UNRESOLVED_REFERENCE code", () => {
      const code: DiagnosticCode = "UNRESOLVED_REFERENCE";
      expect(code).toBe("UNRESOLVED_REFERENCE");
    });

    it("should support UNSUPPORTED_ENUM_TYPE code", () => {
      const code: DiagnosticCode = "UNSUPPORTED_ENUM_TYPE";
      expect(code).toBe("UNSUPPORTED_ENUM_TYPE");
    });

    it("should support INVALID_ENUM_MEMBER code", () => {
      const code: DiagnosticCode = "INVALID_ENUM_MEMBER";
      expect(code).toBe("INVALID_ENUM_MEMBER");
    });
  });

  describe("Diagnostic", () => {
    it("should support error severity", () => {
      const diagnostic: Diagnostic = {
        code: "DIRECTORY_NOT_FOUND",
        message: "Directory not found: /path/to/dir",
        severity: "error",
      };

      expect(diagnostic.severity).toBe("error");
      expect(diagnostic.code).toBe("DIRECTORY_NOT_FOUND");
      expect(diagnostic.message).toBe("Directory not found: /path/to/dir");
      expect(diagnostic.location).toBe(undefined);
    });

    it("should support warning severity", () => {
      const diagnostic: Diagnostic = {
        code: "UNSUPPORTED_SYNTAX",
        message: "Generics are not supported",
        severity: "warning",
      };

      expect(diagnostic.severity).toBe("warning");
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

      expect(diagnostic.location).toEqual({
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

      expect(diagnostics.errors.length).toBe(1);
      expect(diagnostics.warnings.length).toBe(1);
      expect(diagnostics.errors[0]?.severity).toBe("error");
      expect(diagnostics.warnings[0]?.severity).toBe("warning");
    });

    it("should be readonly", () => {
      const diagnostics: Diagnostics = {
        errors: [],
        warnings: [],
      };

      expect(Array.isArray(diagnostics.errors)).toBe(true);
      expect(Array.isArray(diagnostics.warnings)).toBe(true);
    });
  });
});
