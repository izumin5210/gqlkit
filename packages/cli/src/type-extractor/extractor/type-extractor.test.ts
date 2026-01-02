import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

      expect(program).toBeTruthy();
      expect(program.getTypeChecker()).toBeTruthy();
      expect(program.getSourceFile(files[0]!)).toBeTruthy();
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

      expect(program.getSourceFile(files[0]!)).toBeTruthy();
      expect(program.getSourceFile(files[1]!)).toBeTruthy();
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

        expect(result.types.length).toBe(1);
        expect(result.types[0]?.metadata.name).toBe("User");
        expect(result.types[0]?.metadata.kind).toBe("interface");
        expect(result.types[0]?.metadata.exportKind).toBe("named");
      });

      it("should detect exported type alias", async () => {
        await writeFile(
          join(tempDir, "status.ts"),
          `export type Status = { code: number; message: string; };`,
        );
        const files = [join(tempDir, "status.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        expect(result.types.length).toBe(1);
        expect(result.types[0]?.metadata.name).toBe("Status");
        expect(result.types[0]?.metadata.kind).toBe("object");
        expect(result.types[0]?.metadata.exportKind).toBe("named");
      });

      it("should detect default exported type", async () => {
        await writeFile(
          join(tempDir, "config.ts"),
          `type Config = { debug: boolean; };\nexport default Config;`,
        );
        const files = [join(tempDir, "config.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        expect(
          result.types.some((t) => t.metadata.exportKind === "default"),
        ).toBeTruthy();
      });

      it("should exclude non-exported types", async () => {
        await writeFile(
          join(tempDir, "internal.ts"),
          `interface InternalType { secret: string; }\nexport interface PublicType { visible: string; }`,
        );
        const files = [join(tempDir, "internal.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        expect(result.types.length).toBe(1);
        expect(result.types[0]?.metadata.name).toBe("PublicType");
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
        expect(unionType).toBeTruthy();
        expect(unionType?.metadata.kind).toBe("union");
        expect(unionType?.unionMembers).toEqual(["Error", "Success"]);
      });
    });

    describe("source file tracking", () => {
      it("should record the source file path for each type", async () => {
        const filePath = join(tempDir, "user.ts");
        await writeFile(filePath, `export interface User { id: string; }`);
        const program = createProgramFromFiles([filePath]);

        const result = extractTypesFromProgram(program, [filePath]);

        expect(result.types[0]?.metadata.sourceFile).toBe(filePath);
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
        expect(user).toBeTruthy();
        expect(user?.fields.length).toBe(3);
        const fieldNames = user?.fields.map((f) => f.name);
        expect(fieldNames?.includes("id")).toBeTruthy();
        expect(fieldNames?.includes("name")).toBeTruthy();
        expect(fieldNames?.includes("age")).toBeTruthy();
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
        expect(field).toBeTruthy();
        expect(field?.tsType.kind).toBe("primitive");
        expect(field?.tsType.name).toBe("string");
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
        expect(field).toBeTruthy();
        expect(field?.tsType.kind).toBe("primitive");
        expect(field?.tsType.name).toBe("number");
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
        expect(field).toBeTruthy();
        expect(field?.tsType.kind).toBe("primitive");
        expect(field?.tsType.name).toBe("boolean");
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
        expect(field).toBeTruthy();
        expect(field?.optional).toBe(true);
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
        expect(field).toBeTruthy();
        expect(field?.optional).toBe(false);
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
        expect(user).toBeTruthy();
        const addressField = user?.fields.find((f) => f.name === "address");
        expect(addressField).toBeTruthy();
        expect(addressField?.tsType.kind).toBe("reference");
        expect(addressField?.tsType.name).toBe("Address");
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
        expect(field).toBeTruthy();
        expect(field?.tsType.kind).toBe("array");
        expect(field?.tsType.elementType?.kind).toBe("primitive");
        expect(field?.tsType.elementType?.name).toBe("string");
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
        expect(field).toBeTruthy();
        expect(field?.tsType.nullable).toBe(true);
        expect(field?.tsType.kind).toBe("primitive");
        expect(field?.tsType.name).toBe("string");
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
        expect(field).toBeTruthy();
        expect(field?.tsType.nullable).toBe(true);
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
        expect(unionType).toBeTruthy();
        expect(unionType?.fields.length).toBe(0);
        expect(unionType?.unionMembers).toBeTruthy();
        expect(unionType?.unionMembers?.length).toBe(2);
      });
    });

    describe("diagnostics", () => {
      it("should report error when source file cannot be loaded", async () => {
        const nonExistentFile = join(tempDir, "non-existent.ts");
        const program = createProgramFromFiles([nonExistentFile]);

        const result = extractTypesFromProgram(program, [nonExistentFile]);

        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("PARSE_ERROR");
        expect(result.diagnostics[0]?.severity).toBe("error");
        expect(
          result.diagnostics[0]?.message.includes("non-existent.ts"),
        ).toBeTruthy();
      });

      it("should include source location in diagnostics", async () => {
        const nonExistentFile = join(tempDir, "missing.ts");
        const program = createProgramFromFiles([nonExistentFile]);

        const result = extractTypesFromProgram(program, [nonExistentFile]);

        expect(result.diagnostics[0]?.location).toBeTruthy();
        expect(result.diagnostics[0]?.location?.file).toBe(nonExistentFile);
        expect(result.diagnostics[0]?.location?.line).toBe(1);
        expect(result.diagnostics[0]?.location?.column).toBe(1);
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

        expect(result.types.length).toBe(1);
        expect(result.types[0]?.metadata.name).toBe("Valid");
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("PARSE_ERROR");
      });

      it("should warn for unsupported generic types", async () => {
        await writeFile(
          join(tempDir, "generic.ts"),
          `export interface Container<T> { value: T; }`,
        );
        const files = [join(tempDir, "generic.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        expect(
          result.diagnostics.some((d) => d.code === "UNSUPPORTED_SYNTAX"),
        ).toBeTruthy();
        expect(
          result.diagnostics.some((d) => d.severity === "warning"),
        ).toBeTruthy();
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

        expect(enumNode).toBeTruthy();
        if (enumNode) {
          expect(isStringEnum(enumNode)).toBe(true);
        }
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

        expect(enumNode).toBeTruthy();
        if (enumNode) {
          expect(isStringEnum(enumNode)).toBe(false);
        }
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

        expect(enumNode).toBeTruthy();
        if (enumNode) {
          expect(isNumericEnum(enumNode)).toBe(true);
        }
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

        expect(enumNode).toBeTruthy();
        if (enumNode) {
          expect(isNumericEnum(enumNode)).toBe(true);
        }
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

        expect(enumNode).toBeTruthy();
        if (enumNode) {
          expect(isNumericEnum(enumNode)).toBe(false);
        }
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

        expect(enumNode).toBeTruthy();
        if (enumNode) {
          expect(isHeterogeneousEnum(enumNode)).toBe(true);
        }
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

        expect(enumNode).toBeTruthy();
        if (enumNode) {
          expect(isHeterogeneousEnum(enumNode)).toBe(false);
        }
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

        expect(enumNode).toBeTruthy();
        if (enumNode) {
          expect(isConstEnum(enumNode)).toBe(true);
        }
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

        expect(enumNode).toBeTruthy();
        if (enumNode) {
          expect(isConstEnum(enumNode)).toBe(false);
        }
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

        expect(result.types.length).toBe(1);
        expect(result.types[0]?.metadata.kind).toBe("enum");
        expect(result.types[0]?.metadata.name).toBe("Status");
        expect(result.types[0]?.enumMembers?.length).toBe(2);
        expect(result.types[0]?.enumMembers?.[0]?.name).toBe("Active");
        expect(result.types[0]?.enumMembers?.[0]?.value).toBe("active");
        expect(result.types[0]?.enumMembers?.[1]?.name).toBe("Inactive");
        expect(result.types[0]?.enumMembers?.[1]?.value).toBe("inactive");
      });

      it("should extract default exported string enum", async () => {
        await writeFile(
          join(tempDir, "role.ts"),
          `enum Role { Admin = "admin", User = "user" }\nexport default Role;`,
        );
        const files = [join(tempDir, "role.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        expect(result.types.length).toBe(1);
        expect(result.types[0]?.metadata.kind).toBe("enum");
        expect(result.types[0]?.metadata.exportKind).toBe("default");
      });

      it("should preserve enum member order", async () => {
        await writeFile(
          join(tempDir, "order.ts"),
          `export enum Order { Third = "third", First = "first", Second = "second" }`,
        );
        const files = [join(tempDir, "order.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        expect(result.types[0]?.enumMembers?.[0]?.name).toBe("Third");
        expect(result.types[0]?.enumMembers?.[1]?.name).toBe("First");
        expect(result.types[0]?.enumMembers?.[2]?.name).toBe("Second");
      });

      it("should report diagnostic for numeric enum", async () => {
        await writeFile(
          join(tempDir, "numeric.ts"),
          `export enum Priority { Low, Medium, High }`,
        );
        const files = [join(tempDir, "numeric.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        expect(result.types.length).toBe(0);
        expect(
          result.diagnostics.some((d) => d.code === "UNSUPPORTED_ENUM_TYPE"),
        ).toBeTruthy();
        expect(
          result.diagnostics.some((d) => d.message.includes("string enum")),
        ).toBeTruthy();
      });

      it("should report diagnostic for const enum", async () => {
        await writeFile(
          join(tempDir, "const.ts"),
          `export const enum Direction { Up = "up", Down = "down" }`,
        );
        const files = [join(tempDir, "const.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        expect(result.types.length).toBe(0);
        expect(
          result.diagnostics.some((d) => d.code === "UNSUPPORTED_ENUM_TYPE"),
        ).toBeTruthy();
        expect(
          result.diagnostics.some((d) => d.message.includes("regular enum")),
        ).toBeTruthy();
      });

      it("should report diagnostic for heterogeneous enum", async () => {
        await writeFile(
          join(tempDir, "mixed.ts"),
          `export enum Mixed { Num = 1, Str = "str" }`,
        );
        const files = [join(tempDir, "mixed.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        expect(result.types.length).toBe(0);
        expect(
          result.diagnostics.some((d) => d.code === "UNSUPPORTED_ENUM_TYPE"),
        ).toBeTruthy();
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

        expect(result.types.length).toBe(2);
        const enumType = result.types.find((t) => t.metadata.name === "Status");
        const interfaceType = result.types.find(
          (t) => t.metadata.name === "User",
        );
        expect(enumType).toBeTruthy();
        expect(interfaceType).toBeTruthy();
        expect(enumType?.metadata.kind).toBe("enum");
        expect(interfaceType?.metadata.kind).toBe("interface");
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

        expect(typeAliasNode).toBeTruthy();
        if (typeAliasNode && ts.isTypeAliasDeclaration(typeAliasNode)) {
          const symbol = checker.getSymbolAtLocation(typeAliasNode.name);
          const type = checker.getDeclaredTypeOfSymbol(symbol!);
          expect(isStringLiteralUnion(type, checker)).toBe(true);
        }
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

        expect(typeAliasNode).toBeTruthy();
        if (typeAliasNode && ts.isTypeAliasDeclaration(typeAliasNode)) {
          const symbol = checker.getSymbolAtLocation(typeAliasNode.name);
          const type = checker.getDeclaredTypeOfSymbol(symbol!);
          expect(isStringLiteralUnion(type, checker)).toBe(true);
        }
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

        expect(typeAliasNode).toBeTruthy();
        if (typeAliasNode && ts.isTypeAliasDeclaration(typeAliasNode)) {
          const symbol = checker.getSymbolAtLocation(typeAliasNode.name);
          const type = checker.getDeclaredTypeOfSymbol(symbol!);
          expect(isStringLiteralUnion(type, checker)).toBe(false);
        }
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

        expect(typeAliasNode).toBeTruthy();
        if (typeAliasNode && ts.isTypeAliasDeclaration(typeAliasNode)) {
          const symbol = checker.getSymbolAtLocation(typeAliasNode.name);
          const type = checker.getDeclaredTypeOfSymbol(symbol!);
          expect(isStringLiteralUnion(type, checker)).toBe(false);
        }
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

        expect(result.types.length).toBe(1);
        expect(result.types[0]?.metadata.kind).toBe("enum");
        expect(result.types[0]?.metadata.name).toBe("Status");
        expect(result.types[0]?.enumMembers?.length).toBe(3);
        expect(result.types[0]?.enumMembers?.[0]?.name).toBe("active");
        expect(result.types[0]?.enumMembers?.[0]?.value).toBe("active");
      });

      it("should extract nullable string literal union excluding null/undefined", async () => {
        await writeFile(
          join(tempDir, "status.ts"),
          `export type Status = "active" | "inactive" | null | undefined;`,
        );
        const files = [join(tempDir, "status.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        expect(result.types.length).toBe(1);
        expect(result.types[0]?.metadata.kind).toBe("enum");
        expect(result.types[0]?.enumMembers?.length).toBe(2);
      });

      it("should preserve string literal union member order", async () => {
        await writeFile(
          join(tempDir, "order.ts"),
          `export type Order = "third" | "first" | "second";`,
        );
        const files = [join(tempDir, "order.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        expect(result.types[0]?.enumMembers?.[0]?.name).toBe("third");
        expect(result.types[0]?.enumMembers?.[1]?.name).toBe("first");
        expect(result.types[0]?.enumMembers?.[2]?.name).toBe("second");
      });

      it("should not treat mixed type union as enum", async () => {
        await writeFile(
          join(tempDir, "mixed.ts"),
          `export type Mixed = "a" | 1 | true;`,
        );
        const files = [join(tempDir, "mixed.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        expect(result.types.length).toBe(1);
        expect(result.types[0]?.metadata.kind).toBe("object");
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
        expect(resultType).toBeTruthy();
        expect(resultType?.metadata.kind).toBe("union");
      });
    });

    describe("description extraction", () => {
      it("should extract description from interface TSDoc", async () => {
        await writeFile(
          join(tempDir, "user.ts"),
          `
          /** A user in the system */
          export interface User {
            id: string;
          }
          `,
        );
        const files = [join(tempDir, "user.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        expect(result.types[0]?.metadata.description).toBe(
          "A user in the system",
        );
      });

      it("should extract description from type alias TSDoc", async () => {
        await writeFile(
          join(tempDir, "status.ts"),
          `
          /** Current status of the operation */
          export type Status = { code: number; message: string };
          `,
        );
        const files = [join(tempDir, "status.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        expect(result.types[0]?.metadata.description).toBe(
          "Current status of the operation",
        );
      });

      it("should extract description from union type TSDoc", async () => {
        await writeFile(
          join(tempDir, "result.ts"),
          `
          interface Success { data: string; }
          interface Failure { error: string; }
          /** Result of an operation that can succeed or fail */
          export type Result = Success | Failure;
          `,
        );
        const files = [join(tempDir, "result.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        const resultType = result.types.find(
          (t) => t.metadata.name === "Result",
        );
        expect(resultType?.metadata.description).toBe(
          "Result of an operation that can succeed or fail",
        );
      });

      it("should return undefined description when no TSDoc exists", async () => {
        await writeFile(
          join(tempDir, "user.ts"),
          `export interface User { id: string; }`,
        );
        const files = [join(tempDir, "user.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        expect(result.types[0]?.metadata.description).toBe(null);
      });

      it("should extract deprecated from type TSDoc", async () => {
        await writeFile(
          join(tempDir, "user.ts"),
          `
          /**
           * A user in the system
           * @deprecated Use Member instead
           */
          export interface User {
            id: string;
          }
          `,
        );
        const files = [join(tempDir, "user.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        expect(result.types[0]?.metadata.deprecated).toBeTruthy();
        expect(result.types[0]?.metadata.deprecated?.isDeprecated).toBe(true);
        expect(result.types[0]?.metadata.deprecated?.reason).toBe(
          "Use Member instead",
        );
      });

      it("should extract description from field TSDoc", async () => {
        await writeFile(
          join(tempDir, "user.ts"),
          `
          export interface User {
            /** The unique identifier */
            id: string;
            /** The display name */
            name: string;
          }
          `,
        );
        const files = [join(tempDir, "user.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        const idField = result.types[0]?.fields.find((f) => f.name === "id");
        const nameField = result.types[0]?.fields.find(
          (f) => f.name === "name",
        );
        expect(idField?.description).toBe("The unique identifier");
        expect(nameField?.description).toBe("The display name");
      });

      it("should extract deprecated from field TSDoc", async () => {
        await writeFile(
          join(tempDir, "user.ts"),
          `
          export interface User {
            /**
             * The unique identifier
             * @deprecated Use uuid instead
             */
            id: string;
          }
          `,
        );
        const files = [join(tempDir, "user.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        const idField = result.types[0]?.fields.find((f) => f.name === "id");
        expect(idField?.deprecated).toBeTruthy();
        expect(idField?.deprecated?.isDeprecated).toBe(true);
        expect(idField?.deprecated?.reason).toBe("Use uuid instead");
      });

      it("should return undefined field description when no TSDoc exists", async () => {
        await writeFile(
          join(tempDir, "user.ts"),
          `
          export interface User {
            id: string;
          }
          `,
        );
        const files = [join(tempDir, "user.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        const idField = result.types[0]?.fields.find((f) => f.name === "id");
        expect(idField?.description).toBe(null);
        expect(idField?.deprecated).toBe(null);
      });

      it("should extract description from enum TSDoc", async () => {
        await writeFile(
          join(tempDir, "status.ts"),
          `
          /** The status of a user account */
          export enum Status {
            Active = "active",
            Inactive = "inactive"
          }
          `,
        );
        const files = [join(tempDir, "status.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        expect(result.types[0]?.metadata.description).toBe(
          "The status of a user account",
        );
      });

      it("should extract description from enum member TSDoc", async () => {
        await writeFile(
          join(tempDir, "status.ts"),
          `
          export enum Status {
            /** User is currently active */
            Active = "active",
            /** User account is deactivated */
            Inactive = "inactive"
          }
          `,
        );
        const files = [join(tempDir, "status.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        const activeEnum = result.types[0]?.enumMembers?.find(
          (m) => m.name === "Active",
        );
        const inactiveEnum = result.types[0]?.enumMembers?.find(
          (m) => m.name === "Inactive",
        );
        expect(activeEnum?.description).toBe("User is currently active");
        expect(inactiveEnum?.description).toBe("User account is deactivated");
      });

      it("should extract deprecated from enum member TSDoc", async () => {
        await writeFile(
          join(tempDir, "status.ts"),
          `
          export enum Status {
            Active = "active",
            /**
             * User account is deactivated
             * @deprecated Use Suspended instead
             */
            Inactive = "inactive"
          }
          `,
        );
        const files = [join(tempDir, "status.ts")];
        const program = createProgramFromFiles(files);

        const result = extractTypesFromProgram(program, files);

        const inactiveEnum = result.types[0]?.enumMembers?.find(
          (m) => m.name === "Inactive",
        );
        expect(inactiveEnum?.deprecated).toBeTruthy();
        expect(inactiveEnum?.deprecated?.isDeprecated).toBe(true);
        expect(inactiveEnum?.deprecated?.reason).toBe("Use Suspended instead");
      });
    });
  });
});
