import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ExtractedResolvers } from "./resolver-extractor.js";
import type { ExtractDefineApiResult } from "./define-api-extractor.js";
import { validateApiStyleConsistency } from "./mixed-api-validator.js";

function createLegacyResolvers(
  count: number,
): ExtractedResolvers {
  const resolvers = [];
  for (let i = 0; i < count; i++) {
    resolvers.push({
      typeName: `TestResolver${i}`,
      valueName: `testResolver${i}`,
      category: "type" as const,
      targetTypeName: `Test${i}`,
      typeSymbol: {} as never,
      valueSymbol: {} as never,
      sourceFile: `resolvers/test${i}.ts`,
    });
  }
  return {
    resolvers,
    diagnostics: [],
  };
}

function createDefineApiResolvers(
  count: number,
): ExtractDefineApiResult {
  const resolvers = [];
  for (let i = 0; i < count; i++) {
    resolvers.push({
      fieldName: `field${i}`,
      resolverType: "query" as const,
      returnType: { kind: "reference" as const, name: "String", nullable: false },
      sourceFile: `resolvers/field${i}.ts`,
      exportedInputTypes: [],
    });
  }
  return {
    resolvers,
    diagnostics: [],
  };
}

describe("validateApiStyleConsistency", () => {
  describe("valid scenarios", () => {
    it("should pass when only define* API is used", () => {
      const legacyResolvers = createLegacyResolvers(0);
      const defineApiResolvers = createDefineApiResolvers(3);

      const result = validateApiStyleConsistency(
        legacyResolvers,
        defineApiResolvers,
      );

      assert.equal(result.valid, true);
      assert.equal(result.diagnostic, undefined);
      assert.equal(result.detectedStyles.length, 1);
      assert.equal(result.detectedStyles[0]!.style, "define-api");
    });

    it("should pass when only legacy API is used", () => {
      const legacyResolvers = createLegacyResolvers(3);
      const defineApiResolvers = createDefineApiResolvers(0);

      const result = validateApiStyleConsistency(
        legacyResolvers,
        defineApiResolvers,
      );

      assert.equal(result.valid, true);
      assert.equal(result.diagnostic, undefined);
      assert.equal(result.detectedStyles.length, 1);
      assert.equal(result.detectedStyles[0]!.style, "legacy");
    });

    it("should pass when no resolvers are found", () => {
      const legacyResolvers = createLegacyResolvers(0);
      const defineApiResolvers = createDefineApiResolvers(0);

      const result = validateApiStyleConsistency(
        legacyResolvers,
        defineApiResolvers,
      );

      assert.equal(result.valid, true);
      assert.equal(result.diagnostic, undefined);
      assert.equal(result.detectedStyles.length, 0);
    });
  });

  describe("mixed API detection", () => {
    it("should fail when both API styles are mixed", () => {
      const legacyResolvers = createLegacyResolvers(2);
      const defineApiResolvers = createDefineApiResolvers(2);

      const result = validateApiStyleConsistency(
        legacyResolvers,
        defineApiResolvers,
      );

      assert.equal(result.valid, false);
      assert.ok(result.diagnostic);
      assert.equal(result.diagnostic.code, "LEGACY_API_DETECTED");
      assert.equal(result.diagnostic.severity, "error");
    });

    it("should include migration guidance in error message", () => {
      const legacyResolvers = createLegacyResolvers(1);
      const defineApiResolvers = createDefineApiResolvers(1);

      const result = validateApiStyleConsistency(
        legacyResolvers,
        defineApiResolvers,
      );

      assert.ok(result.diagnostic);
      assert.ok(
        result.diagnostic.message.includes("defineQuery") ||
        result.diagnostic.message.includes("defineMutation") ||
        result.diagnostic.message.includes("defineField"),
      );
    });

    it("should report both styles when mixed", () => {
      const legacyResolvers = createLegacyResolvers(1);
      const defineApiResolvers = createDefineApiResolvers(1);

      const result = validateApiStyleConsistency(
        legacyResolvers,
        defineApiResolvers,
      );

      assert.equal(result.detectedStyles.length, 2);
      const styles = result.detectedStyles.map((s) => s.style);
      assert.ok(styles.includes("legacy"));
      assert.ok(styles.includes("define-api"));
    });

    it("should include locations of both styles", () => {
      const legacyResolvers = createLegacyResolvers(2);
      const defineApiResolvers = createDefineApiResolvers(2);

      const result = validateApiStyleConsistency(
        legacyResolvers,
        defineApiResolvers,
      );

      const legacyStyle = result.detectedStyles.find(
        (s) => s.style === "legacy",
      );
      const defineStyle = result.detectedStyles.find(
        (s) => s.style === "define-api",
      );

      assert.ok(legacyStyle);
      assert.ok(defineStyle);
      assert.equal(legacyStyle.locations.length, 2);
      assert.equal(defineStyle.locations.length, 2);
    });
  });
});
