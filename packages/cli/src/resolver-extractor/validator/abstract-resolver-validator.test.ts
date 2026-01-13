/**
 * Tests for AbstractResolverValidator.
 *
 * These tests verify that the validator correctly detects
 * type reference errors in abstract type resolvers.
 */

import { describe, expect, it } from "vitest";
import type { BaseType } from "../../schema-generator/integrator/result-integrator.js";
import type { AbstractResolverInfo } from "../extractor/define-api-extractor.js";
import { validateAbstractResolvers } from "./abstract-resolver-validator.js";

function createAbstractResolver(
  kind: "resolveType" | "isTypeOf",
  targetTypeName: string,
  exportName: string,
  options?: {
    sourceFile?: string;
    line?: number;
    column?: number;
  },
): AbstractResolverInfo {
  return {
    kind,
    targetTypeName,
    exportName,
    sourceFile: options?.sourceFile ?? "/src/gqlkit/schema/resolvers.ts",
    sourceLocation: {
      file: options?.sourceFile ?? "/src/gqlkit/schema/resolvers.ts",
      line: options?.line ?? 10,
      column: options?.column ?? 1,
    },
  };
}

function createBaseType(
  name: string,
  kind: "Object" | "Interface" | "Union" | "Enum",
): BaseType {
  return {
    name,
    kind,
    fields: kind === "Object" || kind === "Interface" ? [] : null,
    unionMembers: kind === "Union" ? ["TypeA", "TypeB"] : null,
    enumValues:
      kind === "Enum"
        ? [
            {
              name: "A",
              originalValue: "A",
              description: null,
              deprecated: null,
            },
          ]
        : null,
    implementedInterfaces: null,
    description: null,
    deprecated: null,
    sourceFile: "/src/gqlkit/schema/types.ts",
    directives: null,
  };
}

