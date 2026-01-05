import { describe, expect, it } from "vitest";
import {
  createProgressReporter,
  type OutputWriter,
} from "./progress-reporter.js";

describe("ProgressReporter", () => {
  function createMockWriter(): OutputWriter & {
    stdoutCalls: string[];
    stderrCalls: string[];
  } {
    const stdoutCalls: string[] = [];
    const stderrCalls: string[] = [];
    return {
      stdout: (msg: string) => stdoutCalls.push(msg),
      stderr: (msg: string) => stderrCalls.push(msg),
      stdoutCalls,
      stderrCalls,
    };
  }

  describe("existing methods", () => {
    it("should report startPhase", () => {
      const writer = createMockWriter();
      const reporter = createProgressReporter(writer);

      reporter.startPhase("Generating");

      expect(writer.stdoutCalls).toContain("  Generating...");
    });

    it("should report fileWritten", () => {
      const writer = createMockWriter();
      const reporter = createProgressReporter(writer);

      reporter.fileWritten("/path/to/file.ts");

      expect(writer.stdoutCalls).toContain("    wrote /path/to/file.ts");
    });

    it("should report complete", () => {
      const writer = createMockWriter();
      const reporter = createProgressReporter(writer);

      reporter.complete();

      expect(writer.stdoutCalls).toContain("  Done!");
    });
  });

  describe("hook reporting methods", () => {
    it("should report startHookPhase", () => {
      const writer = createMockWriter();
      const reporter = createProgressReporter(writer);

      reporter.startHookPhase();

      expect(writer.stdoutCalls.length).toBe(1);
      expect(writer.stdoutCalls[0]).toContain("hook");
    });

    it("should report hookCompleted successfully", () => {
      const writer = createMockWriter();
      const reporter = createProgressReporter(writer);

      reporter.hookCompleted("prettier --write");

      expect(writer.stdoutCalls.length).toBe(1);
      expect(writer.stdoutCalls[0]).toContain("prettier --write");
    });

    it("should report hookFailed with error details", () => {
      const writer = createMockWriter();
      const reporter = createProgressReporter(writer);

      reporter.hookFailed("eslint --fix", 1, "Error: something went wrong");

      expect(writer.stderrCalls.length).toBeGreaterThan(0);
      expect(writer.stderrCalls.join("\n")).toContain("eslint --fix");
      expect(writer.stderrCalls.join("\n")).toContain("1");
    });

    it("should report hookPhaseSummary for all success", () => {
      const writer = createMockWriter();
      const reporter = createProgressReporter(writer);

      reporter.hookPhaseSummary(3, 0);

      expect(writer.stdoutCalls.length).toBe(1);
      expect(writer.stdoutCalls[0]).toContain("3");
    });

    it("should report hookPhaseSummary with failures", () => {
      const writer = createMockWriter();
      const reporter = createProgressReporter(writer);

      reporter.hookPhaseSummary(3, 1);

      const allOutput = [...writer.stdoutCalls, ...writer.stderrCalls].join(
        "\n",
      );
      expect(allOutput).toContain("1");
      expect(allOutput).toContain("failed");
    });
  });
});
