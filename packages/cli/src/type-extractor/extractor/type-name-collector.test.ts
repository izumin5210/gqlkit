import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { collectDeclaredTypeNames } from "./type-name-collector.js";

describe("collectDeclaredTypeNames", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "type-name-collector-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function createProgram(files: Record<string, string>): ts.Program {
    const filePaths: string[] = [];
    for (const name of Object.keys(files)) {
      const filePath = join(tempDir, name);
      filePaths.push(filePath);
    }

    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.Node16,
      strict: true,
      noEmit: true,
    };

    const host = ts.createCompilerHost(compilerOptions);
    const originalReadFile = host.readFile.bind(host);
    host.readFile = (fileName: string) => {
      for (const [name, content] of Object.entries(files)) {
        if (fileName === join(tempDir, name)) {
          return content;
        }
      }
      return originalReadFile(fileName);
    };
    host.fileExists = (fileName: string) => {
      for (const name of Object.keys(files)) {
        if (fileName === join(tempDir, name)) {
          return true;
        }
      }
      return ts.sys.fileExists(fileName);
    };

    return ts.createProgram(filePaths, compilerOptions, host);
  }

  it("should collect exported type alias names", () => {
    const program = createProgram({
      "types.ts": `
        export type User = { id: string; name: string };
        export type Post = { title: string };
        type InternalType = { secret: string };
      `,
    });

    const result = collectDeclaredTypeNames(program, [
      join(tempDir, "types.ts"),
    ]);

    expect(result.typeNames).toContain("User");
    expect(result.typeNames).toContain("Post");
    expect(result.typeNames).not.toContain("InternalType");
  });

  it("should collect exported interface names", () => {
    const program = createProgram({
      "types.ts": `
        export interface User { id: string; name: string }
        export interface Post { title: string }
        interface InternalInterface { secret: string }
      `,
    });

    const result = collectDeclaredTypeNames(program, [
      join(tempDir, "types.ts"),
    ]);

    expect(result.typeNames).toContain("User");
    expect(result.typeNames).toContain("Post");
    expect(result.typeNames).not.toContain("InternalInterface");
  });

  it("should collect exported enum names", () => {
    const program = createProgram({
      "types.ts": `
        export enum Status { Active, Inactive }
        export enum Priority { Low, Medium, High }
        enum InternalEnum { A, B }
      `,
    });

    const result = collectDeclaredTypeNames(program, [
      join(tempDir, "types.ts"),
    ]);

    expect(result.typeNames).toContain("Status");
    expect(result.typeNames).toContain("Priority");
    expect(result.typeNames).not.toContain("InternalEnum");
  });

  it("should collect types from multiple files", () => {
    const program = createProgram({
      "user.ts": `export type User = { id: string };`,
      "post.ts": `export type Post = { title: string };`,
    });

    const result = collectDeclaredTypeNames(program, [
      join(tempDir, "user.ts"),
      join(tempDir, "post.ts"),
    ]);

    expect(result.typeNames).toContain("User");
    expect(result.typeNames).toContain("Post");
  });

  it("should handle utility type declarations", () => {
    const program = createProgram({
      "types.ts": `
        type DeepPartial<T> = { [P in keyof T]?: DeepPartial<T[P]> };
        interface InternalUser { id: string; name: string }
        export type User = DeepPartial<InternalUser>;
      `,
    });

    const result = collectDeclaredTypeNames(program, [
      join(tempDir, "types.ts"),
    ]);

    expect(result.typeNames).toContain("User");
    expect(result.typeNames).not.toContain("DeepPartial");
    expect(result.typeNames).not.toContain("InternalUser");
  });

  it("should handle intersection type declarations", () => {
    const program = createProgram({
      "types.ts": `
        export type A = { a: string };
        export type B = { b: number };
        export type Combined = A & B;
      `,
    });

    const result = collectDeclaredTypeNames(program, [
      join(tempDir, "types.ts"),
    ]);

    expect(result.typeNames).toContain("A");
    expect(result.typeNames).toContain("B");
    expect(result.typeNames).toContain("Combined");
  });
});