describe("AbstractResolverValidator", () => {
  describe("6.1 resolveType referencing non-existent type", () => {
    it("should error when resolveType references a type that does not exist in schema", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver(
          "resolveType",
          "NonExistentType",
          "nonExistentResolveType",
        ),
      ];
      const baseTypes: BaseType[] = [
        createBaseType("ExistingObject", "Object"),
      ];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      const errors = result.diagnostics.filter((d) => d.severity === "error");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        code: "UNKNOWN_ABSTRACT_TYPE",
        severity: "error",
      });
      expect(errors[0]?.message).toContain("NonExistentType");
    });

    it("should include source file path and line number in error message", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver(
          "resolveType",
          "MissingType",
          "missingResolveType",
          {
            sourceFile: "/src/gqlkit/schema/search.ts",
            line: 25,
          },
        ),
      ];
      const baseTypes: BaseType[] = [];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.location).toMatchObject({
        file: "/src/gqlkit/schema/search.ts",
        line: 25,
      });
    });
  });

  describe("6.2 resolveType referencing non-abstract type", () => {
    it("should error when resolveType references an object type", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver("resolveType", "User", "userResolveType"),
      ];
      const baseTypes: BaseType[] = [createBaseType("User", "Object")];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "INVALID_ABSTRACT_TYPE_KIND",
        severity: "error",
      });
      expect(result.diagnostics[0]?.message).toContain("User");
      expect(result.diagnostics[0]?.message).toContain("union");
      expect(result.diagnostics[0]?.message).toContain("interface");
    });

    it("should error when resolveType references an enum type", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver("resolveType", "Status", "statusResolveType"),
      ];
      const baseTypes: BaseType[] = [createBaseType("Status", "Enum")];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "INVALID_ABSTRACT_TYPE_KIND",
        severity: "error",
      });
    });

    it("should not error when resolveType references a union type", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver(
          "resolveType",
          "SearchResult",
          "searchResultResolveType",
        ),
      ];
      const baseTypes: BaseType[] = [createBaseType("SearchResult", "Union")];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(0);
    });

    it("should not error when resolveType references an interface type", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver("resolveType", "Node", "nodeResolveType"),
      ];
      const baseTypes: BaseType[] = [createBaseType("Node", "Interface")];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(0);
    });

    it("should include expected and actual type kinds in error message", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver("resolveType", "User", "userResolveType"),
      ];
      const baseTypes: BaseType[] = [createBaseType("User", "Object")];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics[0]?.message).toMatch(/object/i);
      expect(result.diagnostics[0]?.message).toMatch(/union|interface/i);
    });
  });

  describe("6.3 isTypeOf referencing non-existent type", () => {
    it("should error when isTypeOf references a type that does not exist in schema", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver(
          "isTypeOf",
          "NonExistentType",
          "nonExistentIsTypeOf",
        ),
      ];
      const baseTypes: BaseType[] = [
        createBaseType("ExistingObject", "Object"),
      ];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "UNKNOWN_ABSTRACT_TYPE",
        severity: "error",
      });
      expect(result.diagnostics[0]?.message).toContain("NonExistentType");
    });
  });

  describe("6.4 isTypeOf referencing non-object type", () => {
    it("should error when isTypeOf references a union type", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver(
          "isTypeOf",
          "SearchResult",
          "searchResultIsTypeOf",
        ),
      ];
      const baseTypes: BaseType[] = [createBaseType("SearchResult", "Union")];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      const errors = result.diagnostics.filter((d) => d.severity === "error");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        code: "INVALID_OBJECT_TYPE_KIND",
        severity: "error",
      });
      expect(errors[0]?.message).toContain("SearchResult");
    });

    it("should error when isTypeOf references an interface type", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver("isTypeOf", "Node", "nodeIsTypeOf"),
      ];
      const baseTypes: BaseType[] = [createBaseType("Node", "Interface")];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "INVALID_OBJECT_TYPE_KIND",
        severity: "error",
      });
    });

    it("should error when isTypeOf references an enum type", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver("isTypeOf", "Status", "statusIsTypeOf"),
      ];
      const baseTypes: BaseType[] = [createBaseType("Status", "Enum")];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "INVALID_OBJECT_TYPE_KIND",
        severity: "error",
      });
    });

    it("should not error when isTypeOf references an object type", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver("isTypeOf", "User", "userIsTypeOf"),
      ];
      const baseTypes: BaseType[] = [createBaseType("User", "Object")];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(0);
    });

    it("should include expected and actual type kinds in error message", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver(
          "isTypeOf",
          "SearchResult",
          "searchResultIsTypeOf",
        ),
      ];
      const baseTypes: BaseType[] = [createBaseType("SearchResult", "Union")];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics[0]?.message).toMatch(/union/i);
      expect(result.diagnostics[0]?.message).toMatch(/object/i);
    });
  });

  describe("8.1 Error message quality for type reference errors", () => {
    it("should include type name, file path, and line number in error", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver(
          "resolveType",
          "MissingUnion",
          "missingResolveType",
          {
            sourceFile: "/src/gqlkit/schema/resolvers.ts",
            line: 42,
            column: 5,
          },
        ),
      ];
      const baseTypes: BaseType[] = [];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics[0]?.message).toContain("MissingUnion");
      expect(result.diagnostics[0]?.location).toEqual({
        file: "/src/gqlkit/schema/resolvers.ts",
        line: 42,
        column: 5,
      });
    });
  });

  describe("8.2 Error message quality for type kind mismatch", () => {
    it("should indicate expected type kind and actual type kind", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver("resolveType", "User", "userResolveType"),
      ];
      const baseTypes: BaseType[] = [createBaseType("User", "Object")];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      const message = result.diagnostics[0]?.message ?? "";
      expect(message).toMatch(/union.*interface|interface.*union/i);
      expect(message).toMatch(/object/i);
    });

    it("should indicate expected object type for isTypeOf", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver("isTypeOf", "Node", "nodeIsTypeOf"),
      ];
      const baseTypes: BaseType[] = [createBaseType("Node", "Interface")];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      const message = result.diagnostics[0]?.message ?? "";
      expect(message).toMatch(/object/i);
      expect(message).toMatch(/interface/i);
    });
  });

  describe("Multiple validation errors", () => {
    it("should report all errors when multiple validators have issues", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver(
          "resolveType",
          "NonExistent",
          "nonExistentResolveType",
        ),
        createAbstractResolver(
          "isTypeOf",
          "SearchResult",
          "searchResultIsTypeOf",
        ),
        createAbstractResolver("resolveType", "User", "userResolveType"),
      ];
      const baseTypes: BaseType[] = [
        createBaseType("User", "Object"),
        createBaseType("SearchResult", "Union"),
      ];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      const errors = result.diagnostics.filter((d) => d.severity === "error");
      expect(errors).toHaveLength(3);
      expect(
        errors.filter((d) => d.code === "UNKNOWN_ABSTRACT_TYPE"),
      ).toHaveLength(1);
      expect(
        errors.filter((d) => d.code === "INVALID_ABSTRACT_TYPE_KIND"),
      ).toHaveLength(1);
      expect(
        errors.filter((d) => d.code === "INVALID_OBJECT_TYPE_KIND"),
      ).toHaveLength(1);
    });
  });

  describe("Empty input", () => {
    it("should return no errors when there are no abstract resolvers", () => {
      const abstractResolvers: AbstractResolverInfo[] = [];
      const baseTypes: BaseType[] = [createBaseType("User", "Object")];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(0);
    });

    it("should handle empty baseTypes", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver(
          "resolveType",
          "MissingType",
          "missingResolveType",
        ),
      ];
      const baseTypes: BaseType[] = [];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.code).toBe("UNKNOWN_ABSTRACT_TYPE");
    });
  });

  describe("7.1 Duplicate resolveType definitions for same union/interface", () => {
    it("should error when multiple resolveType are defined for the same union type", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver(
          "resolveType",
          "SearchResult",
          "searchResultResolveType",
          {
            sourceFile: "/src/gqlkit/schema/search.ts",
            line: 15,
            column: 1,
          },
        ),
        createAbstractResolver(
          "resolveType",
          "SearchResult",
          "anotherResolveType",
          {
            sourceFile: "/src/gqlkit/schema/other.ts",
            line: 8,
            column: 1,
          },
        ),
      ];
      const baseTypes: BaseType[] = [createBaseType("SearchResult", "Union")];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "DUPLICATE_RESOLVE_TYPE",
        severity: "error",
      });
      expect(result.diagnostics[0]?.message).toContain("SearchResult");
      expect(result.diagnostics[0]?.message).toContain(
        "searchResultResolveType",
      );
      expect(result.diagnostics[0]?.message).toContain("anotherResolveType");
    });

    it("should error when multiple resolveType are defined for the same interface type", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver("resolveType", "Node", "nodeResolveType", {
          sourceFile: "/src/gqlkit/schema/node.ts",
          line: 10,
          column: 1,
        }),
        createAbstractResolver("resolveType", "Node", "duplicateNodeResolver", {
          sourceFile: "/src/gqlkit/schema/duplicate.ts",
          line: 20,
          column: 1,
        }),
      ];
      const baseTypes: BaseType[] = [createBaseType("Node", "Interface")];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "DUPLICATE_RESOLVE_TYPE",
        severity: "error",
      });
      expect(result.diagnostics[0]?.message).toContain("Node");
    });

    it("should not error when single resolveType is defined for a type", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver(
          "resolveType",
          "SearchResult",
          "searchResultResolveType",
        ),
      ];
      const baseTypes: BaseType[] = [createBaseType("SearchResult", "Union")];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(0);
    });
  });

  describe("7.2 Duplicate isTypeOf definitions for same object type", () => {
    it("should error when multiple isTypeOf are defined for the same object type", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver("isTypeOf", "User", "userIsTypeOf", {
          sourceFile: "/src/gqlkit/schema/user.ts",
          line: 25,
          column: 1,
        }),
        createAbstractResolver("isTypeOf", "User", "duplicateUserIsTypeOf", {
          sourceFile: "/src/gqlkit/schema/another.ts",
          line: 30,
          column: 1,
        }),
      ];
      const baseTypes: BaseType[] = [createBaseType("User", "Object")];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "DUPLICATE_IS_TYPE_OF",
        severity: "error",
      });
      expect(result.diagnostics[0]?.message).toContain("User");
      expect(result.diagnostics[0]?.message).toContain("userIsTypeOf");
      expect(result.diagnostics[0]?.message).toContain("duplicateUserIsTypeOf");
    });

    it("should not error when single isTypeOf is defined for a type", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver("isTypeOf", "User", "userIsTypeOf"),
      ];
      const baseTypes: BaseType[] = [createBaseType("User", "Object")];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(0);
    });
  });

  describe("7.3 Report all duplicates in single diagnostic", () => {
    it("should report all duplicate resolveType definitions for a type in one diagnostic", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver("resolveType", "SearchResult", "resolveType1", {
          sourceFile: "/src/gqlkit/schema/file1.ts",
          line: 10,
          column: 1,
        }),
        createAbstractResolver("resolveType", "SearchResult", "resolveType2", {
          sourceFile: "/src/gqlkit/schema/file2.ts",
          line: 20,
          column: 1,
        }),
        createAbstractResolver("resolveType", "SearchResult", "resolveType3", {
          sourceFile: "/src/gqlkit/schema/file3.ts",
          line: 30,
          column: 1,
        }),
      ];
      const baseTypes: BaseType[] = [createBaseType("SearchResult", "Union")];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.code).toBe("DUPLICATE_RESOLVE_TYPE");
      expect(result.diagnostics[0]?.message).toContain("resolveType1");
      expect(result.diagnostics[0]?.message).toContain("resolveType2");
      expect(result.diagnostics[0]?.message).toContain("resolveType3");
    });

    it("should report duplicates for multiple types separately", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver("resolveType", "SearchResult", "searchResolve1"),
        createAbstractResolver("resolveType", "SearchResult", "searchResolve2"),
        createAbstractResolver("resolveType", "Node", "nodeResolve1"),
        createAbstractResolver("resolveType", "Node", "nodeResolve2"),
      ];
      const baseTypes: BaseType[] = [
        createBaseType("SearchResult", "Union"),
        createBaseType("Node", "Interface"),
      ];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(2);
      const searchResultDiag = result.diagnostics.find((d) =>
        d.message.includes("SearchResult"),
      );
      const nodeDiag = result.diagnostics.find((d) =>
        d.message.includes("Node"),
      );
      expect(searchResultDiag?.code).toBe("DUPLICATE_RESOLVE_TYPE");
      expect(nodeDiag?.code).toBe("DUPLICATE_RESOLVE_TYPE");
    });

    it("should report duplicates for both resolveType and isTypeOf separately", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver("resolveType", "SearchResult", "searchResolve1"),
        createAbstractResolver("resolveType", "SearchResult", "searchResolve2"),
        createAbstractResolver("isTypeOf", "User", "userIsTypeOf1"),
        createAbstractResolver("isTypeOf", "User", "userIsTypeOf2"),
      ];
      const baseTypes: BaseType[] = [
        createBaseType("SearchResult", "Union"),
        createBaseType("User", "Object"),
      ];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(2);
      expect(
        result.diagnostics.filter((d) => d.code === "DUPLICATE_RESOLVE_TYPE"),
      ).toHaveLength(1);
      expect(
        result.diagnostics.filter((d) => d.code === "DUPLICATE_IS_TYPE_OF"),
      ).toHaveLength(1);
    });
  });

  describe("8.3 Error message quality for duplicate definitions", () => {
    it("should list all conflicting definitions with file paths and line numbers", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver(
          "resolveType",
          "SearchResult",
          "searchResultResolveType",
          {
            sourceFile: "/src/gqlkit/schema/search.ts",
            line: 15,
            column: 1,
          },
        ),
        createAbstractResolver(
          "resolveType",
          "SearchResult",
          "anotherResolveType",
          {
            sourceFile: "/src/gqlkit/schema/other.ts",
            line: 8,
            column: 5,
          },
        ),
      ];
      const baseTypes: BaseType[] = [createBaseType("SearchResult", "Union")];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(1);
      const message = result.diagnostics[0]?.message ?? "";
      expect(message).toContain("/src/gqlkit/schema/search.ts");
      expect(message).toContain("15");
      expect(message).toContain("/src/gqlkit/schema/other.ts");
      expect(message).toContain("8");
    });

    it("should list all conflicting isTypeOf definitions with file paths and line numbers", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver("isTypeOf", "User", "userIsTypeOf", {
          sourceFile: "/src/gqlkit/schema/user.ts",
          line: 25,
          column: 1,
        }),
        createAbstractResolver("isTypeOf", "User", "duplicateUserIsTypeOf", {
          sourceFile: "/src/gqlkit/schema/another.ts",
          line: 30,
          column: 1,
        }),
      ];
      const baseTypes: BaseType[] = [createBaseType("User", "Object")];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(1);
      const message = result.diagnostics[0]?.message ?? "";
      expect(message).toContain("/src/gqlkit/schema/user.ts");
      expect(message).toContain("25");
      expect(message).toContain("/src/gqlkit/schema/another.ts");
      expect(message).toContain("30");
    });
  });

  describe("9.1 Missing resolver warning for union types", () => {
    it("should warn when union has no resolveType and member types have no isTypeOf", () => {
      const abstractResolvers: AbstractResolverInfo[] = [];
      const baseTypes: BaseType[] = [
        {
          name: "SearchResult",
          kind: "Union",
          fields: null,
          unionMembers: ["User", "Post"],
          enumValues: null,
          implementedInterfaces: null,
          description: null,
          deprecated: null,
          sourceFile: "/src/gqlkit/schema/search.ts",
          directives: null,
        },
        createBaseType("User", "Object"),
        createBaseType("Post", "Object"),
      ];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "MISSING_ABSTRACT_TYPE_RESOLVER",
        severity: "warning",
      });
      expect(result.diagnostics[0]?.message).toContain("SearchResult");
    });

    it("should not warn when union has resolveType defined", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver(
          "resolveType",
          "SearchResult",
          "searchResultResolveType",
        ),
      ];
      const baseTypes: BaseType[] = [
        {
          name: "SearchResult",
          kind: "Union",
          fields: null,
          unionMembers: ["User", "Post"],
          enumValues: null,
          implementedInterfaces: null,
          description: null,
          deprecated: null,
          sourceFile: "/src/gqlkit/schema/search.ts",
          directives: null,
        },
        createBaseType("User", "Object"),
        createBaseType("Post", "Object"),
      ];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(0);
    });

    it("should not warn when all union member types have isTypeOf defined", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver("isTypeOf", "User", "userIsTypeOf"),
        createAbstractResolver("isTypeOf", "Post", "postIsTypeOf"),
      ];
      const baseTypes: BaseType[] = [
        {
          name: "SearchResult",
          kind: "Union",
          fields: null,
          unionMembers: ["User", "Post"],
          enumValues: null,
          implementedInterfaces: null,
          description: null,
          deprecated: null,
          sourceFile: "/src/gqlkit/schema/search.ts",
          directives: null,
        },
        createBaseType("User", "Object"),
        createBaseType("Post", "Object"),
      ];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(0);
    });

    it("should warn when some but not all union member types have isTypeOf", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver("isTypeOf", "User", "userIsTypeOf"),
      ];
      const baseTypes: BaseType[] = [
        {
          name: "SearchResult",
          kind: "Union",
          fields: null,
          unionMembers: ["User", "Post"],
          enumValues: null,
          implementedInterfaces: null,
          description: null,
          deprecated: null,
          sourceFile: "/src/gqlkit/schema/search.ts",
          directives: null,
        },
        createBaseType("User", "Object"),
        createBaseType("Post", "Object"),
      ];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "MISSING_ABSTRACT_TYPE_RESOLVER",
        severity: "warning",
      });
    });
  });

  describe("9.2 Missing resolver warning for interface types", () => {
    it("should warn when interface has no resolveType and implementing types have no isTypeOf", () => {
      const abstractResolvers: AbstractResolverInfo[] = [];
      const baseTypes: BaseType[] = [
        createBaseType("Node", "Interface"),
        {
          name: "User",
          kind: "Object",
          fields: [],
          unionMembers: null,
          enumValues: null,
          implementedInterfaces: ["Node"],
          description: null,
          deprecated: null,
          sourceFile: "/src/gqlkit/schema/user.ts",
          directives: null,
        },
        {
          name: "Post",
          kind: "Object",
          fields: [],
          unionMembers: null,
          enumValues: null,
          implementedInterfaces: ["Node"],
          description: null,
          deprecated: null,
          sourceFile: "/src/gqlkit/schema/post.ts",
          directives: null,
        },
      ];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "MISSING_ABSTRACT_TYPE_RESOLVER",
        severity: "warning",
      });
      expect(result.diagnostics[0]?.message).toContain("Node");
    });

    it("should not warn when interface has resolveType defined", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver("resolveType", "Node", "nodeResolveType"),
      ];
      const baseTypes: BaseType[] = [
        createBaseType("Node", "Interface"),
        {
          name: "User",
          kind: "Object",
          fields: [],
          unionMembers: null,
          enumValues: null,
          implementedInterfaces: ["Node"],
          description: null,
          deprecated: null,
          sourceFile: "/src/gqlkit/schema/user.ts",
          directives: null,
        },
      ];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(0);
    });

    it("should not warn when all implementing types have isTypeOf defined", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver("isTypeOf", "User", "userIsTypeOf"),
        createAbstractResolver("isTypeOf", "Post", "postIsTypeOf"),
      ];
      const baseTypes: BaseType[] = [
        createBaseType("Node", "Interface"),
        {
          name: "User",
          kind: "Object",
          fields: [],
          unionMembers: null,
          enumValues: null,
          implementedInterfaces: ["Node"],
          description: null,
          deprecated: null,
          sourceFile: "/src/gqlkit/schema/user.ts",
          directives: null,
        },
        {
          name: "Post",
          kind: "Object",
          fields: [],
          unionMembers: null,
          enumValues: null,
          implementedInterfaces: ["Node"],
          description: null,
          deprecated: null,
          sourceFile: "/src/gqlkit/schema/post.ts",
          directives: null,
        },
      ];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(0);
    });

    it("should warn when some but not all implementing types have isTypeOf", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver("isTypeOf", "User", "userIsTypeOf"),
      ];
      const baseTypes: BaseType[] = [
        createBaseType("Node", "Interface"),
        {
          name: "User",
          kind: "Object",
          fields: [],
          unionMembers: null,
          enumValues: null,
          implementedInterfaces: ["Node"],
          description: null,
          deprecated: null,
          sourceFile: "/src/gqlkit/schema/user.ts",
          directives: null,
        },
        {
          name: "Post",
          kind: "Object",
          fields: [],
          unionMembers: null,
          enumValues: null,
          implementedInterfaces: ["Node"],
          description: null,
          deprecated: null,
          sourceFile: "/src/gqlkit/schema/post.ts",
          directives: null,
        },
      ];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "MISSING_ABSTRACT_TYPE_RESOLVER",
        severity: "warning",
      });
    });

    it("should not warn for interfaces with no implementing types", () => {
      const abstractResolvers: AbstractResolverInfo[] = [];
      const baseTypes: BaseType[] = [createBaseType("Node", "Interface")];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(0);
    });
  });

  describe("9.3 Warning message suggests recommended actions", () => {
    it("should suggest defining resolveType for union type", () => {
      const abstractResolvers: AbstractResolverInfo[] = [];
      const baseTypes: BaseType[] = [
        {
          name: "SearchResult",
          kind: "Union",
          fields: null,
          unionMembers: ["User", "Post"],
          enumValues: null,
          implementedInterfaces: null,
          description: null,
          deprecated: null,
          sourceFile: "/src/gqlkit/schema/search.ts",
          directives: null,
        },
        createBaseType("User", "Object"),
        createBaseType("Post", "Object"),
      ];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics[0]?.message).toMatch(/resolveType/i);
    });

    it("should suggest defining isTypeOf for member/implementing types", () => {
      const abstractResolvers: AbstractResolverInfo[] = [];
      const baseTypes: BaseType[] = [
        {
          name: "SearchResult",
          kind: "Union",
          fields: null,
          unionMembers: ["User", "Post"],
          enumValues: null,
          implementedInterfaces: null,
          description: null,
          deprecated: null,
          sourceFile: "/src/gqlkit/schema/search.ts",
          directives: null,
        },
        createBaseType("User", "Object"),
        createBaseType("Post", "Object"),
      ];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics[0]?.message).toMatch(/isTypeOf/i);
    });
  });

  describe("9.4 Warning does not block code generation", () => {
    it("should have severity 'warning' not 'error'", () => {
      const abstractResolvers: AbstractResolverInfo[] = [];
      const baseTypes: BaseType[] = [
        {
          name: "SearchResult",
          kind: "Union",
          fields: null,
          unionMembers: ["User", "Post"],
          enumValues: null,
          implementedInterfaces: null,
          description: null,
          deprecated: null,
          sourceFile: "/src/gqlkit/schema/search.ts",
          directives: null,
        },
        createBaseType("User", "Object"),
        createBaseType("Post", "Object"),
      ];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.severity).toBe("warning");
    });
  });

  describe("Multiple abstract types missing resolvers", () => {
    it("should warn for each abstract type missing resolvers", () => {
      const abstractResolvers: AbstractResolverInfo[] = [];
      const baseTypes: BaseType[] = [
        {
          name: "SearchResult",
          kind: "Union",
          fields: null,
          unionMembers: ["User", "Post"],
          enumValues: null,
          implementedInterfaces: null,
          description: null,
          deprecated: null,
          sourceFile: "/src/gqlkit/schema/search.ts",
          directives: null,
        },
        createBaseType("Node", "Interface"),
        {
          name: "User",
          kind: "Object",
          fields: [],
          unionMembers: null,
          enumValues: null,
          implementedInterfaces: ["Node"],
          description: null,
          deprecated: null,
          sourceFile: "/src/gqlkit/schema/user.ts",
          directives: null,
        },
        {
          name: "Post",
          kind: "Object",
          fields: [],
          unionMembers: null,
          enumValues: null,
          implementedInterfaces: ["Node"],
          description: null,
          deprecated: null,
          sourceFile: "/src/gqlkit/schema/post.ts",
          directives: null,
        },
      ];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(2);
      expect(
        result.diagnostics.every(
          (d) => d.code === "MISSING_ABSTRACT_TYPE_RESOLVER",
        ),
      ).toBe(true);
      expect(result.diagnostics.every((d) => d.severity === "warning")).toBe(
        true,
      );
    });
  });

  describe("Duplicate detection with other validation errors", () => {
    it("should report both duplicate errors and type reference errors", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver("resolveType", "SearchResult", "searchResolve1"),
        createAbstractResolver("resolveType", "SearchResult", "searchResolve2"),
        createAbstractResolver(
          "resolveType",
          "NonExistentType",
          "nonExistentResolve",
        ),
      ];
      const baseTypes: BaseType[] = [createBaseType("SearchResult", "Union")];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(result.diagnostics).toHaveLength(2);
      expect(
        result.diagnostics.filter((d) => d.code === "DUPLICATE_RESOLVE_TYPE"),
      ).toHaveLength(1);
      expect(
        result.diagnostics.filter((d) => d.code === "UNKNOWN_ABSTRACT_TYPE"),
      ).toHaveLength(1);
    });

    it("should not report duplicates for resolvers with type validation errors", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        createAbstractResolver(
          "resolveType",
          "NonExistentType",
          "nonExistentResolve1",
        ),
        createAbstractResolver(
          "resolveType",
          "NonExistentType",
          "nonExistentResolve2",
        ),
      ];
      const baseTypes: BaseType[] = [];

      const result = validateAbstractResolvers({
        abstractResolvers,
        baseTypes,
      });

      expect(
        result.diagnostics.filter((d) => d.code === "UNKNOWN_ABSTRACT_TYPE"),
      ).toHaveLength(2);
      expect(
        result.diagnostics.filter((d) => d.code === "DUPLICATE_RESOLVE_TYPE"),
      ).toHaveLength(0);
    });
  });
});
