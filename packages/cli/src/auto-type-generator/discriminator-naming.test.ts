import { describe, expect, it } from "vitest";
import { generateDiscriminatorMemberName } from "./discriminator-naming.js";

describe("generateDiscriminatorMemberName", () => {
  describe("single discriminator field", () => {
    it("generates name by appending PascalCase value to union type name", () => {
      const result = generateDiscriminatorMemberName({
        unionTypeName: "ContentPart",
        values: ["text"],
      });
      expect(result).toBe("ContentPartText");
    });

    it("converts kebab-case value to PascalCase", () => {
      const result = generateDiscriminatorMemberName({
        unionTypeName: "ContentPart",
        values: ["rich-text"],
      });
      expect(result).toBe("ContentPartRichText");
    });

    it("converts snake_case value to PascalCase", () => {
      const result = generateDiscriminatorMemberName({
        unionTypeName: "ContentPart",
        values: ["rich_text"],
      });
      expect(result).toBe("ContentPartRichText");
    });

    it("converts camelCase value to PascalCase", () => {
      const result = generateDiscriminatorMemberName({
        unionTypeName: "ContentPart",
        values: ["richText"],
      });
      expect(result).toBe("ContentPartRichText");
    });
  });

  describe("multiple discriminator fields", () => {
    it("concatenates PascalCase values for multiple fields", () => {
      const result = generateDiscriminatorMemberName({
        unionTypeName: "Content",
        values: ["text", "plain"],
      });
      expect(result).toBe("ContentTextPlain");
    });

    it("concatenates multiple values with different casing", () => {
      const result = generateDiscriminatorMemberName({
        unionTypeName: "Content",
        values: ["media", "jpeg"],
      });
      expect(result).toBe("ContentMediaJpeg");
    });
  });

  describe("null value handling", () => {
    it("skips null values in the naming", () => {
      const result = generateDiscriminatorMemberName({
        unionTypeName: "Content",
        values: ["text", null],
      });
      expect(result).toBe("ContentText");
    });

    it("skips null values between non-null values", () => {
      const result = generateDiscriminatorMemberName({
        unionTypeName: "Content",
        values: ["media", null, "large"],
      });
      expect(result).toBe("ContentMediaLarge");
    });

    it("handles all-null secondary values (only primary remains)", () => {
      const result = generateDiscriminatorMemberName({
        unionTypeName: "Content",
        values: ["text", null, null],
      });
      expect(result).toBe("ContentText");
    });
  });
});
