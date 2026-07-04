import { describe, expect, it } from "vitest";
import { isEligibleField } from "./field-eligibility.js";

describe("isEligibleField", () => {
  describe("custom discriminator field names", () => {
    it("allows a valid GraphQL field name like 'type' as a discriminator field", () => {
      const result = isEligibleField({ fieldName: "type", kind: "object" });
      expect(result).toEqual({ eligible: true, skipReason: null });
    });

    it("allows a valid GraphQL field name like 'kind' as a discriminator field", () => {
      const result = isEligibleField({ fieldName: "kind", kind: "object" });
      expect(result).toEqual({ eligible: true, skipReason: null });
    });

    it("allows a valid GraphQL field name like 'mediaType' as a discriminator field", () => {
      const result = isEligibleField({
        fieldName: "mediaType",
        kind: "object",
      });
      expect(result).toEqual({ eligible: true, skipReason: null });
    });

    it("rejects a field name starting with '__' as reserved for GraphQL introspection", () => {
      const result = isEligibleField({ fieldName: "__kind", kind: "object" });
      expect(result).toEqual({
        eligible: false,
        skipReason: {
          code: "RESERVED_NAME",
          message:
            "Field '__kind' starts with '__' which is reserved for GraphQL introspection",
        },
      });
    });

    it("rejects '__type' as a reserved name", () => {
      const result = isEligibleField({ fieldName: "__type", kind: "object" });
      expect(result).toEqual({
        eligible: false,
        skipReason: {
          code: "RESERVED_NAME",
          message:
            "Field '__type' starts with '__' which is reserved for GraphQL introspection",
        },
      });
    });

    it("allows a single underscore prefix like '_type'", () => {
      const result = isEligibleField({ fieldName: "_type", kind: "object" });
      expect(result).toEqual({ eligible: true, skipReason: null });
    });
  });
});
