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

  describe("hook reporting methods", () => {
    it("should report hookFailed with error details", () => {
      const writer = createMockWriter();
      const reporter = createProgressReporter(writer);

      reporter.hookFailed("eslint --fix", 1, "Error: something went wrong");

      expect(writer.stderrCalls.length).toBeGreaterThan(0);
      expect(writer.stderrCalls.join("\n")).toContain("eslint --fix");
      expect(writer.stderrCalls.join("\n")).toContain("1");
    });

    it("should report hookFailed with a string errno code (e.g. spawn failure)", () => {
      const writer = createMockWriter();
      const reporter = createProgressReporter(writer);

      reporter.hookFailed("eslint --fix", "ENOENT", "");

      expect(writer.stderrCalls.length).toBeGreaterThan(0);
      expect(writer.stderrCalls.join("\n")).toContain("eslint --fix");
      expect(writer.stderrCalls.join("\n")).toContain("ENOENT");
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

  describe("typesPruned", () => {
    it("should report the count and names of pruned types", () => {
      const writer = createMockWriter();
      const reporter = createProgressReporter(writer);

      reporter.typesPruned(["AuditLog", "Orphan"]);

      expect(writer.stdoutCalls.length).toBe(1);
      expect(writer.stdoutCalls[0]).toContain("2");
      expect(writer.stdoutCalls[0]).toContain("AuditLog, Orphan");
    });
  });
});
