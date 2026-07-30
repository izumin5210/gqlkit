import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectPackageManager } from "./package-manager-detector.js";

function createTempDir(): string {
  const tempDir = join(
    tmpdir(),
    `gqlkit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

describe("detectPackageManager", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("packageManager field detection", () => {
    it("detects npm from packageManager field", async () => {
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({ name: "test", packageManager: "npm@10.0.0" }),
      );

      const result = await detectPackageManager({ projectDir: tempDir });

      expect(result.packageManager).toBe("npm");
      expect(result.source).toBe("packageManager");
    });

    it("detects yarn from packageManager field", async () => {
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({ name: "test", packageManager: "yarn@4.0.0" }),
      );

      const result = await detectPackageManager({ projectDir: tempDir });

      expect(result.packageManager).toBe("yarn");
      expect(result.source).toBe("packageManager");
    });

    it("detects pnpm from packageManager field", async () => {
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({ name: "test", packageManager: "pnpm@9.0.0" }),
      );

      const result = await detectPackageManager({ projectDir: tempDir });

      expect(result.packageManager).toBe("pnpm");
      expect(result.source).toBe("packageManager");
    });
  });

  describe("lockfile detection", () => {
    it("detects npm from package-lock.json", async () => {
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({ name: "test" }),
      );
      writeFileSync(join(tempDir, "package-lock.json"), "{}");

      const result = await detectPackageManager({ projectDir: tempDir });

      expect(result.packageManager).toBe("npm");
      expect(result.source).toBe("lockfile");
    });

    it("detects yarn from yarn.lock", async () => {
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({ name: "test" }),
      );
      writeFileSync(join(tempDir, "yarn.lock"), "");

      const result = await detectPackageManager({ projectDir: tempDir });

      expect(result.packageManager).toBe("yarn");
      expect(result.source).toBe("lockfile");
    });

    it("detects pnpm from pnpm-lock.yaml", async () => {
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({ name: "test" }),
      );
      writeFileSync(join(tempDir, "pnpm-lock.yaml"), "");

      const result = await detectPackageManager({ projectDir: tempDir });

      expect(result.packageManager).toBe("pnpm");
      expect(result.source).toBe("lockfile");
    });
  });

  describe("priority", () => {
    it("prefers packageManager field over lockfile", async () => {
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({ name: "test", packageManager: "pnpm@9.0.0" }),
      );
      writeFileSync(join(tempDir, "yarn.lock"), "");

      const result = await detectPackageManager({ projectDir: tempDir });

      expect(result.packageManager).toBe("pnpm");
      expect(result.source).toBe("packageManager");
    });
  });

  describe("no detection", () => {
    it("returns null when no package manager can be detected", async () => {
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({ name: "test" }),
      );

      const result = await detectPackageManager({ projectDir: tempDir });

      expect(result.packageManager).toBeNull();
      expect(result.source).toBeNull();
    });

    it("returns null when package.json does not exist", async () => {
      const result = await detectPackageManager({ projectDir: tempDir });

      expect(result.packageManager).toBeNull();
      expect(result.source).toBeNull();
    });
  });
});
