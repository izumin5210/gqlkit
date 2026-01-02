import { describe, expect, it } from "vitest";
import type { ExtractedTypeInfo } from "../../type-extractor/types/index.js";
import { resolveParentType } from "./parent-type-resolver.js";

function createMockTypeInfo(name: string): ExtractedTypeInfo {
  return {
    metadata: {
      name,
      kind: "object",
      sourceFile: "types/" + name.toLowerCase() + ".ts",
      exportKind: "named",
    },
    fields: [],
  };
}

describe("resolveParentType", () => {
  describe("successful resolution", () => {
    it("should resolve parent type when it exists in type definitions", () => {
      const parentTsType = {
        kind: "reference" as const,
        name: "User",
        nullable: false,
      };
      const typeDefinitions = [
        createMockTypeInfo("User"),
        createMockTypeInfo("Post"),
      ];

      const result = resolveParentType(
        parentTsType,
        typeDefinitions,
        "resolvers/user.ts",
      );

      expect(result.success).toBe(true);
      expect(result.graphqlTypeName).toBe("User");
      expect(result.diagnostic).toBe(undefined);
    });

    it("should resolve parent type with different source file", () => {
      const parentTsType = {
        kind: "reference" as const,
        name: "Post",
        nullable: false,
      };
      const typeDefinitions = [
        createMockTypeInfo("User"),
        createMockTypeInfo("Post"),
      ];

      const result = resolveParentType(
        parentTsType,
        typeDefinitions,
        "resolvers/post-fields.ts",
      );

      expect(result.success).toBe(true);
      expect(result.graphqlTypeName).toBe("Post");
    });
  });

  describe("failed resolution", () => {
    it("should return diagnostic when parent type is not found", () => {
      const parentTsType = {
        kind: "reference" as const,
        name: "Comment",
        nullable: false,
      };
      const typeDefinitions = [
        createMockTypeInfo("User"),
        createMockTypeInfo("Post"),
      ];

      const result = resolveParentType(
        parentTsType,
        typeDefinitions,
        "resolvers/comment.ts",
      );

      expect(result.success).toBe(false);
      expect(result.graphqlTypeName).toBe(undefined);
      expect(result.diagnostic).toBeTruthy();
      expect(result.diagnostic!.code).toBe("MISSING_PARENT_TYPE");
      expect(result.diagnostic!.message).toContain("Comment");
    });

    it("should return diagnostic when type reference has no name", () => {
      const parentTsType = {
        kind: "reference" as const,
        nullable: false,
      };
      const typeDefinitions = [createMockTypeInfo("User")];

      const result = resolveParentType(
        parentTsType,
        typeDefinitions,
        "resolvers/unknown.ts",
      );

      expect(result.success).toBe(false);
      expect(result.diagnostic).toBeTruthy();
      expect(result.diagnostic!.code).toBe("MISSING_PARENT_TYPE");
    });
  });

  describe("edge cases", () => {
    it("should handle empty type definitions", () => {
      const parentTsType = {
        kind: "reference" as const,
        name: "User",
        nullable: false,
      };
      const typeDefinitions: ExtractedTypeInfo[] = [];

      const result = resolveParentType(
        parentTsType,
        typeDefinitions,
        "resolvers/user.ts",
      );

      expect(result.success).toBe(false);
      expect(result.diagnostic).toBeTruthy();
    });

    it("should handle nullable parent type reference", () => {
      const parentTsType = {
        kind: "reference" as const,
        name: "User",
        nullable: true,
      };
      const typeDefinitions = [createMockTypeInfo("User")];

      const result = resolveParentType(
        parentTsType,
        typeDefinitions,
        "resolvers/user.ts",
      );

      expect(result.success).toBe(true);
      expect(result.graphqlTypeName).toBe("User");
    });
  });
});
