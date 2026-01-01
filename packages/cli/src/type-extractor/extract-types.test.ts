import assert from "node:assert";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
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

      const result = await extractTypes({ directory: tempDir });

      assert.strictEqual(result.types.length, 1);
      assert.strictEqual(result.types[0]?.name, "User");
      assert.strictEqual(result.types[0]?.kind, "Object");
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

      const result = await extractTypes({ directory: tempDir });

      assert.strictEqual(result.types.length, 2);
      const names = result.types.map((t) => t.name);
      assert.ok(names.includes("User"));
      assert.ok(names.includes("Post"));
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

      const result = await extractTypes({ directory: tempDir });

      const user = result.types[0];
      assert.ok(user?.fields);

      const idField = user.fields.find((f) => f.name === "id");
      assert.strictEqual(idField?.type.typeName, "String");

      const ageField = user.fields.find((f) => f.name === "age");
      assert.strictEqual(ageField?.type.typeName, "Float");

      const activeField = user.fields.find((f) => f.name === "active");
      assert.strictEqual(activeField?.type.typeName, "Boolean");
    });
  });

  describe("subdirectory scanning", () => {
    it("should scan subdirectories recursively", async () => {
      await mkdir(join(tempDir, "types"), { recursive: true });
      await writeFile(
        join(tempDir, "types", "user.ts"),
        `export interface User { id: string; }`,
      );

      const result = await extractTypes({ directory: tempDir });

      assert.strictEqual(result.types.length, 1);
      assert.strictEqual(result.types[0]?.name, "User");
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

      const result = await extractTypes({ directory: tempDir });

      assert.strictEqual(result.types.length, 2);
      const post = result.types.find((t) => t.name === "Post");
      assert.ok(post?.fields);
      const authorField = post.fields.find((f) => f.name === "author");
      assert.strictEqual(authorField?.type.typeName, "User");
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

      const result = await extractTypes({ directory: tempDir });

      const unionType = result.types.find((t) => t.name === "Result");
      assert.ok(unionType);
      assert.strictEqual(unionType.kind, "Union");
      assert.ok(unionType.unionMembers?.includes("Success"));
      assert.ok(unionType.unionMembers?.includes("Failure"));
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

      const result = await extractTypes({ directory: tempDir });

      assert.strictEqual(result.types[0]?.name, "Apple");
      assert.strictEqual(result.types[1]?.name, "Zebra");
    });

    it("should sort fields within types", async () => {
      await writeFile(
        join(tempDir, "user.ts"),
        `export interface User { zulu: string; alpha: string; }`,
      );

      const result = await extractTypes({ directory: tempDir });

      const fields = result.types[0]?.fields;
      assert.ok(fields);
      assert.strictEqual(fields[0]?.name, "alpha");
      assert.strictEqual(fields[1]?.name, "zulu");
    });
  });

  describe("error handling", () => {
    it("should report error for non-existent directory", async () => {
      const result = await extractTypes({ directory: "/non/existent/path" });

      assert.strictEqual(result.types.length, 0);
      assert.ok(result.diagnostics.errors.length > 0);
      assert.strictEqual(
        result.diagnostics.errors[0]?.code,
        "DIRECTORY_NOT_FOUND",
      );
    });

    it("should return empty result for empty directory", async () => {
      const result = await extractTypes({ directory: tempDir });

      assert.strictEqual(result.types.length, 0);
      assert.strictEqual(result.diagnostics.errors.length, 0);
    });

    it("should report unresolved type references", async () => {
      await writeFile(
        join(tempDir, "post.ts"),
        `export interface Post { author: User; }`,
      );

      const result = await extractTypes({ directory: tempDir });

      assert.ok(
        result.diagnostics.errors.some(
          (e) => e.code === "UNRESOLVED_REFERENCE",
        ),
      );
    });

    it("should warn about generic types", async () => {
      await writeFile(
        join(tempDir, "container.ts"),
        `export interface Container<T> { value: T; }`,
      );

      const result = await extractTypes({ directory: tempDir });

      assert.ok(
        result.diagnostics.warnings.some(
          (w) => w.code === "UNSUPPORTED_SYNTAX",
        ),
      );
    });
  });

  describe("async behavior", () => {
    it("should return a Promise", async () => {
      const result = extractTypes({ directory: tempDir });

      assert.ok(result instanceof Promise);
      await result;
    });
  });
});
