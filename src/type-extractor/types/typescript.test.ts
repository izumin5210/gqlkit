import assert from "node:assert";
import { describe, it } from "node:test";
import type {
  ExtractedTypeInfo,
  FieldDefinition,
  TSTypeReference,
  TypeKind,
  TypeMetadata,
} from "./typescript.js";

describe("TypeScript types", () => {
  describe("TypeKind", () => {
    it("should support object kind", () => {
      const kind: TypeKind = "object";
      assert.strictEqual(kind, "object");
    });

    it("should support interface kind", () => {
      const kind: TypeKind = "interface";
      assert.strictEqual(kind, "interface");
    });

    it("should support union kind", () => {
      const kind: TypeKind = "union";
      assert.strictEqual(kind, "union");
    });
  });

  describe("TypeMetadata", () => {
    it("should have name, kind, sourceFile, and exportKind properties", () => {
      const metadata: TypeMetadata = {
        name: "User",
        kind: "interface",
        sourceFile: "/path/to/user.ts",
        exportKind: "named",
      };

      assert.strictEqual(metadata.name, "User");
      assert.strictEqual(metadata.kind, "interface");
      assert.strictEqual(metadata.sourceFile, "/path/to/user.ts");
      assert.strictEqual(metadata.exportKind, "named");
    });

    it("should support default export", () => {
      const metadata: TypeMetadata = {
        name: "Config",
        kind: "object",
        sourceFile: "/path/to/config.ts",
        exportKind: "default",
      };

      assert.strictEqual(metadata.exportKind, "default");
    });
  });

  describe("TSTypeReference", () => {
    it("should represent primitive type", () => {
      const ref: TSTypeReference = {
        kind: "primitive",
        name: "string",
        nullable: false,
      };

      assert.strictEqual(ref.kind, "primitive");
      assert.strictEqual(ref.name, "string");
      assert.strictEqual(ref.nullable, false);
    });

    it("should represent reference type", () => {
      const ref: TSTypeReference = {
        kind: "reference",
        name: "User",
        nullable: false,
      };

      assert.strictEqual(ref.kind, "reference");
      assert.strictEqual(ref.name, "User");
    });

    it("should represent array type", () => {
      const ref: TSTypeReference = {
        kind: "array",
        elementType: {
          kind: "reference",
          name: "Post",
          nullable: false,
        },
        nullable: false,
      };

      assert.strictEqual(ref.kind, "array");
      assert.strictEqual(ref.elementType?.kind, "reference");
      assert.strictEqual(ref.elementType?.name, "Post");
    });

    it("should represent union type with members", () => {
      const ref: TSTypeReference = {
        kind: "union",
        members: [
          { kind: "reference", name: "User", nullable: false },
          { kind: "reference", name: "Post", nullable: false },
        ],
        nullable: false,
      };

      assert.strictEqual(ref.kind, "union");
      assert.strictEqual(ref.members?.length, 2);
    });

    it("should represent literal type", () => {
      const ref: TSTypeReference = {
        kind: "literal",
        name: "active",
        nullable: false,
      };

      assert.strictEqual(ref.kind, "literal");
      assert.strictEqual(ref.name, "active");
    });

    it("should support nullable property", () => {
      const ref: TSTypeReference = {
        kind: "primitive",
        name: "string",
        nullable: true,
      };

      assert.strictEqual(ref.nullable, true);
    });
  });

  describe("FieldDefinition", () => {
    it("should have name, tsType, and optional properties", () => {
      const field: FieldDefinition = {
        name: "id",
        tsType: {
          kind: "primitive",
          name: "string",
          nullable: false,
        },
        optional: false,
      };

      assert.strictEqual(field.name, "id");
      assert.strictEqual(field.tsType.kind, "primitive");
      assert.strictEqual(field.optional, false);
    });

    it("should support optional fields", () => {
      const field: FieldDefinition = {
        name: "nickname",
        tsType: {
          kind: "primitive",
          name: "string",
          nullable: false,
        },
        optional: true,
      };

      assert.strictEqual(field.optional, true);
    });
  });

  describe("ExtractedTypeInfo", () => {
    it("should represent object/interface with fields", () => {
      const typeInfo: ExtractedTypeInfo = {
        metadata: {
          name: "User",
          kind: "interface",
          sourceFile: "/path/to/user.ts",
          exportKind: "named",
        },
        fields: [
          {
            name: "id",
            tsType: { kind: "primitive", name: "string", nullable: false },
            optional: false,
          },
          {
            name: "name",
            tsType: { kind: "primitive", name: "string", nullable: true },
            optional: false,
          },
        ],
      };

      assert.strictEqual(typeInfo.metadata.name, "User");
      assert.strictEqual(typeInfo.fields.length, 2);
      assert.strictEqual(typeInfo.unionMembers, undefined);
    });

    it("should represent union type with members", () => {
      const typeInfo: ExtractedTypeInfo = {
        metadata: {
          name: "SearchResult",
          kind: "union",
          sourceFile: "/path/to/search-result.ts",
          exportKind: "named",
        },
        fields: [],
        unionMembers: ["User", "Post"],
      };

      assert.strictEqual(typeInfo.metadata.kind, "union");
      assert.deepStrictEqual(typeInfo.unionMembers, ["User", "Post"]);
      assert.strictEqual(typeInfo.fields.length, 0);
    });
  });
});
