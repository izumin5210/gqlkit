import assert from "node:assert";
import { describe, it } from "node:test";
import { createProgressReporter } from "./progress-reporter.js";

describe("ProgressReporter", () => {
  describe("startPhase", () => {
    it("should output phase name to stdout", () => {
      const output: string[] = [];
      const reporter = createProgressReporter({
        stdout: (msg: string) => output.push(msg),
        stderr: () => {},
      });

      reporter.startPhase("Extracting types");

      assert.strictEqual(output.length, 1);
      assert.ok(output[0]?.includes("Extracting types"));
    });

    it("should format phase name with prefix", () => {
      const output: string[] = [];
      const reporter = createProgressReporter({
        stdout: (msg: string) => output.push(msg),
        stderr: () => {},
      });

      reporter.startPhase("Extracting resolvers");

      assert.ok(output[0]?.startsWith("  "));
      assert.ok(output[0]?.includes("Extracting resolvers"));
    });
  });

  describe("fileWritten", () => {
    it("should output file path to stdout", () => {
      const output: string[] = [];
      const reporter = createProgressReporter({
        stdout: (msg: string) => output.push(msg),
        stderr: () => {},
      });

      reporter.fileWritten("src/gqlkit/generated/schema.ts");

      assert.strictEqual(output.length, 1);
      assert.ok(output[0]?.includes("src/gqlkit/generated/schema.ts"));
    });

    it("should format file path with 'wrote' prefix", () => {
      const output: string[] = [];
      const reporter = createProgressReporter({
        stdout: (msg: string) => output.push(msg),
        stderr: () => {},
      });

      reporter.fileWritten("src/gqlkit/generated/resolvers.ts");

      assert.ok(output[0]?.includes("wrote"));
      assert.ok(output[0]?.includes("src/gqlkit/generated/resolvers.ts"));
    });
  });

  describe("complete", () => {
    it("should output completion message to stdout", () => {
      const output: string[] = [];
      const reporter = createProgressReporter({
        stdout: (msg: string) => output.push(msg),
        stderr: () => {},
      });

      reporter.complete();

      assert.strictEqual(output.length, 1);
    });
  });
});
