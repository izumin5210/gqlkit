import { describe, expect, it } from "vitest";
import type { Diagnostic } from "../../type-extractor/index.js";
import { createDiagnosticReporter } from "./diagnostic-reporter.js";

describe("DiagnosticReporter", () => {
  describe("reportDiagnostics", () => {
    it("should output error diagnostics to stderr", () => {
      const stderr: string[] = [];
      const reporter = createDiagnosticReporter({
        stdout: () => {},
        stderr: (msg: string) => stderr.push(msg),
      });

      const diagnostics: Diagnostic[] = [
        {
          code: "DIRECTORY_NOT_FOUND",
          message: "src/gql/types not found",
          severity: "error",
        },
      ];

      reporter.reportDiagnostics(diagnostics);

      expect(stderr.length).toBe(1);
      expect(stderr[0]?.includes("error")).toBeTruthy();
      expect(stderr[0]?.includes("DIRECTORY_NOT_FOUND")).toBeTruthy();
    });

    it("should output warning diagnostics to stdout", () => {
      const stdout: string[] = [];
      const reporter = createDiagnosticReporter({
        stdout: (msg: string) => stdout.push(msg),
        stderr: () => {},
      });

      const diagnostics: Diagnostic[] = [
        {
          code: "UNSUPPORTED_SYNTAX",
          message: "Unsupported syntax",
          severity: "warning",
        },
      ];

      reporter.reportDiagnostics(diagnostics);

      expect(stdout.length).toBe(1);
      expect(stdout[0]?.includes("warning")).toBeTruthy();
      expect(stdout[0]?.includes("UNSUPPORTED_SYNTAX")).toBeTruthy();
    });

    it("should include location info when present", () => {
      const stderr: string[] = [];
      const reporter = createDiagnosticReporter({
        stdout: () => {},
        stderr: (msg: string) => stderr.push(msg),
      });

      const diagnostics: Diagnostic[] = [
        {
          code: "PARSE_ERROR",
          message: "Parse error",
          severity: "error",
          location: { file: "src/gql/types/user.ts", line: 10, column: 5 },
        },
      ];

      reporter.reportDiagnostics(diagnostics);

      expect(stderr[0]?.includes("src/gql/types/user.ts")).toBeTruthy();
      expect(stderr[0]?.includes("10")).toBeTruthy();
      expect(stderr[0]?.includes("5")).toBeTruthy();
    });

    it("should format diagnostics with code in brackets", () => {
      const stderr: string[] = [];
      const reporter = createDiagnosticReporter({
        stdout: () => {},
        stderr: (msg: string) => stderr.push(msg),
      });

      const diagnostics: Diagnostic[] = [
        {
          code: "UNRESOLVED_REFERENCE",
          message: "Type 'Foo' not found",
          severity: "error",
        },
      ];

      reporter.reportDiagnostics(diagnostics);

      expect(stderr[0]?.includes("[UNRESOLVED_REFERENCE]")).toBeTruthy();
    });

    it("should report multiple diagnostics", () => {
      const stderr: string[] = [];
      const stdout: string[] = [];
      const reporter = createDiagnosticReporter({
        stdout: (msg: string) => stdout.push(msg),
        stderr: (msg: string) => stderr.push(msg),
      });

      const diagnostics: Diagnostic[] = [
        {
          code: "DIRECTORY_NOT_FOUND",
          message: "dir not found",
          severity: "error",
        },
        {
          code: "UNSUPPORTED_SYNTAX",
          message: "unsupported",
          severity: "warning",
        },
        {
          code: "PARSE_ERROR",
          message: "parse error",
          severity: "error",
        },
      ];

      reporter.reportDiagnostics(diagnostics);

      expect(stderr.length).toBe(2);
      expect(stdout.length).toBe(1);
    });
  });

  describe("reportError", () => {
    it("should output error message to stderr", () => {
      const stderr: string[] = [];
      const reporter = createDiagnosticReporter({
        stdout: () => {},
        stderr: (msg: string) => stderr.push(msg),
      });

      reporter.reportError("Something went wrong");

      expect(stderr.length).toBe(1);
      expect(stderr[0]?.includes("Something went wrong")).toBeTruthy();
    });
  });

  describe("reportSuccess", () => {
    it("should output success message to stdout", () => {
      const stdout: string[] = [];
      const reporter = createDiagnosticReporter({
        stdout: (msg: string) => stdout.push(msg),
        stderr: () => {},
      });

      reporter.reportSuccess("Generation complete");

      expect(stdout.length).toBe(1);
      expect(stdout[0]?.includes("Generation complete")).toBeTruthy();
    });
  });
});
