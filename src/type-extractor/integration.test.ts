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
});
