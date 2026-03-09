import { describe, expect, it } from "vitest";
import type { DiscriminatorResolveTypeInfo } from "../../auto-type-generator/discriminator-resolve-type-generator.js";
import { buildDiscriminatorResolveTypeEntry } from "./discriminator-resolve-type-emitter.js";

describe("buildDiscriminatorResolveTypeEntry", () => {
  describe("multiple discriminator fields (nested switch)", () => {
    it("generates nested switch statements for two discriminator fields", () => {
      const info: DiscriminatorResolveTypeInfo = {
        unionTypeName: "Content",
        fieldNames: ["type", "mediaType"],
        valueMappings: [
          { memberGraphQLTypeName: "ContentText", values: ["text", null] },
          {
            memberGraphQLTypeName: "ContentMediaJpeg",
            values: ["media", "jpeg"],
          },
          {
            memberGraphQLTypeName: "ContentMediaPng",
            values: ["media", "png"],
          },
        ],
      };

      const result = buildDiscriminatorResolveTypeEntry(info);

      // The outer switch is on obj.type, inner switch on obj.mediaType
      expect(result).toContain("Content:");
      expect(result).toContain("__resolveType:");
      expect(result).toContain("switch (obj.type)");
      expect(result).toContain('case "text": return "ContentText";');
      expect(result).toContain('case "media":');
      expect(result).toContain("switch (obj.mediaType)");
      expect(result).toContain('case "jpeg": return "ContentMediaJpeg";');
      expect(result).toContain('case "png": return "ContentMediaPng";');
      // Each switch must have a default
      const defaultCount = (result.match(/default: return undefined;/g) ?? [])
        .length;
      expect(defaultCount).toBe(2);
    });

    it("generates nested switch for three discriminator fields", () => {
      const info: DiscriminatorResolveTypeInfo = {
        unionTypeName: "Message",
        fieldNames: ["category", "type", "subType"],
        valueMappings: [
          {
            memberGraphQLTypeName: "MessageSystemInfo",
            values: ["system", "info", "detail"],
          },
          {
            memberGraphQLTypeName: "MessageSystemWarn",
            values: ["system", "warn", null],
          },
          {
            memberGraphQLTypeName: "MessageUser",
            values: ["user", null, null],
          },
        ],
      };

      const result = buildDiscriminatorResolveTypeEntry(info);

      expect(result).toContain("switch (obj.category)");
      expect(result).toContain('case "system":');
      expect(result).toContain("switch (obj.type)");
      expect(result).toContain('case "info":');
      expect(result).toContain("switch (obj.subType)");
      expect(result).toContain('case "detail": return "MessageSystemInfo";');
      expect(result).toContain('case "warn": return "MessageSystemWarn";');
      expect(result).toContain('case "user": return "MessageUser";');
      // Three levels of switch -> three defaults
      const defaultCount = (result.match(/default: return undefined;/g) ?? [])
        .length;
      expect(defaultCount).toBe(3);
    });

    it("handles null values by returning directly without further nesting", () => {
      // When a member has null for a discriminator field, it means that field
      // does not exist on that member. The outer switch case should return directly.
      const info: DiscriminatorResolveTypeInfo = {
        unionTypeName: "Content",
        fieldNames: ["type", "mediaType"],
        valueMappings: [
          { memberGraphQLTypeName: "ContentText", values: ["text", null] },
          {
            memberGraphQLTypeName: "ContentImage",
            values: ["image", "jpeg"],
          },
        ],
      };

      const result = buildDiscriminatorResolveTypeEntry(info);

      // "text" has null for mediaType -> should return directly
      expect(result).toContain('case "text": return "ContentText";');
      // "image" has "jpeg" -> should have nested switch
      expect(result).toContain('case "image":');
      expect(result).toContain("switch (obj.mediaType)");
      expect(result).toContain('case "jpeg": return "ContentImage";');
    });

    it("generates correct obj type annotation with all discriminator fields", () => {
      const info: DiscriminatorResolveTypeInfo = {
        unionTypeName: "Content",
        fieldNames: ["type", "mediaType"],
        valueMappings: [
          { memberGraphQLTypeName: "ContentText", values: ["text", null] },
          {
            memberGraphQLTypeName: "ContentMediaJpeg",
            values: ["media", "jpeg"],
          },
        ],
      };

      const result = buildDiscriminatorResolveTypeEntry(info);

      // Should include type annotations for all discriminator fields
      expect(result).toContain("type: string");
      expect(result).toContain("mediaType: string");
    });
  });
});
