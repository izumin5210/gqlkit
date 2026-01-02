import { describe, expect, it } from "vitest";
import type {
  EnumMemberInfo,
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
      expect(kind).toBe("object");
    });

    it("should support interface kind", () => {
      const kind: TypeKind = "interface";
      expect(kind).toBe("interface");
    });

    it("should support union kind", () => {
      const kind: TypeKind = "union";
      expect(kind).toBe("union");
    });

    it("should support enum kind", () => {
      const kind: TypeKind = "enum";
      expect(kind).toBe("enum");
    });
  });

  describe("TypeMetadata", () => {
    it("should have name, kind, sourceFile, and exportKind properties", () => {
      const metadata: TypeMetadata = {
        name: "User",
        kind: "interface",
        sourceFile: "/path/to/user.ts",
        exportKind: "named",
        description: null,
        deprecated: null,
      };

      expect(metadata.name).toBe("User");
      expect(metadata.kind).toBe("interface");
      expect(metadata.sourceFile).toBe("/path/to/user.ts");
      expect(metadata.exportKind).toBe("named");
    });

    it("should support default export", () => {
      const metadata: TypeMetadata = {
        name: "Config",
        kind: "object",
        sourceFile: "/path/to/config.ts",
        exportKind: "default",
        description: null,
        deprecated: null,
      };

      expect(metadata.exportKind).toBe("default");
    });
  });

  describe("TSTypeReference", () => {
    it("should represent primitive type", () => {
      const ref: TSTypeReference = {
        kind: "primitive",
        name: "string",
        nullable: false,
        elementType: null,
        members: null,
        scalarInfo: null,
      };

      expect(ref.kind).toBe("primitive");
      expect(ref.name).toBe("string");
      expect(ref.nullable).toBe(false);
    });

    it("should represent reference type", () => {
      const ref: TSTypeReference = {
        kind: "reference",
        name: "User",
        nullable: false,
        elementType: null,
        members: null,
        scalarInfo: null,
      };

      expect(ref.kind).toBe("reference");
      expect(ref.name).toBe("User");
    });

    it("should represent array type", () => {
      const ref: TSTypeReference = {
        kind: "array",
        elementType: {
          kind: "reference",
          name: "Post",
          nullable: false,
          elementType: null,
          members: null,
          scalarInfo: null,
        },
        nullable: false,
        name: null,
        members: null,
        scalarInfo: null,
      };

      expect(ref.kind).toBe("array");
      expect(ref.elementType?.kind).toBe("reference");
      expect(ref.elementType?.name).toBe("Post");
    });

    it("should represent union type with members", () => {
      const ref: TSTypeReference = {
        kind: "union",
        members: [
          {
            kind: "reference",
            name: "User",
            nullable: false,
            elementType: null,
            members: null,
            scalarInfo: null,
          },
          {
            kind: "reference",
            name: "Post",
            nullable: false,
            elementType: null,
            members: null,
            scalarInfo: null,
          },
        ],
        nullable: false,
        name: null,
        elementType: null,
        scalarInfo: null,
      };

      expect(ref.kind).toBe("union");
      expect(ref.members?.length).toBe(2);
    });

    it("should represent literal type", () => {
      const ref: TSTypeReference = {
        kind: "literal",
        name: "active",
        nullable: false,
        elementType: null,
        members: null,
        scalarInfo: null,
      };

      expect(ref.kind).toBe("literal");
      expect(ref.name).toBe("active");
    });

    it("should support nullable property", () => {
      const ref: TSTypeReference = {
        kind: "primitive",
        name: "string",
        nullable: true,
        elementType: null,
        members: null,
        scalarInfo: null,
      };

      expect(ref.nullable).toBe(true);
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
          elementType: null,
          members: null,
          scalarInfo: null,
        },
        optional: false,
        description: null,
        deprecated: null,
      };

      expect(field.name).toBe("id");
      expect(field.tsType.kind).toBe("primitive");
      expect(field.optional).toBe(false);
    });

    it("should support optional fields", () => {
      const field: FieldDefinition = {
        name: "nickname",
        tsType: {
          kind: "primitive",
          name: "string",
          nullable: false,
          elementType: null,
          members: null,
          scalarInfo: null,
        },
        optional: true,
        description: null,
        deprecated: null,
      };

      expect(field.optional).toBe(true);
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
          description: null,
          deprecated: null,
        },
        fields: [
          {
            name: "id",
            tsType: {
              kind: "primitive",
              name: "string",
              nullable: false,
              elementType: null,
              members: null,
              scalarInfo: null,
            },
            optional: false,
            description: null,
            deprecated: null,
          },
          {
            name: "name",
            tsType: {
              kind: "primitive",
              name: "string",
              nullable: true,
              elementType: null,
              members: null,
              scalarInfo: null,
            },
            optional: false,
            description: null,
            deprecated: null,
          },
        ],
        unionMembers: null,
        enumMembers: null,
      };

      expect(typeInfo.metadata.name).toBe("User");
      expect(typeInfo.fields.length).toBe(2);
      expect(typeInfo.unionMembers).toBe(null);
    });

    it("should represent union type with members", () => {
      const typeInfo: ExtractedTypeInfo = {
        metadata: {
          name: "SearchResult",
          kind: "union",
          sourceFile: "/path/to/search-result.ts",
          exportKind: "named",
          description: null,
          deprecated: null,
        },
        fields: [],
        unionMembers: ["User", "Post"],
        enumMembers: null,
      };

      expect(typeInfo.metadata.kind).toBe("union");
      expect(typeInfo.unionMembers).toEqual(["User", "Post"]);
      expect(typeInfo.fields.length).toBe(0);
    });

    it("should represent enum type with members", () => {
      const typeInfo: ExtractedTypeInfo = {
        metadata: {
          name: "Status",
          kind: "enum",
          sourceFile: "/path/to/status.ts",
          exportKind: "named",
          description: null,
          deprecated: null,
        },
        fields: [],
        unionMembers: null,
        enumMembers: [
          {
            name: "Active",
            value: "active",
            description: null,
            deprecated: null,
          },
          {
            name: "Inactive",
            value: "inactive",
            description: null,
            deprecated: null,
          },
        ],
      };

      expect(typeInfo.metadata.kind).toBe("enum");
      expect(typeInfo.enumMembers?.length).toBe(2);
      expect(typeInfo.enumMembers?.[0]?.name).toBe("Active");
      expect(typeInfo.enumMembers?.[0]?.value).toBe("active");
    });
  });

  describe("EnumMemberInfo", () => {
    it("should have name and value properties", () => {
      const member: EnumMemberInfo = {
        name: "Active",
        value: "active",
        description: null,
        deprecated: null,
      };

      expect(member.name).toBe("Active");
      expect(member.value).toBe("active");
    });

    it("should support string enum values", () => {
      const member: EnumMemberInfo = {
        name: "StatusActive",
        value: "ACTIVE",
        description: null,
        deprecated: null,
      };

      expect(member.name).toBe("StatusActive");
      expect(member.value).toBe("ACTIVE");
    });
  });
});
