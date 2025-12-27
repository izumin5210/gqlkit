import assert from "node:assert";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  createProgramFromFiles,
  extractTypesFromProgram,
  isConstEnum,
  isHeterogeneousEnum,
  isNumericEnum,
  isStringEnum,
  isStringLiteralUnion,
} from "./type-extractor.js";

describe("TypeExtractor", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "gqlkit-extractor-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("createProgramFromFiles", () => {
    it("should create a TypeScript program from file paths", async () => {
      await writeFile(
        join(tempDir, "user.ts"),
        `export interface User { id: string; name: string; }`,
      );
      const files = [join(tempDir, "user.ts")];

      const program = createProgramFromFiles(files);

      assert.ok(program);
      assert.ok(program.getTypeChecker());
      assert.ok(program.getSourceFile(files[0]!));
    });

    it("should handle multiple files", async () => {
      await writeFile(
        join(tempDir, "user.ts"),
        `export interface User { id: string; }`,
      );
      await writeFile(
        join(tempDir, "post.ts"),
        `export interface Post { title: string; }`,
      );
      const files = [join(tempDir, "user.ts"), join(tempDir, "post.ts")];

      const program = createProgramFromFiles(files);

      assert.ok(program.getSourceFile(files[0]!));
      assert.ok(program.getSourceFile(files[1]!));
    });
  });

  describe("extractTypesFromProgram", () => {
    describe("export detection", () => {
      it("should detect exported interface", async () => {
        await writeFile(
          join(tempDir, "user.ts"),
          `export interface User { id: string; }`,
        );
        const files = [join(tempDir, "user.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        assert.strictEqual(result.types.length, 1);
        assert.strictEqual(result.types[0]?.metadata.name, "User");
        assert.strictEqual(result.types[0]?.metadata.kind, "interface");
        assert.strictEqual(result.types[0]?.metadata.exportKind, "named");
      });

      it("should detect exported type alias", async () => {
        await writeFile(
          join(tempDir, "status.ts"),
          `export type Status = { code: number; message: string; };`,
        );
        const files = [join(tempDir, "status.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        assert.strictEqual(result.types.length, 1);
        assert.strictEqual(result.types[0]?.metadata.name, "Status");
        assert.strictEqual(result.types[0]?.metadata.kind, "object");
        assert.strictEqual(result.types[0]?.metadata.exportKind, "named");
      });

      it("should detect default exported type", async () => {
        await writeFile(
          join(tempDir, "config.ts"),
          `type Config = { debug: boolean; };\nexport default Config;`,
        );
        const files = [join(tempDir, "config.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        assert.ok(
          result.types.some((t) => t.metadata.exportKind === "default"),
        );
      });

      it("should exclude non-exported types", async () => {
        await writeFile(
          join(tempDir, "internal.ts"),
          `interface InternalType { secret: string; }\nexport interface PublicType { visible: string; }`,
        );
        const files = [join(tempDir, "internal.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        assert.strictEqual(result.types.length, 1);
        assert.strictEqual(result.types[0]?.metadata.name, "PublicType");
      });
    });

    describe("union type detection", () => {
      it("should detect union type with object members", async () => {
        await writeFile(
          join(tempDir, "result.ts"),
          `
          export interface Success { data: string; }
          export interface Error { message: string; }
          export type Result = Success | Error;
          `,
        );
        const files = [join(tempDir, "result.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        const unionType = result.types.find(
          (t) => t.metadata.name === "Result",
        );
        assert.ok(unionType);
        assert.strictEqual(unionType.metadata.kind, "union");
        assert.deepStrictEqual(unionType.unionMembers, ["Error", "Success"]);
      });
    });

    describe("source file tracking", () => {
      it("should record the source file path for each type", async () => {
        const filePath = join(tempDir, "user.ts");
        await writeFile(filePath, `export interface User { id: string; }`);
        const program = createProgramFromFiles([filePath]);

        const result = extractTypesFromProgram(program, [filePath]);

        assert.strictEqual(result.types[0]?.metadata.sourceFile, filePath);
      });
    });

    describe("field extraction", () => {
      it("should extract field names", async () => {
        await writeFile(
          join(tempDir, "user.ts"),
          `export interface User { id: string; name: string; age: number; }`,
        );
        const files = [join(tempDir, "user.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        const user = result.types[0];
        assert.ok(user);
        assert.strictEqual(user.fields.length, 3);
        const fieldNames = user.fields.map((f) => f.name);
        assert.ok(fieldNames.includes("id"));
        assert.ok(fieldNames.includes("name"));
        assert.ok(fieldNames.includes("age"));
      });

      it("should detect primitive string type", async () => {
        await writeFile(
          join(tempDir, "user.ts"),
          `export interface User { name: string; }`,
        );
        const files = [join(tempDir, "user.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        const field = result.types[0]?.fields[0];
        assert.ok(field);
        assert.strictEqual(field.tsType.kind, "primitive");
        assert.strictEqual(field.tsType.name, "string");
      });

      it("should detect primitive number type", async () => {
        await writeFile(
          join(tempDir, "user.ts"),
          `export interface User { age: number; }`,
        );
        const files = [join(tempDir, "user.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        const field = result.types[0]?.fields[0];
        assert.ok(field);
        assert.strictEqual(field.tsType.kind, "primitive");
        assert.strictEqual(field.tsType.name, "number");
      });

      it("should detect primitive boolean type", async () => {
        await writeFile(
          join(tempDir, "user.ts"),
          `export interface User { active: boolean; }`,
        );
        const files = [join(tempDir, "user.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        const field = result.types[0]?.fields[0];
        assert.ok(field);
        assert.strictEqual(field.tsType.kind, "primitive");
        assert.strictEqual(field.tsType.name, "boolean");
      });

      it("should detect optional fields", async () => {
        await writeFile(
          join(tempDir, "user.ts"),
          `export interface User { nickname?: string; }`,
        );
        const files = [join(tempDir, "user.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        const field = result.types[0]?.fields[0];
        assert.ok(field);
        assert.strictEqual(field.optional, true);
      });

      it("should detect required fields", async () => {
        await writeFile(
          join(tempDir, "user.ts"),
          `export interface User { name: string; }`,
        );
        const files = [join(tempDir, "user.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        const field = result.types[0]?.fields[0];
        assert.ok(field);
        assert.strictEqual(field.optional, false);
      });

      it("should detect type references", async () => {
        await writeFile(
          join(tempDir, "types.ts"),
          `
          export interface Address { city: string; }
          export interface User { address: Address; }
          `,
        );
        const files = [join(tempDir, "types.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        const user = result.types.find((t) => t.metadata.name === "User");
        assert.ok(user);
        const addressField = user.fields.find((f) => f.name === "address");
        assert.ok(addressField);
        assert.strictEqual(addressField.tsType.kind, "reference");
        assert.strictEqual(addressField.tsType.name, "Address");
      });

      it("should detect array types", async () => {
        await writeFile(
          join(tempDir, "user.ts"),
          `export interface User { tags: string[]; }`,
        );
        const files = [join(tempDir, "user.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        const field = result.types[0]?.fields[0];
        assert.ok(field);
        assert.strictEqual(field.tsType.kind, "array");
        assert.strictEqual(field.tsType.elementType?.kind, "primitive");
        assert.strictEqual(field.tsType.elementType?.name, "string");
      });

      it("should detect nullable types with null", async () => {
        await writeFile(
          join(tempDir, "user.ts"),
          `export interface User { nickname: string | null; }`,
        );
        const files = [join(tempDir, "user.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        const field = result.types[0]?.fields[0];
        assert.ok(field);
        assert.strictEqual(field.tsType.nullable, true);
        assert.strictEqual(field.tsType.kind, "primitive");
        assert.strictEqual(field.tsType.name, "string");
      });

      it("should detect nullable types with undefined", async () => {
        await writeFile(
          join(tempDir, "user.ts"),
          `export interface User { nickname: string | undefined; }`,
        );
        const files = [join(tempDir, "user.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        const field = result.types[0]?.fields[0];
        assert.ok(field);
        assert.strictEqual(field.tsType.nullable, true);
      });

      it("should not extract fields for union types", async () => {
        await writeFile(
          join(tempDir, "result.ts"),
          `
          export interface Success { data: string; }
          export interface Failure { error: string; }
          export type Result = Success | Failure;
          `,
        );
        const files = [join(tempDir, "result.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        const unionType = result.types.find(
          (t) => t.metadata.name === "Result",
        );
        assert.ok(unionType);
        assert.strictEqual(unionType.fields.length, 0);
        assert.ok(unionType.unionMembers);
        assert.strictEqual(unionType.unionMembers.length, 2);
      });
    });

    describe("diagnostics", () => {
      it("should report error when source file cannot be loaded", async () => {
        const nonExistentFile = join(tempDir, "non-existent.ts");
        const program = createProgramFromFiles([nonExistentFile]);

        const result = extractTypesFromProgram(program, [nonExistentFile]);

        assert.strictEqual(result.diagnostics.length, 1);
        assert.strictEqual(result.diagnostics[0]?.code, "PARSE_ERROR");
        assert.strictEqual(result.diagnostics[0]?.severity, "error");
        assert.ok(result.diagnostics[0]?.message.includes("non-existent.ts"));
      });

      it("should include source location in diagnostics", async () => {
        const nonExistentFile = join(tempDir, "missing.ts");
        const program = createProgramFromFiles([nonExistentFile]);

        const result = extractTypesFromProgram(program, [nonExistentFile]);

        assert.ok(result.diagnostics[0]?.location);
        assert.strictEqual(
          result.diagnostics[0]?.location.file,
          nonExistentFile,
        );
        assert.strictEqual(result.diagnostics[0]?.location.line, 1);
        assert.strictEqual(result.diagnostics[0]?.location.column, 1);
      });

      it("should continue processing other files when one fails", async () => {
        const validFile = join(tempDir, "valid.ts");
        await writeFile(validFile, `export interface Valid { name: string; }`);
        const invalidFile = join(tempDir, "invalid.ts");
        const program = createProgramFromFiles([validFile, invalidFile]);

        const result = extractTypesFromProgram(program, [
          validFile,
          invalidFile,
        ]);

        assert.strictEqual(result.types.length, 1);
        assert.strictEqual(result.types[0]?.metadata.name, "Valid");
        assert.strictEqual(result.diagnostics.length, 1);
        assert.strictEqual(result.diagnostics[0]?.code, "PARSE_ERROR");
      });

      it("should warn for unsupported generic types", async () => {
        await writeFile(
          join(tempDir, "generic.ts"),
          `export interface Container<T> { value: T; }`,
        );
        const files = [join(tempDir, "generic.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        assert.ok(
          result.diagnostics.some((d) => d.code === "UNSUPPORTED_SYNTAX"),
        );
        assert.ok(result.diagnostics.some((d) => d.severity === "warning"));
      });
    });
  });

  describe("enum detection functions", () => {
    describe("isStringEnum", () => {
      it("should return true for enum with all string values", async () => {
        await writeFile(
          join(tempDir, "status.ts"),
          `export enum Status { Active = "active", Inactive = "inactive" }`,
        );
        const files = [join(tempDir, "status.ts")];
        const program = createProgramFromFiles(files);
        const sourceFile = program.getSourceFile(files[0]!);
        const enumNode = sourceFile?.statements[0];

        assert.ok(enumNode);
        assert.strictEqual(isStringEnum(enumNode), true);
      });

      it("should return false for numeric enum", async () => {
        await writeFile(
          join(tempDir, "priority.ts"),
          `export enum Priority { Low, Medium, High }`,
        );
        const files = [join(tempDir, "priority.ts")];
        const program = createProgramFromFiles(files);
        const sourceFile = program.getSourceFile(files[0]!);
        const enumNode = sourceFile?.statements[0];

        assert.ok(enumNode);
        assert.strictEqual(isStringEnum(enumNode), false);
      });
    });

    describe("isNumericEnum", () => {
      it("should return true for enum with all numeric values", async () => {
        await writeFile(
          join(tempDir, "priority.ts"),
          `export enum Priority { Low = 0, Medium = 1, High = 2 }`,
        );
        const files = [join(tempDir, "priority.ts")];
        const program = createProgramFromFiles(files);
        const sourceFile = program.getSourceFile(files[0]!);
        const enumNode = sourceFile?.statements[0];

        assert.ok(enumNode);
        assert.strictEqual(isNumericEnum(enumNode), true);
      });

      it("should return true for implicit numeric enum", async () => {
        await writeFile(
          join(tempDir, "priority.ts"),
          `export enum Priority { Low, Medium, High }`,
        );
        const files = [join(tempDir, "priority.ts")];
        const program = createProgramFromFiles(files);
        const sourceFile = program.getSourceFile(files[0]!);
        const enumNode = sourceFile?.statements[0];

        assert.ok(enumNode);
        assert.strictEqual(isNumericEnum(enumNode), true);
      });

      it("should return false for string enum", async () => {
        await writeFile(
          join(tempDir, "status.ts"),
          `export enum Status { Active = "active" }`,
        );
        const files = [join(tempDir, "status.ts")];
        const program = createProgramFromFiles(files);
        const sourceFile = program.getSourceFile(files[0]!);
        const enumNode = sourceFile?.statements[0];

        assert.ok(enumNode);
        assert.strictEqual(isNumericEnum(enumNode), false);
      });
    });

    describe("isHeterogeneousEnum", () => {
      it("should return true for enum with mixed values", async () => {
        await writeFile(
          join(tempDir, "mixed.ts"),
          `export enum Mixed { Num = 1, Str = "str" }`,
        );
        const files = [join(tempDir, "mixed.ts")];
        const program = createProgramFromFiles(files);
        const sourceFile = program.getSourceFile(files[0]!);
        const enumNode = sourceFile?.statements[0];

        assert.ok(enumNode);
        assert.strictEqual(isHeterogeneousEnum(enumNode), true);
      });

      it("should return false for pure string enum", async () => {
        await writeFile(
          join(tempDir, "status.ts"),
          `export enum Status { A = "a", B = "b" }`,
        );
        const files = [join(tempDir, "status.ts")];
        const program = createProgramFromFiles(files);
        const sourceFile = program.getSourceFile(files[0]!);
        const enumNode = sourceFile?.statements[0];

        assert.ok(enumNode);
        assert.strictEqual(isHeterogeneousEnum(enumNode), false);
      });
    });

    describe("isConstEnum", () => {
      it("should return true for const enum", async () => {
        await writeFile(
          join(tempDir, "const.ts"),
          `export const enum Direction { Up, Down, Left, Right }`,
        );
        const files = [join(tempDir, "const.ts")];
        const program = createProgramFromFiles(files);
        const sourceFile = program.getSourceFile(files[0]!);
        const enumNode = sourceFile?.statements[0];

        assert.ok(enumNode);
        assert.strictEqual(isConstEnum(enumNode), true);
      });

      it("should return false for regular enum", async () => {
        await writeFile(
          join(tempDir, "regular.ts"),
          `export enum Direction { Up, Down }`,
        );
        const files = [join(tempDir, "regular.ts")];
        const program = createProgramFromFiles(files);
        const sourceFile = program.getSourceFile(files[0]!);
        const enumNode = sourceFile?.statements[0];

        assert.ok(enumNode);
        assert.strictEqual(isConstEnum(enumNode), false);
      });
    });

    describe("enum extraction in extractTypesFromProgram", () => {
      it("should extract string enum as enum type", async () => {
        await writeFile(
          join(tempDir, "status.ts"),
          `export enum Status { Active = "active", Inactive = "inactive" }`,
        );
        const files = [join(tempDir, "status.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        assert.strictEqual(result.types.length, 1);
        assert.strictEqual(result.types[0]?.metadata.kind, "enum");
        assert.strictEqual(result.types[0]?.metadata.name, "Status");
        assert.strictEqual(result.types[0]?.enumMembers?.length, 2);
        assert.strictEqual(result.types[0]?.enumMembers?.[0]?.name, "Active");
        assert.strictEqual(result.types[0]?.enumMembers?.[0]?.value, "active");
        assert.strictEqual(result.types[0]?.enumMembers?.[1]?.name, "Inactive");
        assert.strictEqual(
          result.types[0]?.enumMembers?.[1]?.value,
          "inactive",
        );
      });

      it("should extract default exported string enum", async () => {
        await writeFile(
          join(tempDir, "role.ts"),
          `enum Role { Admin = "admin", User = "user" }\nexport default Role;`,
        );
        const files = [join(tempDir, "role.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        assert.strictEqual(result.types.length, 1);
        assert.strictEqual(result.types[0]?.metadata.kind, "enum");
        assert.strictEqual(result.types[0]?.metadata.exportKind, "default");
      });

      it("should preserve enum member order", async () => {
        await writeFile(
          join(tempDir, "order.ts"),
          `export enum Order { Third = "third", First = "first", Second = "second" }`,
        );
        const files = [join(tempDir, "order.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        assert.strictEqual(result.types[0]?.enumMembers?.[0]?.name, "Third");
        assert.strictEqual(result.types[0]?.enumMembers?.[1]?.name, "First");
        assert.strictEqual(result.types[0]?.enumMembers?.[2]?.name, "Second");
      });

      it("should report diagnostic for numeric enum", async () => {
        await writeFile(
          join(tempDir, "numeric.ts"),
          `export enum Priority { Low, Medium, High }`,
        );
        const files = [join(tempDir, "numeric.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        assert.strictEqual(result.types.length, 0);
        assert.ok(
          result.diagnostics.some((d) => d.code === "UNSUPPORTED_ENUM_TYPE"),
        );
        assert.ok(
          result.diagnostics.some((d) => d.message.includes("string enum")),
        );
      });

      it("should report diagnostic for const enum", async () => {
        await writeFile(
          join(tempDir, "const.ts"),
          `export const enum Direction { Up = "up", Down = "down" }`,
        );
        const files = [join(tempDir, "const.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        assert.strictEqual(result.types.length, 0);
        assert.ok(
          result.diagnostics.some((d) => d.code === "UNSUPPORTED_ENUM_TYPE"),
        );
        assert.ok(
          result.diagnostics.some((d) => d.message.includes("regular enum")),
        );
      });

      it("should report diagnostic for heterogeneous enum", async () => {
        await writeFile(
          join(tempDir, "mixed.ts"),
          `export enum Mixed { Num = 1, Str = "str" }`,
        );
        const files = [join(tempDir, "mixed.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        assert.strictEqual(result.types.length, 0);
        assert.ok(
          result.diagnostics.some((d) => d.code === "UNSUPPORTED_ENUM_TYPE"),
        );
      });

      it("should extract enum and interface from same file", async () => {
        await writeFile(
          join(tempDir, "combined.ts"),
          `
          export enum Status { Active = "active" }
          export interface User { id: string; status: Status; }
          `,
        );
        const files = [join(tempDir, "combined.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        assert.strictEqual(result.types.length, 2);
        const enumType = result.types.find((t) => t.metadata.name === "Status");
        const interfaceType = result.types.find(
          (t) => t.metadata.name === "User",
        );
        assert.ok(enumType);
        assert.ok(interfaceType);
        assert.strictEqual(enumType.metadata.kind, "enum");
        assert.strictEqual(interfaceType.metadata.kind, "interface");
      });
    });

    describe("isStringLiteralUnion", () => {
      it("should return true for string literal union type", async () => {
        await writeFile(
          join(tempDir, "status.ts"),
          `export type Status = "active" | "inactive";`,
        );
        const files = [join(tempDir, "status.ts")];
        const program = createProgramFromFiles(files);
        const checker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(files[0]!);
        const typeAliasNode = sourceFile?.statements[0];

        assert.ok(typeAliasNode);
        const symbol = checker.getSymbolAtLocation(
          (typeAliasNode as { name: { getText: () => string } }).name,
        );
        const type = checker.getDeclaredTypeOfSymbol(symbol!);
        assert.strictEqual(isStringLiteralUnion(type, checker), true);
      });

      it("should return true for nullable string literal union", async () => {
        await writeFile(
          join(tempDir, "status.ts"),
          `export type Status = "active" | "inactive" | null;`,
        );
        const files = [join(tempDir, "status.ts")];
        const program = createProgramFromFiles(files);
        const checker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(files[0]!);
        const typeAliasNode = sourceFile?.statements[0];

        assert.ok(typeAliasNode);
        const symbol = checker.getSymbolAtLocation(
          (typeAliasNode as { name: { getText: () => string } }).name,
        );
        const type = checker.getDeclaredTypeOfSymbol(symbol!);
        assert.strictEqual(isStringLiteralUnion(type, checker), true);
      });

      it("should return false for object union", async () => {
        await writeFile(
          join(tempDir, "result.ts"),
          `
          interface A { a: string; }
          interface B { b: string; }
          export type Result = A | B;
          `,
        );
        const files = [join(tempDir, "result.ts")];
        const program = createProgramFromFiles(files);
        const checker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(files[0]!);
        const typeAliasNode = sourceFile?.statements[2];

        assert.ok(typeAliasNode);
        const symbol = checker.getSymbolAtLocation(
          (typeAliasNode as { name: { getText: () => string } }).name,
        );
        const type = checker.getDeclaredTypeOfSymbol(symbol!);
        assert.strictEqual(isStringLiteralUnion(type, checker), false);
      });

      it("should return false for mixed string and number literals", async () => {
        await writeFile(
          join(tempDir, "mixed.ts"),
          `export type Mixed = "a" | 1;`,
        );
        const files = [join(tempDir, "mixed.ts")];
        const program = createProgramFromFiles(files);
        const checker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(files[0]!);
        const typeAliasNode = sourceFile?.statements[0];

        assert.ok(typeAliasNode);
        const symbol = checker.getSymbolAtLocation(
          (typeAliasNode as { name: { getText: () => string } }).name,
        );
        const type = checker.getDeclaredTypeOfSymbol(symbol!);
        assert.strictEqual(isStringLiteralUnion(type, checker), false);
      });
    });

    describe("string literal union extraction in extractTypesFromProgram", () => {
      it("should extract string literal union as enum type", async () => {
        await writeFile(
          join(tempDir, "status.ts"),
          `export type Status = "active" | "inactive" | "pending";`,
        );
        const files = [join(tempDir, "status.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        assert.strictEqual(result.types.length, 1);
        assert.strictEqual(result.types[0]?.metadata.kind, "enum");
        assert.strictEqual(result.types[0]?.metadata.name, "Status");
        assert.strictEqual(result.types[0]?.enumMembers?.length, 3);
        assert.strictEqual(result.types[0]?.enumMembers?.[0]?.name, "active");
        assert.strictEqual(result.types[0]?.enumMembers?.[0]?.value, "active");
      });

      it("should extract nullable string literal union excluding null/undefined", async () => {
        await writeFile(
          join(tempDir, "status.ts"),
          `export type Status = "active" | "inactive" | null | undefined;`,
        );
        const files = [join(tempDir, "status.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        assert.strictEqual(result.types.length, 1);
        assert.strictEqual(result.types[0]?.metadata.kind, "enum");
        assert.strictEqual(result.types[0]?.enumMembers?.length, 2);
      });

      it("should preserve string literal union member order", async () => {
        await writeFile(
          join(tempDir, "order.ts"),
          `export type Order = "third" | "first" | "second";`,
        );
        const files = [join(tempDir, "order.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        assert.strictEqual(result.types[0]?.enumMembers?.[0]?.name, "third");
        assert.strictEqual(result.types[0]?.enumMembers?.[1]?.name, "first");
        assert.strictEqual(result.types[0]?.enumMembers?.[2]?.name, "second");
      });

      it("should not treat mixed type union as enum", async () => {
        await writeFile(
          join(tempDir, "mixed.ts"),
          `export type Mixed = "a" | 1 | true;`,
        );
        const files = [join(tempDir, "mixed.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        assert.strictEqual(result.types.length, 1);
        assert.strictEqual(result.types[0]?.metadata.kind, "object");
      });

      it("should not treat object union as enum", async () => {
        await writeFile(
          join(tempDir, "result.ts"),
          `
          interface Success { data: string; }
          interface Error { message: string; }
          export type Result = Success | Error;
          `,
        );
        const files = [join(tempDir, "result.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        const resultType = result.types.find(
          (t) => t.metadata.name === "Result",
        );
        assert.ok(resultType);
        assert.strictEqual(resultType.metadata.kind, "union");
      });
    });
  });
});
