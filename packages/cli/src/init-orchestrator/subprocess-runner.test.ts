import { existsSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCommand } from "./subprocess-runner.js";

function createTempDir(): string {
  const tempDir = join(
    tmpdir(),
    `gqlkit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(tempDir, { recursive: true });
  return realpathSync(tempDir);
}

describe("runCommand", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("successful execution", () => {
    it("executes command and returns success", async () => {
      const result = await runCommand({
        command: "echo",
        args: ["hello world"],
        cwd: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("hello world");
      expect(result.stderr).toBe("");
    });

    it("returns stdout from command", async () => {
      const result = await runCommand({
        command: "node",
        args: ["-e", 'console.log("test output")'],
        cwd: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe("test output");
    });

    it("returns stderr from command", async () => {
      const result = await runCommand({
        command: "node",
        args: ["-e", 'console.error("error output")'],
        cwd: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.stderr.trim()).toBe("error output");
    });
  });

  describe("failed execution", () => {
    it("returns success false when command exits with non-zero code", async () => {
      const result = await runCommand({
        command: "node",
        args: ["-e", "process.exit(1)"],
        cwd: tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    it("returns the actual exit code", async () => {
      const result = await runCommand({
        command: "node",
        args: ["-e", "process.exit(42)"],
        cwd: tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(42);
    });
  });

  describe("working directory", () => {
    it("executes command in specified working directory", async () => {
      const result = await runCommand({
        command: "pwd",
        args: [],
        cwd: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe(tempDir);
    });
  });
});
