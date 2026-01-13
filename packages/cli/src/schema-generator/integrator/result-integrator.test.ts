/**
 * Tests for result-integrator.ts
 *
 * These tests verify that the integrate function properly integrates
 * abstract type resolver validation into the pipeline.
 */

import { describe, expect, it } from "vitest";
import type { ExtractResolversResult } from "../../resolver-extractor/extract-resolvers.js";
import type { AbstractResolverInfo } from "../../resolver-extractor/extractor/define-api-extractor.js";
import type { ExtractTypesResult } from "../../type-extractor/index.js";
import { integrate } from "./result-integrator.js";

function createMinimalTypesResult(
  types: ExtractTypesResult["types"] = [],
): ExtractTypesResult {
  return {
    types,
    diagnostics: {
      errors: [],
      warnings: [],
    },
  };
}

function createMinimalResolversResult(
  options: { abstractTypeResolvers?: ReadonlyArray<AbstractResolverInfo> } = {},
): ExtractResolversResult {
  return {
    queryFields: { fields: [] },
    mutationFields: { fields: [] },
    typeExtensions: [],
    abstractTypeResolvers: options.abstractTypeResolvers ?? [],
    diagnostics: {
      errors: [],
      warnings: [],
    },
  };
}

describe("integrate - abstract resolver validation", () => {
  describe("Requirement 8.4: Pipeline integration", () => {
    it("should include abstract resolver validation errors in diagnostics when type does not exist", () => {
      const typesResult = createMinimalTypesResult([]);
      const resolversResult = createMinimalResolversResult({
        abstractTypeResolvers: [
          {
            kind: "resolveType",
            targetTypeName: "NonExistentType",
            exportName: "nonExistentResolveType",
            sourceFile: "/src/gqlkit/schema/resolvers.ts",
            sourceLocation: {
              file: "/src/gqlkit/schema/resolvers.ts",
              line: 10,
              column: 1,
            },
          },
        ],
      });

      const result = integrate(typesResult, resolversResult, null);

      const unknownTypeErrors = result.diagnostics.filter(
        (d) => d.code === "UNKNOWN_ABSTRACT_TYPE",
      );
      expect(unknownTypeErrors).toHaveLength(1);
      expect(unknownTypeErrors[0]?.message).toContain("NonExistentType");
      expect(unknownTypeErrors[0]?.severity).toBe("error");
    });

    it("should include abstract resolver validation errors when type kind is invalid", () => {
      const typesResult = createMinimalTypesResult([
        {
          name: "User",
          kind: "Object",
          fields: [
            {
              name: "id",
              type: {
                typeName: "String",
                nullable: false,
                list: false,
                listItemNullable: null,
              },
              description: null,
              deprecated: null,
              directives: null,
              defaultValue: null,
            },
          ],
          enumValues: null,
          unionMembers: null,
          implementedInterfaces: null,
          sourceFile: "/src/gqlkit/schema/types.ts",
          description: null,
          deprecated: null,
          directives: null,
        },
      ]);
      const resolversResult = createMinimalResolversResult({
        abstractTypeResolvers: [
          {
            kind: "resolveType",
            targetTypeName: "User",
            exportName: "userResolveType",
            sourceFile: "/src/gqlkit/schema/resolvers.ts",
            sourceLocation: {
              file: "/src/gqlkit/schema/resolvers.ts",
              line: 15,
              column: 1,
            },
          },
        ],
      });

      const result = integrate(typesResult, resolversResult, null);

      const invalidKindErrors = result.diagnostics.filter(
        (d) => d.code === "INVALID_ABSTRACT_TYPE_KIND",
      );
      expect(invalidKindErrors).toHaveLength(1);
      expect(invalidKindErrors[0]?.message).toContain("User");
      expect(invalidKindErrors[0]?.message).toMatch(/object/i);
    });

    it("should include duplicate resolver errors in diagnostics", () => {
      const typesResult = createMinimalTypesResult([
        {
          name: "SearchResult",
          kind: "Union",
          fields: null,
          enumValues: null,
          unionMembers: ["User", "Post"],
          implementedInterfaces: null,
          sourceFile: "/src/gqlkit/schema/types.ts",
          description: null,
          deprecated: null,
          directives: null,
        },
      ]);
      const resolversResult = createMinimalResolversResult({
        abstractTypeResolvers: [
          {
            kind: "resolveType",
            targetTypeName: "SearchResult",
            exportName: "searchResolve1",
            sourceFile: "/src/gqlkit/schema/search.ts",
            sourceLocation: {
              file: "/src/gqlkit/schema/search.ts",
              line: 10,
              column: 1,
            },
          },
          {
            kind: "resolveType",
            targetTypeName: "SearchResult",
            exportName: "searchResolve2",
            sourceFile: "/src/gqlkit/schema/other.ts",
            sourceLocation: {
              file: "/src/gqlkit/schema/other.ts",
              line: 20,
              column: 1,
            },
          },
        ],
      });

      const result = integrate(typesResult, resolversResult, null);

      const duplicateErrors = result.diagnostics.filter(
        (d) => d.code === "DUPLICATE_RESOLVE_TYPE",
      );
      expect(duplicateErrors).toHaveLength(1);
      expect(duplicateErrors[0]?.message).toContain("SearchResult");
    });

    it("should include missing resolver warnings in diagnostics", () => {
      const typesResult = createMinimalTypesResult([
        {
          name: "SearchResult",
          kind: "Union",
          fields: null,
          enumValues: null,
          unionMembers: ["User", "Post"],
          implementedInterfaces: null,
          sourceFile: "/src/gqlkit/schema/types.ts",
          description: null,
          deprecated: null,
          directives: null,
        },
        {
          name: "User",
          kind: "Object",
          fields: [],
          enumValues: null,
          unionMembers: null,
          implementedInterfaces: null,
          sourceFile: "/src/gqlkit/schema/user.ts",
          description: null,
          deprecated: null,
          directives: null,
        },
        {
          name: "Post",
          kind: "Object",
          fields: [],
          enumValues: null,
          unionMembers: null,
          implementedInterfaces: null,
          sourceFile: "/src/gqlkit/schema/post.ts",
          description: null,
          deprecated: null,
          directives: null,
        },
      ]);
      const resolversResult = createMinimalResolversResult({
        abstractTypeResolvers: [],
      });

      const result = integrate(typesResult, resolversResult, null);

      const missingWarnings = result.diagnostics.filter(
        (d) => d.code === "MISSING_ABSTRACT_TYPE_RESOLVER",
      );
      expect(missingWarnings).toHaveLength(1);
      expect(missingWarnings[0]?.severity).toBe("warning");
      expect(missingWarnings[0]?.message).toContain("SearchResult");
    });

    it("should not produce errors when abstract resolvers are valid", () => {
      const typesResult = createMinimalTypesResult([
        {
          name: "SearchResult",
          kind: "Union",
          fields: null,
          enumValues: null,
          unionMembers: ["User", "Post"],
          implementedInterfaces: null,
          sourceFile: "/src/gqlkit/schema/types.ts",
          description: null,
          deprecated: null,
          directives: null,
        },
        {
          name: "User",
          kind: "Object",
          fields: [],
          enumValues: null,
          unionMembers: null,
          implementedInterfaces: null,
          sourceFile: "/src/gqlkit/schema/user.ts",
          description: null,
          deprecated: null,
          directives: null,
        },
        {
          name: "Post",
          kind: "Object",
          fields: [],
          enumValues: null,
          unionMembers: null,
          implementedInterfaces: null,
          sourceFile: "/src/gqlkit/schema/post.ts",
          description: null,
          deprecated: null,
          directives: null,
        },
      ]);
      const resolversResult = createMinimalResolversResult({
        abstractTypeResolvers: [
          {
            kind: "resolveType",
            targetTypeName: "SearchResult",
            exportName: "searchResultResolveType",
            sourceFile: "/src/gqlkit/schema/search.ts",
            sourceLocation: {
              file: "/src/gqlkit/schema/search.ts",
              line: 10,
              column: 1,
            },
          },
        ],
      });

      const result = integrate(typesResult, resolversResult, null);

      const abstractResolverErrors = result.diagnostics.filter(
        (d) =>
          d.code === "UNKNOWN_ABSTRACT_TYPE" ||
          d.code === "INVALID_ABSTRACT_TYPE_KIND" ||
          d.code === "INVALID_OBJECT_TYPE_KIND" ||
          d.code === "DUPLICATE_RESOLVE_TYPE" ||
          d.code === "DUPLICATE_IS_TYPE_OF" ||
          d.code === "MISSING_ABSTRACT_TYPE_RESOLVER",
      );
      expect(abstractResolverErrors).toHaveLength(0);
    });

    it("should set hasErrors to true when abstract resolver validation produces errors", () => {
      const typesResult = createMinimalTypesResult([]);
      const resolversResult = createMinimalResolversResult({
        abstractTypeResolvers: [
          {
            kind: "resolveType",
            targetTypeName: "NonExistentType",
            exportName: "nonExistentResolveType",
            sourceFile: "/src/gqlkit/schema/resolvers.ts",
            sourceLocation: {
              file: "/src/gqlkit/schema/resolvers.ts",
              line: 10,
              column: 1,
            },
          },
        ],
      });

      const result = integrate(typesResult, resolversResult, null);

      expect(result.hasErrors).toBe(true);
    });

    it("should not set hasErrors for warnings only", () => {
      const typesResult = createMinimalTypesResult([
        {
          name: "SearchResult",
          kind: "Union",
          fields: null,
          enumValues: null,
          unionMembers: ["User", "Post"],
          implementedInterfaces: null,
          sourceFile: "/src/gqlkit/schema/types.ts",
          description: null,
          deprecated: null,
          directives: null,
        },
        {
          name: "User",
          kind: "Object",
          fields: [],
          enumValues: null,
          unionMembers: null,
          implementedInterfaces: null,
          sourceFile: "/src/gqlkit/schema/user.ts",
          description: null,
          deprecated: null,
          directives: null,
        },
        {
          name: "Post",
          kind: "Object",
          fields: [],
          enumValues: null,
          unionMembers: null,
          implementedInterfaces: null,
          sourceFile: "/src/gqlkit/schema/post.ts",
          description: null,
          deprecated: null,
          directives: null,
        },
      ]);
      const resolversResult = createMinimalResolversResult({
        abstractTypeResolvers: [],
      });

      const result = integrate(typesResult, resolversResult, null);

      expect(result.hasErrors).toBe(false);
      expect(
        result.diagnostics.filter(
          (d) => d.code === "MISSING_ABSTRACT_TYPE_RESOLVER",
        ),
      ).toHaveLength(1);
    });

    it("should include isTypeOf validation errors for non-object types", () => {
      const typesResult = createMinimalTypesResult([
        {
          name: "SearchResult",
          kind: "Union",
          fields: null,
          enumValues: null,
          unionMembers: ["User", "Post"],
          implementedInterfaces: null,
          sourceFile: "/src/gqlkit/schema/types.ts",
          description: null,
          deprecated: null,
          directives: null,
        },
      ]);
      const resolversResult = createMinimalResolversResult({
        abstractTypeResolvers: [
          {
            kind: "isTypeOf",
            targetTypeName: "SearchResult",
            exportName: "searchResultIsTypeOf",
            sourceFile: "/src/gqlkit/schema/resolvers.ts",
            sourceLocation: {
              file: "/src/gqlkit/schema/resolvers.ts",
              line: 25,
              column: 1,
            },
          },
        ],
      });

      const result = integrate(typesResult, resolversResult, null);

      const invalidObjectErrors = result.diagnostics.filter(
        (d) => d.code === "INVALID_OBJECT_TYPE_KIND",
      );
      expect(invalidObjectErrors).toHaveLength(1);
      expect(invalidObjectErrors[0]?.message).toContain("SearchResult");
      expect(invalidObjectErrors[0]?.message).toMatch(/object/i);
    });
  });
});
