import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractTypes } from "./extract-types.js";

describe("extractTypes", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "gqlkit-extract-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("basic extraction", () => {
    it("should extract types from a directory", async () => {
      await writeFile(
        join(tempDir, "user.ts"),
        `export interface User { id: string; name: string; }`,
      );

      const result = await extractTypes({
        directory: tempDir,
        customScalarNames: null,
      });

      expect(result.types.length).toBe(1);
      expect(result.types[0]?.name).toBe("User");
      expect(result.types[0]?.kind).toBe("Object");
    });

    it("should extract types from multiple files", async () => {
      await writeFile(
        join(tempDir, "user.ts"),
        `export interface User { id: string; }`,
      );
      await writeFile(
        join(tempDir, "post.ts"),
        `export interface Post { title: string; }`,
      );

      const result = await extractTypes({
        directory: tempDir,
        customScalarNames: null,
      });

      expect(result.types.length).toBe(2);
      const names = result.types.map((t) => t.name);
      expect(names.includes("User")).toBeTruthy();
      expect(names.includes("Post")).toBeTruthy();
    });

    it("should convert types to GraphQL format", async () => {
      await writeFile(
        join(tempDir, "user.ts"),
        `export interface User {
          id: string;
          age: number;
          active: boolean;
        }`,
      );

      const result = await extractTypes({
        directory: tempDir,
        customScalarNames: null,
      });

      const user = result.types[0];
      expect(user?.fields).toBeDefined();

      const idField = user?.fields?.find((f) => f.name === "id");
      expect(idField?.type.typeName).toBe("String");

      const ageField = user?.fields?.find((f) => f.name === "age");
      expect(ageField?.type.typeName).toBe("Float");

      const activeField = user?.fields?.find((f) => f.name === "active");
      expect(activeField?.type.typeName).toBe("Boolean");
    });
  });

  describe("subdirectory scanning", () => {
    it("should scan subdirectories recursively", async () => {
      await mkdir(join(tempDir, "types"), { recursive: true });
      await writeFile(
        join(tempDir, "types", "user.ts"),
        `export interface User { id: string; }`,
      );

      const result = await extractTypes({
        directory: tempDir,
        customScalarNames: null,
      });

      expect(result.types.length).toBe(1);
      expect(result.types[0]?.name).toBe("User");
    });
  });

  describe("type relationships", () => {
    it("should handle type references between files", async () => {
      await writeFile(
        join(tempDir, "user.ts"),
        `export interface User { id: string; }`,
      );
      await writeFile(
        join(tempDir, "post.ts"),
        `import type { User } from './user';\nexport interface Post { author: User; }`,
      );

      const result = await extractTypes({
        directory: tempDir,
        customScalarNames: null,
      });

      expect(result.types.length).toBe(2);
      const post = result.types.find((t) => t.name === "Post");
      expect(post?.fields).toBeDefined();
      const authorField = post?.fields?.find((f) => f.name === "author");
      expect(authorField?.type.typeName).toBe("User");
    });

    it("should extract union types", async () => {
      await writeFile(
        join(tempDir, "result.ts"),
        `
        export interface Success { data: string; }
        export interface Failure { error: string; }
        export type Result = Success | Failure;
        `,
      );

      const result = await extractTypes({
        directory: tempDir,
        customScalarNames: null,
      });

      const unionType = result.types.find((t) => t.name === "Result");
      expect(unionType).toBeDefined();
      expect(unionType?.kind).toBe("Union");
      expect(unionType?.unionMembers?.includes("Success")).toBeTruthy();
      expect(unionType?.unionMembers?.includes("Failure")).toBeTruthy();
    });
  });

  describe("deterministic output", () => {
    it("should produce sorted output", async () => {
      await writeFile(
        join(tempDir, "zebra.ts"),
        `export interface Zebra { name: string; }`,
      );
      await writeFile(
        join(tempDir, "apple.ts"),
        `export interface Apple { name: string; }`,
      );

      const result = await extractTypes({
        directory: tempDir,
        customScalarNames: null,
      });

      expect(result.types[0]?.name).toBe("Apple");
      expect(result.types[1]?.name).toBe("Zebra");
    });

    it("should sort fields within types", async () => {
      await writeFile(
        join(tempDir, "user.ts"),
        `export interface User { zulu: string; alpha: string; }`,
      );

      const result = await extractTypes({
        directory: tempDir,
        customScalarNames: null,
      });

      const fields = result.types[0]?.fields;
      expect(fields).toBeDefined();
      expect(fields?.[0]?.name).toBe("alpha");
      expect(fields?.[1]?.name).toBe("zulu");
    });
  });

  describe("error handling", () => {
    it("should report error for non-existent directory", async () => {
      const result = await extractTypes({
        directory: "/non/existent/path",
        customScalarNames: null,
      });

      expect(result.types.length).toBe(0);
      expect(result.diagnostics.errors.length > 0).toBeTruthy();
      expect(result.diagnostics.errors[0]?.code).toBe("DIRECTORY_NOT_FOUND");
    });

    it("should return empty result for empty directory", async () => {
      const result = await extractTypes({
        directory: tempDir,
        customScalarNames: null,
      });

      expect(result.types.length).toBe(0);
      expect(result.diagnostics.errors.length).toBe(0);
    });

    it("should report unresolved type references", async () => {
      await writeFile(
        join(tempDir, "post.ts"),
        `export interface Post { author: User; }`,
      );

      const result = await extractTypes({
        directory: tempDir,
        customScalarNames: null,
      });

      expect(
        result.diagnostics.errors.some(
          (e) => e.code === "UNRESOLVED_REFERENCE",
        ),
      ).toBeTruthy();
    });

    it("should warn about generic types", async () => {
      await writeFile(
        join(tempDir, "container.ts"),
        `export interface Container<T> { value: T; }`,
      );

      const result = await extractTypes({
        directory: tempDir,
        customScalarNames: null,
      });

      expect(
        result.diagnostics.warnings.some(
          (w) => w.code === "UNSUPPORTED_SYNTAX",
        ),
      ).toBeTruthy();
    });
  });

  describe("async behavior", () => {
    it("should return a Promise", async () => {
      const result = extractTypes({
        directory: tempDir,
        customScalarNames: null,
      });

      expect(result instanceof Promise).toBeTruthy();
      await result;
    });
  });

  describe("external Program support", () => {
    it("should use external Program when provided", async () => {
      const filePath = join(tempDir, "user.ts");
      await writeFile(
        filePath,
        `export interface User { id: string; name: string; }`,
      );

      const program = ts.createProgram([filePath], {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.Node16,
        strict: true,
      });

      const result = await extractTypes({
        directory: tempDir,
        customScalarNames: null,
        program,
      });

      expect(result.types.length).toBe(1);
      expect(result.types[0]?.name).toBe("User");
    });

    it("should create internal Program when not provided (backward compatibility)", async () => {
      await writeFile(
        join(tempDir, "user.ts"),
        `export interface User { id: string; }`,
      );

      const result = await extractTypes({
        directory: tempDir,
        customScalarNames: null,
        program: null,
      });

      expect(result.types.length).toBe(1);
      expect(result.types[0]?.name).toBe("User");
    });

    it("should work without program parameter (backward compatibility)", async () => {
      await writeFile(
        join(tempDir, "user.ts"),
        `export interface User { id: string; }`,
      );

      const result = await extractTypes({
        directory: tempDir,
        customScalarNames: null,
      });

      expect(result.types.length).toBe(1);
      expect(result.types[0]?.name).toBe("User");
    });
  });
});
