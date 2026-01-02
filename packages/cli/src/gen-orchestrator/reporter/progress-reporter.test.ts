import { describe, expect, it } from "vitest";
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

      expect(output.length).toBe(1);
      expect(output[0]?.includes("Extracting types")).toBeTruthy();
    });

    it("should format phase name with prefix", () => {
      const output: string[] = [];
      const reporter = createProgressReporter({
        stdout: (msg: string) => output.push(msg),
        stderr: () => {},
      });

      reporter.startPhase("Extracting resolvers");

      expect(output[0]?.startsWith("  ")).toBeTruthy();
      expect(output[0]?.includes("Extracting resolvers")).toBeTruthy();
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

      expect(output.length).toBe(1);
      expect(
        output[0]?.includes("src/gqlkit/generated/schema.ts"),
      ).toBeTruthy();
    });

    it("should format file path with 'wrote' prefix", () => {
      const output: string[] = [];
      const reporter = createProgressReporter({
        stdout: (msg: string) => output.push(msg),
        stderr: () => {},
      });

      reporter.fileWritten("src/gqlkit/generated/resolvers.ts");

      expect(output[0]?.includes("wrote")).toBeTruthy();
      expect(
        output[0]?.includes("src/gqlkit/generated/resolvers.ts"),
      ).toBeTruthy();
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

      expect(output.length).toBe(1);
    });
  });
});
