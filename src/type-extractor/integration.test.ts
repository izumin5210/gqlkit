import assert from "node:assert";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { extractTypes } from "./index.js";

describe("Integration Tests", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "gqlkit-integration-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("multi-file type extraction", () => {
    it("should handle complex type graph across multiple files", async () => {
      await mkdir(join(tempDir, "types"), { recursive: true });

      await writeFile(
        join(tempDir, "types", "user.ts"),
        `
        export interface User {
          id: string;
          name: string;
          email: string | null;
          posts: Post[];
        }
        import type { Post } from './post.js';
        `,
      );

      await writeFile(
        join(tempDir, "types", "post.ts"),
        `
        export interface Post {
          id: string;
          title: string;
          content: string;
          published: boolean;
          author: User;
        }
        import type { User } from './user.js';
        `,
      );

      await writeFile(
        join(tempDir, "types", "comment.ts"),
        `
        export interface Comment {
          id: string;
          text: string;
          author: User;
          post: Post;
        }
        import type { User } from './user.js';
        import type { Post } from './post.js';
        `,
      );

      const result = await extractTypes({ directory: tempDir });

      assert.strictEqual(result.types.length, 3);
      assert.strictEqual(result.diagnostics.errors.length, 0);

      const user = result.types.find((t) => t.name === "User");
      assert.ok(user);
      assert.strictEqual(user.kind, "Object");

      const emailField = user.fields?.find((f) => f.name === "email");
      assert.ok(emailField);
      assert.strictEqual(emailField.type.nullable, true);

      const postsField = user.fields?.find((f) => f.name === "posts");
      assert.ok(postsField);
      assert.strictEqual(postsField.type.list, true);
      assert.strictEqual(postsField.type.typeName, "Post");
    });
  });

  describe("deterministic output verification", () => {
    it("should produce identical output for same input across multiple runs", async () => {
      await writeFile(
        join(tempDir, "zebra.ts"),
        `export interface Zebra { zField: string; aField: number; }`,
      );
      await writeFile(
        join(tempDir, "apple.ts"),
        `export interface Apple { xField: boolean; bField: string; }`,
      );

      const result1 = await extractTypes({ directory: tempDir });
      const result2 = await extractTypes({ directory: tempDir });
      const result3 = await extractTypes({ directory: tempDir });

      assert.deepStrictEqual(result1, result2);
      assert.deepStrictEqual(result2, result3);
    });
  });

  describe("type conversion verification", () => {
    it("should correctly convert all primitive types", async () => {
      await writeFile(
        join(tempDir, "primitives.ts"),
        `
        export interface AllPrimitives {
          stringField: string;
          numberField: number;
          booleanField: boolean;
          nullableString: string | null;
          optionalNumber?: number;
          stringArray: string[];
          nullableArray: (number | null)[];
        }
        `,
      );

      const result = await extractTypes({ directory: tempDir });

      assert.strictEqual(result.types.length, 1);
      const type = result.types[0];
      assert.ok(type?.fields);

      const stringField = type.fields.find((f) => f.name === "stringField");
      assert.strictEqual(stringField?.type.typeName, "String");
      assert.strictEqual(stringField?.type.nullable, false);
      assert.strictEqual(stringField?.type.list, false);

      const numberField = type.fields.find((f) => f.name === "numberField");
      assert.strictEqual(numberField?.type.typeName, "Int");

      const booleanField = type.fields.find((f) => f.name === "booleanField");
      assert.strictEqual(booleanField?.type.typeName, "Boolean");

      const nullableString = type.fields.find(
        (f) => f.name === "nullableString",
      );
      assert.strictEqual(nullableString?.type.nullable, true);

      const optionalNumber = type.fields.find(
        (f) => f.name === "optionalNumber",
      );
      assert.strictEqual(optionalNumber?.type.nullable, true);

      const stringArray = type.fields.find((f) => f.name === "stringArray");
      assert.strictEqual(stringArray?.type.list, true);
      assert.strictEqual(stringArray?.type.typeName, "String");

      const nullableArray = type.fields.find((f) => f.name === "nullableArray");
      assert.strictEqual(nullableArray?.type.list, true);
      assert.strictEqual(nullableArray?.type.listItemNullable, true);
    });

    it("should correctly convert object and interface types", async () => {
      await writeFile(
        join(tempDir, "types.ts"),
        `
        export interface InterfaceType { id: string; }
        export type ObjectType = { name: string; };
        `,
      );

      const result = await extractTypes({ directory: tempDir });

      assert.strictEqual(result.types.length, 2);
      assert.ok(result.types.every((t) => t.kind === "Object"));
    });

    it("should correctly convert union types", async () => {
      await writeFile(
        join(tempDir, "union.ts"),
        `
        export interface Cat { meow: string; }
        export interface Dog { bark: string; }
        export type Pet = Cat | Dog;
        `,
      );

      const result = await extractTypes({ directory: tempDir });

      const unionType = result.types.find((t) => t.name === "Pet");
      assert.ok(unionType);
      assert.strictEqual(unionType.kind, "Union");
      assert.ok(unionType.unionMembers?.includes("Cat"));
      assert.ok(unionType.unionMembers?.includes("Dog"));
      assert.strictEqual(unionType.fields, undefined);
    });
  });

  describe("error collection verification", () => {
    it("should collect and report all errors without stopping", async () => {
      await writeFile(
        join(tempDir, "reserved.ts"),
        `export interface String { value: string; }`,
      );
      await writeFile(
        join(tempDir, "unresolved.ts"),
        `export interface HasUnresolved { ref: NonExistent; }`,
      );
      await writeFile(
        join(tempDir, "generic.ts"),
        `export interface Generic<T> { value: T; }`,
      );

      const result = await extractTypes({ directory: tempDir });

      assert.ok(result.diagnostics.errors.length >= 2);
      assert.ok(
        result.diagnostics.errors.some((e) => e.code === "RESERVED_TYPE_NAME"),
      );
      assert.ok(
        result.diagnostics.errors.some(
          (e) => e.code === "UNRESOLVED_REFERENCE",
        ),
      );
      assert.ok(
        result.diagnostics.warnings.some(
          (w) => w.code === "UNSUPPORTED_SYNTAX",
        ),
      );
    });
  });

  describe("enum type extraction", () => {
    it("should extract TypeScript string enum as GraphQL enum", async () => {
      await writeFile(
        join(tempDir, "status.ts"),
        `export enum Status { Active = "active", Inactive = "inactive", Pending = "pending" }`,
      );

      const result = await extractTypes({ directory: tempDir });

      assert.strictEqual(result.types.length, 1);
      assert.strictEqual(result.types[0]?.kind, "Enum");
      assert.strictEqual(result.types[0]?.name, "Status");
      assert.strictEqual(result.types[0]?.enumValues?.length, 3);
      assert.strictEqual(result.types[0]?.enumValues?.[0]?.name, "ACTIVE");
      assert.strictEqual(
        result.types[0]?.enumValues?.[0]?.originalValue,
        "active",
      );
    });

    it("should extract string literal union as GraphQL enum", async () => {
      await writeFile(
        join(tempDir, "role.ts"),
        `export type Role = "admin" | "user" | "guest";`,
      );

      const result = await extractTypes({ directory: tempDir });

      assert.strictEqual(result.types.length, 1);
      assert.strictEqual(result.types[0]?.kind, "Enum");
      assert.strictEqual(result.types[0]?.name, "Role");
      assert.strictEqual(result.types[0]?.enumValues?.length, 3);
    });

    it("should convert enum member names to SCREAMING_SNAKE_CASE", async () => {
      await writeFile(
        join(tempDir, "case.ts"),
        `export enum UserStatus { superAdmin = "superAdmin", normalUser = "normalUser" }`,
      );

      const result = await extractTypes({ directory: tempDir });

      assert.strictEqual(result.types[0]?.enumValues?.[0]?.name, "SUPER_ADMIN");
      assert.strictEqual(result.types[0]?.enumValues?.[1]?.name, "NORMAL_USER");
    });

    it("should report error for numeric enum", async () => {
      await writeFile(
        join(tempDir, "numeric.ts"),
        `export enum Priority { Low, Medium, High }`,
      );

      const result = await extractTypes({ directory: tempDir });

      assert.strictEqual(result.types.length, 0);
      assert.ok(
        result.diagnostics.errors.some(
          (e) => e.code === "UNSUPPORTED_ENUM_TYPE",
        ),
      );
    });

    it("should report error for const enum", async () => {
      await writeFile(
        join(tempDir, "const.ts"),
        `export const enum Direction { Up = "up", Down = "down" }`,
      );

      const result = await extractTypes({ directory: tempDir });

      assert.strictEqual(result.types.length, 0);
      assert.ok(
        result.diagnostics.errors.some(
          (e) => e.code === "UNSUPPORTED_ENUM_TYPE",
        ),
      );
    });

    it("should handle enum alongside other types", async () => {
      await writeFile(
        join(tempDir, "mixed.ts"),
        `
        export enum Status { Active = "active", Inactive = "inactive" }
        export interface User { id: string; name: string; }
        export type SearchResult = User | Post;
        export interface Post { title: string; }
        `,
      );

      const result = await extractTypes({ directory: tempDir });

      assert.strictEqual(result.types.length, 4);

      const status = result.types.find((t) => t.name === "Status");
      assert.ok(status);
      assert.strictEqual(status.kind, "Enum");

      const user = result.types.find((t) => t.name === "User");
      assert.ok(user);
      assert.strictEqual(user.kind, "Object");

      const searchResult = result.types.find((t) => t.name === "SearchResult");
      assert.ok(searchResult);
      assert.strictEqual(searchResult.kind, "Union");
    });

    it("should report error for invalid enum member name", async () => {
      await writeFile(
        join(tempDir, "invalid.ts"),
        `export type Invalid = "123abc" | "valid";`,
      );

      const result = await extractTypes({ directory: tempDir });

      assert.ok(
        result.diagnostics.errors.some((e) => e.code === "INVALID_ENUM_MEMBER"),
      );
    });
  });
});
