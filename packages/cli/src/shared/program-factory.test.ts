import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSharedProgram } from "./program-factory.js";

describe("ProgramFactory", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "program-factory-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true });
  });

  describe("createSharedProgram", () => {
    it("should create a Program instance from source files", () => {
      const typesDir = path.join(tempDir, "types");
      const resolversDir = path.join(tempDir, "resolvers");
      fs.mkdirSync(typesDir, { recursive: true });
      fs.mkdirSync(resolversDir, { recursive: true });

      fs.writeFileSync(
        path.join(typesDir, "user.ts"),
        "export interface User { id: string; name: string; }",
      );
      fs.writeFileSync(
        path.join(resolversDir, "query.ts"),
        "export const getUser = () => ({ id: '1', name: 'test' });",
      );

      const result = createSharedProgram({
        cwd: tempDir,
        tsconfigPath: null,
        typeFiles: [path.join(typesDir, "user.ts")],
        resolverFiles: [path.join(resolversDir, "query.ts")],
      });

      expect(result.diagnostics.length).toBe(0);
      expect(result.program).not.toBeNull();
      expect(result.program?.getSourceFiles().length).toBeGreaterThan(0);
    });

    it("should use compilerOptions from tsconfig.json when available", () => {
      const tsconfigPath = path.join(tempDir, "tsconfig.json");
      fs.writeFileSync(
        tsconfigPath,
        JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            strict: true,
          },
        }),
      );

      const typeFile = path.join(tempDir, "user.ts");
      fs.writeFileSync(typeFile, "export interface User { id: string; }");

      const result = createSharedProgram({
        cwd: tempDir,
        tsconfigPath: null,
        typeFiles: [typeFile],
        resolverFiles: [],
      });

      expect(result.diagnostics.length).toBe(0);
      expect(result.program).not.toBeNull();
      const options = result.program?.getCompilerOptions();
      expect(options?.strict).toBe(true);
    });

    it("should use default compilerOptions when tsconfig.json does not exist", () => {
      const typeFile = path.join(tempDir, "user.ts");
      fs.writeFileSync(typeFile, "export interface User { id: string; }");

      const result = createSharedProgram({
        cwd: tempDir,
        tsconfigPath: null,
        typeFiles: [typeFile],
        resolverFiles: [],
      });

      expect(result.diagnostics.length).toBe(0);
      expect(result.program).not.toBeNull();
      const options = result.program?.getCompilerOptions();
      expect(options?.strict).toBe(true);
    });

    it("should use custom tsconfig when tsconfigPath is specified", () => {
      const customTsconfigPath = path.join(tempDir, "tsconfig.custom.json");
      fs.writeFileSync(
        customTsconfigPath,
        JSON.stringify({
          compilerOptions: {
            target: "ES2020",
            strict: false,
          },
        }),
      );

      const typeFile = path.join(tempDir, "user.ts");
      fs.writeFileSync(typeFile, "export interface User { id: string; }");

      const result = createSharedProgram({
        cwd: tempDir,
        tsconfigPath: customTsconfigPath,
        typeFiles: [typeFile],
        resolverFiles: [],
      });

      expect(result.diagnostics.length).toBe(0);
      expect(result.program).not.toBeNull();
      const options = result.program?.getCompilerOptions();
      expect(options?.strict).toBe(false);
    });

    it("should return diagnostics when tsconfig path is invalid", () => {
      const typeFile = path.join(tempDir, "user.ts");
      fs.writeFileSync(typeFile, "export interface User { id: string; }");

      const result = createSharedProgram({
        cwd: tempDir,
        tsconfigPath: "non-existent.json",
        typeFiles: [typeFile],
        resolverFiles: [],
      });

      expect(result.diagnostics.length).toBe(1);
      expect(result.diagnostics[0]?.code).toBe("TSCONFIG_NOT_FOUND");
      expect(result.program).toBeNull();
    });

    it("should include all type and resolver files in the program", () => {
      const typesDir = path.join(tempDir, "types");
      const resolversDir = path.join(tempDir, "resolvers");
      fs.mkdirSync(typesDir, { recursive: true });
      fs.mkdirSync(resolversDir, { recursive: true });

      fs.writeFileSync(
        path.join(typesDir, "user.ts"),
        "export interface User { id: string; }",
      );
      fs.writeFileSync(
        path.join(typesDir, "post.ts"),
        "export interface Post { title: string; }",
      );
      fs.writeFileSync(
        path.join(resolversDir, "query.ts"),
        "export const getUser = () => {};",
      );

      const result = createSharedProgram({
        cwd: tempDir,
        tsconfigPath: null,
        typeFiles: [
          path.join(typesDir, "user.ts"),
          path.join(typesDir, "post.ts"),
        ],
        resolverFiles: [path.join(resolversDir, "query.ts")],
      });

      expect(result.diagnostics.length).toBe(0);
      expect(result.program).not.toBeNull();

      const sourceFileNames = result.program
        ?.getSourceFiles()
        .map((sf) => sf.fileName)
        .filter((name) => name.includes(tempDir));

      expect(sourceFileNames).toContain(path.join(typesDir, "user.ts"));
      expect(sourceFileNames).toContain(path.join(typesDir, "post.ts"));
      expect(sourceFileNames).toContain(path.join(resolversDir, "query.ts"));
    });
  });
});
