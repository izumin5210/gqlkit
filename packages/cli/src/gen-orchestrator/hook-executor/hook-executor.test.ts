import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { executeHooks, type SingleHookResult } from "./hook-executor.js";

describe("HookExecutor", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hook-executor-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("executeHooks", () => {
    it("should execute a single command successfully", async () => {
      const testFile = path.join(tempDir, "test.txt");
      fs.writeFileSync(testFile, "original content");

      const result = await executeHooks({
        commands: ["node -e \"console.log('hello')\""],
        filePaths: [testFile],
        cwd: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.results.length).toBe(1);
      expect(result.results[0]?.success).toBe(true);
      expect(result.results[0]?.exitCode).toBe(0);
    });

    it("should execute multiple commands sequentially", async () => {
      const testFile = path.join(tempDir, "test.txt");
      fs.writeFileSync(testFile, "original");

      const results: string[] = [];
      const result = await executeHooks({
        commands: [
          "node -e \"console.log('first')\"",
          "node -e \"console.log('second')\"",
        ],
        filePaths: [testFile],
        cwd: tempDir,
        onHookComplete: (r) => results.push(r.command),
      });

      expect(result.success).toBe(true);
      expect(result.results.length).toBe(2);
      expect(results).toEqual([
        "node -e \"console.log('first')\"",
        "node -e \"console.log('second')\"",
      ]);
    });

    it("should pass file paths as arguments to command", async () => {
      const testFile1 = path.join(tempDir, "file1.txt");
      const testFile2 = path.join(tempDir, "file2.txt");
      fs.writeFileSync(testFile1, "content1");
      fs.writeFileSync(testFile2, "content2");

      const result = await executeHooks({
        commands: ["node -e \"console.log(process.argv.slice(1).join(' '))\""],
        filePaths: [testFile1, testFile2],
        cwd: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.results[0]?.stdout).toContain("file1.txt");
      expect(result.results[0]?.stdout).toContain("file2.txt");
    });

    it("should continue execution when a command fails", async () => {
      const testFile = path.join(tempDir, "test.txt");
      fs.writeFileSync(testFile, "content");

      const completedCommands: string[] = [];
      const result = await executeHooks({
        commands: [
          'node -e "process.exit(1)"',
          "node -e \"console.log('after-failure')\"",
        ],
        filePaths: [testFile],
        cwd: tempDir,
        onHookComplete: (r) => completedCommands.push(r.command),
      });

      expect(result.success).toBe(false);
      expect(result.results.length).toBe(2);
      expect(result.results[0]?.success).toBe(false);
      expect(result.results[0]?.exitCode).toBe(1);
      expect(result.results[1]?.success).toBe(true);
      expect(completedCommands.length).toBe(2);
    });

    it("should aggregate success status correctly", async () => {
      const testFile = path.join(tempDir, "test.txt");
      fs.writeFileSync(testFile, "content");

      const result = await executeHooks({
        commands: [
          "node -e \"console.log('success')\"",
          'node -e "process.exit(1)"',
          "node -e \"console.log('also success')\"",
        ],
        filePaths: [testFile],
        cwd: tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.results[0]?.success).toBe(true);
      expect(result.results[1]?.success).toBe(false);
      expect(result.results[2]?.success).toBe(true);
    });

    it("should use project root as working directory", async () => {
      const testFile = path.join(tempDir, "test.txt");
      fs.writeFileSync(testFile, "content");

      const result = await executeHooks({
        commands: ['node -e "console.log(process.cwd())"'],
        filePaths: [testFile],
        cwd: tempDir,
      });

      expect(result.success).toBe(true);
      const cwd = result.results[0]?.stdout.trim();
      expect(fs.realpathSync(cwd!)).toBe(fs.realpathSync(tempDir));
    });

    it("should handle command not found error", async () => {
      const testFile = path.join(tempDir, "test.txt");
      fs.writeFileSync(testFile, "content");

      const result = await executeHooks({
        commands: ["nonexistent-command-xyz-123"],
        filePaths: [testFile],
        cwd: tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.results[0]?.success).toBe(false);
      expect(result.results[0]?.exitCode).not.toBe(0);
    });

    it("should quote file paths with special characters", async () => {
      const testFileWithSpaces = path.join(tempDir, "file with spaces.txt");
      fs.writeFileSync(testFileWithSpaces, "content");

      const result = await executeHooks({
        commands: ["node -e \"console.log(process.argv.slice(1).join(' '))\""],
        filePaths: [testFileWithSpaces],
        cwd: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.results[0]?.stdout).toContain("file with spaces.txt");
    });

    it("should capture stdout and stderr", async () => {
      const testFile = path.join(tempDir, "test.txt");
      fs.writeFileSync(testFile, "content");

      const result = await executeHooks({
        commands: [
          "node -e \"console.log('stdout message')\"",
          "node -e \"console.error('error'); process.exit(1)\"",
        ],
        filePaths: [testFile],
        cwd: tempDir,
      });

      expect(result.results[0]?.stdout).toContain("stdout message");
      expect(result.results[1]?.stderr).toContain("error");
    });

    it("should call onHookComplete callback for each hook", async () => {
      const testFile = path.join(tempDir, "test.txt");
      fs.writeFileSync(testFile, "content");

      const hookResults: SingleHookResult[] = [];
      await executeHooks({
        commands: [
          "node -e \"console.log('first')\"",
          "node -e \"console.log('second')\"",
        ],
        filePaths: [testFile],
        cwd: tempDir,
        onHookComplete: (result) => hookResults.push(result),
      });

      expect(hookResults.length).toBe(2);
      expect(hookResults[0]?.command).toBe("node -e \"console.log('first')\"");
      expect(hookResults[1]?.command).toBe("node -e \"console.log('second')\"");
    });
  });
});
