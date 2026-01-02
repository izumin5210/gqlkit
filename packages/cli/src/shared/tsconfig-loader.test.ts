import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadTsconfig } from "./tsconfig-loader.js";

describe("TsconfigLoader", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tsconfig-loader-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true });
  });

  describe("loadTsconfig", () => {
    describe("auto-detection", () => {
      it("should find tsconfig.json in the current directory", () => {
        const tsconfigContent = JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            strict: true,
          },
        });
        fs.writeFileSync(path.join(tempDir, "tsconfig.json"), tsconfigContent);

        const result = loadTsconfig({ cwd: tempDir, tsconfigPath: null });

        expect(result.diagnostics.length).toBe(0);
        expect(result.configFilePath).toBe(path.join(tempDir, "tsconfig.json"));
        expect(result.compilerOptions).not.toBeNull();
        expect(result.compilerOptions?.strict).toBe(true);
      });

      it("should return null compilerOptions when tsconfig.json does not exist", () => {
        const result = loadTsconfig({ cwd: tempDir, tsconfigPath: null });

        expect(result.diagnostics.length).toBe(0);
        expect(result.configFilePath).toBeNull();
        expect(result.compilerOptions).toBeNull();
      });
    });

    describe("custom tsconfig path", () => {
      it("should load tsconfig from specified absolute path", () => {
        const tsconfigPath = path.join(tempDir, "custom-tsconfig.json");
        const tsconfigContent = JSON.stringify({
          compilerOptions: {
            target: "ES2020",
            strict: false,
          },
        });
        fs.writeFileSync(tsconfigPath, tsconfigContent);

        const result = loadTsconfig({ cwd: tempDir, tsconfigPath });

        expect(result.diagnostics.length).toBe(0);
        expect(result.configFilePath).toBe(tsconfigPath);
        expect(result.compilerOptions).not.toBeNull();
        expect(result.compilerOptions?.strict).toBe(false);
      });

      it("should load tsconfig from specified relative path", () => {
        const tsconfigPath = path.join(
          tempDir,
          "configs",
          "tsconfig.build.json",
        );
        fs.mkdirSync(path.join(tempDir, "configs"), { recursive: true });
        const tsconfigContent = JSON.stringify({
          compilerOptions: {
            target: "ES2021",
          },
        });
        fs.writeFileSync(tsconfigPath, tsconfigContent);

        const result = loadTsconfig({
          cwd: tempDir,
          tsconfigPath: "configs/tsconfig.build.json",
        });

        expect(result.diagnostics.length).toBe(0);
        expect(result.configFilePath).toBe(tsconfigPath);
        expect(result.compilerOptions).not.toBeNull();
      });

      it("should return error diagnostic when specified tsconfig does not exist", () => {
        const result = loadTsconfig({
          cwd: tempDir,
          tsconfigPath: "non-existent.json",
        });

        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("TSCONFIG_NOT_FOUND");
        expect(result.diagnostics[0]?.severity).toBe("error");
        expect(result.compilerOptions).toBeNull();
        expect(result.configFilePath).toBeNull();
      });
    });

    describe("extends resolution", () => {
      it("should resolve extends field and merge compilerOptions", () => {
        const baseTsconfigPath = path.join(tempDir, "tsconfig.base.json");
        fs.writeFileSync(
          baseTsconfigPath,
          JSON.stringify({
            compilerOptions: {
              target: "ES2022",
              strict: true,
              esModuleInterop: true,
            },
          }),
        );

        const tsconfigPath = path.join(tempDir, "tsconfig.json");
        fs.writeFileSync(
          tsconfigPath,
          JSON.stringify({
            extends: "./tsconfig.base.json",
            compilerOptions: {
              module: "NodeNext",
            },
          }),
        );

        const result = loadTsconfig({ cwd: tempDir, tsconfigPath: null });

        expect(result.diagnostics.length).toBe(0);
        expect(result.compilerOptions).not.toBeNull();
        expect(result.compilerOptions?.strict).toBe(true);
        expect(result.compilerOptions?.esModuleInterop).toBe(true);
      });
    });

    describe("error handling", () => {
      it("should return error diagnostic for invalid JSON", () => {
        const tsconfigPath = path.join(tempDir, "tsconfig.json");
        fs.writeFileSync(tsconfigPath, "{ invalid json }");

        const result = loadTsconfig({ cwd: tempDir, tsconfigPath: null });

        expect(result.diagnostics.length).toBeGreaterThan(0);
        expect(
          result.diagnostics.some((d) => d.code === "TSCONFIG_PARSE_ERROR"),
        ).toBe(true);
        expect(result.compilerOptions).toBeNull();
      });

      it("should return error diagnostic for invalid compilerOptions", () => {
        const tsconfigPath = path.join(tempDir, "tsconfig.json");
        fs.writeFileSync(
          tsconfigPath,
          JSON.stringify({
            compilerOptions: {
              target: "INVALID_TARGET",
            },
          }),
        );

        const result = loadTsconfig({ cwd: tempDir, tsconfigPath: null });

        expect(result.diagnostics.length).toBeGreaterThan(0);
        expect(
          result.diagnostics.some((d) => d.code === "TSCONFIG_INVALID"),
        ).toBe(true);
      });
    });
  });
});
