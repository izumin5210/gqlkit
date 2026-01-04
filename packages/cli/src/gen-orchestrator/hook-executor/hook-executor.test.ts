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
        commands: ["echo 'hello'"],
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
        commands: ["echo 'first'", "echo 'second'"],
        filePaths: [testFile],
        cwd: tempDir,
        onHookComplete: (r) => results.push(r.command),
      });

      expect(result.success).toBe(true);
      expect(result.results.length).toBe(2);
      expect(results).toEqual(["echo 'first'", "echo 'second'"]);
    });

    it("should pass file paths as arguments to command", async () => {
      const testFile1 = path.join(tempDir, "file1.txt");
      const testFile2 = path.join(tempDir, "file2.txt");
      fs.writeFileSync(testFile1, "content1");
      fs.writeFileSync(testFile2, "content2");

      const outputFile = path.join(tempDir, "output.txt");
      const result = await executeHooks({
        commands: [`sh -c 'echo "$@" > ${outputFile}' --`],
        filePaths: [testFile1, testFile2],
        cwd: tempDir,
      });

      expect(result.success).toBe(true);
      const output = fs.readFileSync(outputFile, "utf-8").trim();
      expect(output).toContain(testFile1);
      expect(output).toContain(testFile2);
    });

    it("should continue execution when a command fails", async () => {
      const testFile = path.join(tempDir, "test.txt");
      fs.writeFileSync(testFile, "content");

      const completedCommands: string[] = [];
      const result = await executeHooks({
        commands: ["exit 1", "echo 'after-failure'"],
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
        commands: ["echo 'success'", "exit 1", "echo 'also success'"],
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
      const pwdFile = path.join(tempDir, "pwd.txt");

      const result = await executeHooks({
        commands: [`sh -c 'pwd > ${pwdFile}'`],
        filePaths: [testFile],
        cwd: tempDir,
      });

      expect(result.success).toBe(true);
      const pwd = fs.readFileSync(pwdFile, "utf-8").trim();
      expect(fs.realpathSync(pwd)).toBe(fs.realpathSync(tempDir));
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
      const outputFile = path.join(tempDir, "output.txt");

      const result = await executeHooks({
        commands: [`sh -c 'echo "$@" > ${outputFile}' --`],
        filePaths: [testFileWithSpaces],
        cwd: tempDir,
      });

      expect(result.success).toBe(true);
      const output = fs.readFileSync(outputFile, "utf-8").trim();
      expect(output).toContain("file with spaces.txt");
    });

    it("should capture stdout and stderr", async () => {
      const testFile = path.join(tempDir, "test.txt");
      fs.writeFileSync(testFile, "content");

      const result = await executeHooks({
        commands: ["echo 'stdout message'", "sh -c 'echo error >&2 && exit 1'"],
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
        commands: ["echo 'first'", "echo 'second'"],
        filePaths: [testFile],
        cwd: tempDir,
        onHookComplete: (result) => hookResults.push(result),
      });

      expect(hookResults.length).toBe(2);
      expect(hookResults[0]?.command).toBe("echo 'first'");
      expect(hookResults[1]?.command).toBe("echo 'second'");
    });
  });
});
