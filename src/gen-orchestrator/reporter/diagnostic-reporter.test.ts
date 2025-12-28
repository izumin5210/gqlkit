import assert from "node:assert";
import { describe, it } from "node:test";
import type { Diagnostic } from "../../type-extractor/index.js";
import {
  createDiagnosticReporter,
  type DiagnosticReporter,
} from "./diagnostic-reporter.js";

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

      assert.strictEqual(stderr.length, 1);
      assert.ok(stderr[0]?.includes("error"));
      assert.ok(stderr[0]?.includes("DIRECTORY_NOT_FOUND"));
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

      assert.strictEqual(stdout.length, 1);
      assert.ok(stdout[0]?.includes("warning"));
      assert.ok(stdout[0]?.includes("UNSUPPORTED_SYNTAX"));
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

      assert.ok(stderr[0]?.includes("src/gql/types/user.ts"));
      assert.ok(stderr[0]?.includes("10"));
      assert.ok(stderr[0]?.includes("5"));
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

      assert.ok(stderr[0]?.includes("[UNRESOLVED_REFERENCE]"));
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

      assert.strictEqual(stderr.length, 2);
      assert.strictEqual(stdout.length, 1);
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

      assert.strictEqual(stderr.length, 1);
      assert.ok(stderr[0]?.includes("Something went wrong"));
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

      assert.strictEqual(stdout.length, 1);
      assert.ok(stdout[0]?.includes("Generation complete"));
    });
  });
});
