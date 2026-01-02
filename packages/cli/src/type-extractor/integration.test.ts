import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

      expect(result.types.length).toBe(3);
      expect(result.diagnostics.errors.length).toBe(0);

      const user = result.types.find((t) => t.name === "User");
      expect(user).toBeDefined();
      expect(user.kind).toBe("Object");

      const emailField = user.fields?.find((f) => f.name === "email");
      expect(emailField).toBeDefined();
      expect(emailField.type.nullable).toBe(true);

      const postsField = user.fields?.find((f) => f.name === "posts");
      expect(postsField).toBeDefined();
      expect(postsField.type.list).toBe(true);
      expect(postsField.type.typeName).toBe("Post");
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

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
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

      expect(result.types.length).toBe(1);
      const type = result.types[0];
      expect(type?.fields).toBeDefined();

      const stringField = type.fields.find((f) => f.name === "stringField");
      expect(stringField?.type.typeName).toBe("String");
      expect(stringField?.type.nullable).toBe(false);
      expect(stringField?.type.list).toBe(false);

      const numberField = type.fields.find((f) => f.name === "numberField");
      expect(numberField?.type.typeName).toBe("Float");

      const booleanField = type.fields.find((f) => f.name === "booleanField");
      expect(booleanField?.type.typeName).toBe("Boolean");

      const nullableString = type.fields.find(
        (f) => f.name === "nullableString",
      );
      expect(nullableString?.type.nullable).toBe(true);

      const optionalNumber = type.fields.find(
        (f) => f.name === "optionalNumber",
      );
      expect(optionalNumber?.type.nullable).toBe(true);

      const stringArray = type.fields.find((f) => f.name === "stringArray");
      expect(stringArray?.type.list).toBe(true);
      expect(stringArray?.type.typeName).toBe("String");

      const nullableArray = type.fields.find((f) => f.name === "nullableArray");
      expect(nullableArray?.type.list).toBe(true);
      expect(nullableArray?.type.listItemNullable).toBe(true);
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

      expect(result.types.length).toBe(2);
      expect(result.types.every((t) => t.kind === "Object")).toBeTruthy();
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
      expect(unionType).toBeDefined();
      expect(unionType.kind).toBe("Union");
      expect(unionType.unionMembers?.includes("Cat")).toBeTruthy();
      expect(unionType.unionMembers?.includes("Dog")).toBeTruthy();
      expect(unionType.fields).toBeUndefined();
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

      expect(result.diagnostics.errors.length >= 2).toBeTruthy();
      expect(
        result.diagnostics.errors.some((e) => e.code === "RESERVED_TYPE_NAME"),
      ).toBeTruthy();
      expect(
        result.diagnostics.errors.some(
          (e) => e.code === "UNRESOLVED_REFERENCE",
        ),
      ).toBeTruthy();
      expect(
        result.diagnostics.warnings.some(
          (w) => w.code === "UNSUPPORTED_SYNTAX",
        ),
      ).toBeTruthy();
    });
  });

  describe("enum type extraction", () => {
    it("should extract TypeScript string enum as GraphQL enum", async () => {
      await writeFile(
        join(tempDir, "status.ts"),
        `export enum Status { Active = "active", Inactive = "inactive", Pending = "pending" }`,
      );

      const result = await extractTypes({ directory: tempDir });

      expect(result.types.length).toBe(1);
      expect(result.types[0]?.kind).toBe("Enum");
      expect(result.types[0]?.name).toBe("Status");
      expect(result.types[0]?.enumValues?.length).toBe(3);
      expect(result.types[0]?.enumValues?.[0]?.name).toBe("ACTIVE");
      expect(result.types[0]?.enumValues?.[0]?.originalValue).toBe("active");
    });

    it("should extract string literal union as GraphQL enum", async () => {
      await writeFile(
        join(tempDir, "role.ts"),
        `export type Role = "admin" | "user" | "guest";`,
      );

      const result = await extractTypes({ directory: tempDir });

      expect(result.types.length).toBe(1);
      expect(result.types[0]?.kind).toBe("Enum");
      expect(result.types[0]?.name).toBe("Role");
      expect(result.types[0]?.enumValues?.length).toBe(3);
    });

    it("should convert enum member names to SCREAMING_SNAKE_CASE", async () => {
      await writeFile(
        join(tempDir, "case.ts"),
        `export enum UserStatus { superAdmin = "superAdmin", normalUser = "normalUser" }`,
      );

      const result = await extractTypes({ directory: tempDir });

      expect(result.types[0]?.enumValues?.[0]?.name).toBe("SUPER_ADMIN");
      expect(result.types[0]?.enumValues?.[1]?.name).toBe("NORMAL_USER");
    });

    it("should report error for numeric enum", async () => {
      await writeFile(
        join(tempDir, "numeric.ts"),
        `export enum Priority { Low, Medium, High }`,
      );

      const result = await extractTypes({ directory: tempDir });

      expect(result.types.length).toBe(0);
      expect(
        result.diagnostics.errors.some(
          (e) => e.code === "UNSUPPORTED_ENUM_TYPE",
        ),
      ).toBeTruthy();
    });

    it("should report error for const enum", async () => {
      await writeFile(
        join(tempDir, "const.ts"),
        `export const enum Direction { Up = "up", Down = "down" }`,
      );

      const result = await extractTypes({ directory: tempDir });

      expect(result.types.length).toBe(0);
      expect(
        result.diagnostics.errors.some(
          (e) => e.code === "UNSUPPORTED_ENUM_TYPE",
        ),
      ).toBeTruthy();
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

      expect(result.types.length).toBe(4);

      const status = result.types.find((t) => t.name === "Status");
      expect(status).toBeDefined();
      expect(status.kind).toBe("Enum");

      const user = result.types.find((t) => t.name === "User");
      expect(user).toBeDefined();
      expect(user.kind).toBe("Object");

      const searchResult = result.types.find((t) => t.name === "SearchResult");
      expect(searchResult).toBeDefined();
      expect(searchResult.kind).toBe("Union");
    });

    it("should report error for invalid enum member name", async () => {
      await writeFile(
        join(tempDir, "invalid.ts"),
        `export type Invalid = "123abc" | "valid";`,
      );

      const result = await extractTypes({ directory: tempDir });

      expect(
        result.diagnostics.errors.some((e) => e.code === "INVALID_ENUM_MEMBER"),
      ).toBeTruthy();
    });
  });

  describe("branded scalar type extraction", () => {
    it("should convert IDString to GraphQL ID scalar", async () => {
      await writeFile(
        join(tempDir, "user.ts"),
        `
import type { IDString } from "@gqlkit-ts/runtime";
export interface User {
  id: IDString;
  name: string;
}
`,
      );

      const result = await extractTypes({ directory: tempDir });

      expect(result.types.length).toBe(1);
      const user = result.types[0];
      expect(user).toBeDefined();

      const idField = user.fields?.find((f) => f.name === "id");
      expect(idField).toBeDefined();
      expect(idField.type.typeName).toBe("ID");
      expect(idField.type.nullable).toBe(false);
    });

    it("should convert Int and Float to corresponding GraphQL scalars", async () => {
      await writeFile(
        join(tempDir, "product.ts"),
        `
import type { Int, Float } from "@gqlkit-ts/runtime";
export interface Product {
  count: Int;
  price: Float;
  regularNumber: number;
}
`,
      );

      const result = await extractTypes({ directory: tempDir });

      expect(result.types.length).toBe(1);
      const product = result.types[0];
      expect(product).toBeDefined();

      const countField = product.fields?.find((f) => f.name === "count");
      expect(countField).toBeDefined();
      expect(countField.type.typeName).toBe("Int");

      const priceField = product.fields?.find((f) => f.name === "price");
      expect(priceField).toBeDefined();
      expect(priceField.type.typeName).toBe("Float");

      const regularNumberField = product.fields?.find(
        (f) => f.name === "regularNumber",
      );
      expect(regularNumberField).toBeDefined();
      expect(regularNumberField.type.typeName).toBe("Float");
    });

    it("should handle branded scalar types in arrays", async () => {
      await writeFile(
        join(tempDir, "collection.ts"),
        `
import type { IDString, Int } from "@gqlkit-ts/runtime";
export interface Collection {
  ids: IDString[];
  counts: Int[];
}
`,
      );

      const result = await extractTypes({ directory: tempDir });

      expect(result.types.length).toBe(1);
      const collection = result.types[0];
      expect(collection).toBeDefined();

      const idsField = collection.fields?.find((f) => f.name === "ids");
      expect(idsField).toBeDefined();
      expect(idsField.type.list).toBe(true);
      expect(idsField.type.typeName).toBe("ID");

      const countsField = collection.fields?.find((f) => f.name === "counts");
      expect(countsField).toBeDefined();
      expect(countsField.type.list).toBe(true);
      expect(countsField.type.typeName).toBe("Int");
    });

    it("should handle nullable branded scalar types", async () => {
      await writeFile(
        join(tempDir, "nullable.ts"),
        `
import type { IDString, Float } from "@gqlkit-ts/runtime";
export interface NullableFields {
  optionalId?: IDString;
  nullablePrice: Float | null;
}
`,
      );

      const result = await extractTypes({ directory: tempDir });

      expect(result.types.length).toBe(1);
      const type = result.types[0];
      expect(type).toBeDefined();

      const optionalIdField = type.fields?.find((f) => f.name === "optionalId");
      expect(optionalIdField).toBeDefined();
      expect(optionalIdField.type.typeName).toBe("ID");
      expect(optionalIdField.type.nullable).toBe(true);

      const nullablePriceField = type.fields?.find(
        (f) => f.name === "nullablePrice",
      );
      expect(nullablePriceField).toBeDefined();
      expect(nullablePriceField.type.typeName).toBe("Float");
      expect(nullablePriceField.type.nullable).toBe(true);
    });
  });
});
