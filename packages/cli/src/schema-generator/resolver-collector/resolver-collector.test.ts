import { describe, expect, test } from "vitest";
import type { AbstractResolverInfo } from "../../resolver-extractor/extractor/define-api-extractor.js";
import type { IntegratedResult } from "../integrator/result-integrator.js";
import { collectResolverInfo } from "./resolver-collector.js";

describe("collectResolverInfo", () => {
  describe("abstractTypeResolvers", () => {
    test("should convert resolveType abstract resolvers to AbstractTypeResolverInfo", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        {
          kind: "resolveType",
          targetTypeName: "SearchResult",
          exportName: "searchResultResolveType",
          sourceFile: "/src/schema/search.ts",
          sourceLocation: {
            file: "/src/schema/search.ts",
            line: 10,
            column: 1,
          },
        },
      ];

      const integratedResult: IntegratedResult = {
        baseTypes: [],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: null,
        customScalars: null,
        directiveDefinitions: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
        abstractTypeResolvers: abstractResolvers,
      };

      const result = collectResolverInfo(integratedResult);

      expect(result.abstractTypeResolvers).toEqual([
        {
          typeName: "SearchResult",
          resolverKey: "__resolveType",
          sourceFile: "/src/schema/search.ts",
          exportName: "searchResultResolveType",
        },
      ]);
    });

    test("should convert isTypeOf abstract resolvers to AbstractTypeResolverInfo", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        {
          kind: "isTypeOf",
          targetTypeName: "User",
          exportName: "userIsTypeOf",
          sourceFile: "/src/schema/user.ts",
          sourceLocation: {
            file: "/src/schema/user.ts",
            line: 20,
            column: 1,
          },
        },
      ];

      const integratedResult: IntegratedResult = {
        baseTypes: [],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: null,
        customScalars: null,
        directiveDefinitions: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
        abstractTypeResolvers: abstractResolvers,
      };

      const result = collectResolverInfo(integratedResult);

      expect(result.abstractTypeResolvers).toEqual([
        {
          typeName: "User",
          resolverKey: "__isTypeOf",
          sourceFile: "/src/schema/user.ts",
          exportName: "userIsTypeOf",
        },
      ]);
    });

    test("should collect source files from abstract resolvers", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        {
          kind: "resolveType",
          targetTypeName: "SearchResult",
          exportName: "searchResultResolveType",
          sourceFile: "/src/schema/search.ts",
          sourceLocation: {
            file: "/src/schema/search.ts",
            line: 10,
            column: 1,
          },
        },
        {
          kind: "isTypeOf",
          targetTypeName: "User",
          exportName: "userIsTypeOf",
          sourceFile: "/src/schema/user.ts",
          sourceLocation: {
            file: "/src/schema/user.ts",
            line: 20,
            column: 1,
          },
        },
      ];

      const integratedResult: IntegratedResult = {
        baseTypes: [],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: null,
        customScalars: null,
        directiveDefinitions: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
        abstractTypeResolvers: abstractResolvers,
      };

      const result = collectResolverInfo(integratedResult);

      expect(result.sourceFiles).toContain("/src/schema/search.ts");
      expect(result.sourceFiles).toContain("/src/schema/user.ts");
    });

    test("should return empty array when no abstract resolvers", () => {
      const integratedResult: IntegratedResult = {
        baseTypes: [],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: null,
        customScalars: null,
        directiveDefinitions: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
        abstractTypeResolvers: [],
      };

      const result = collectResolverInfo(integratedResult);

      expect(result.abstractTypeResolvers).toEqual([]);
    });

    test("should sort abstract resolvers by typeName", () => {
      const abstractResolvers: AbstractResolverInfo[] = [
        {
          kind: "resolveType",
          targetTypeName: "Zebra",
          exportName: "zebraResolveType",
          sourceFile: "/src/schema/zebra.ts",
          sourceLocation: {
            file: "/src/schema/zebra.ts",
            line: 10,
            column: 1,
          },
        },
        {
          kind: "resolveType",
          targetTypeName: "Apple",
          exportName: "appleResolveType",
          sourceFile: "/src/schema/apple.ts",
          sourceLocation: {
            file: "/src/schema/apple.ts",
            line: 10,
            column: 1,
          },
        },
      ];

      const integratedResult: IntegratedResult = {
        baseTypes: [],
        inputTypes: [],
        typeExtensions: [],
        customScalarNames: null,
        customScalars: null,
        directiveDefinitions: null,
        hasQuery: false,
        hasMutation: false,
        hasErrors: false,
        diagnostics: [],
        abstractTypeResolvers: abstractResolvers,
      };

      const result = collectResolverInfo(integratedResult);

      expect(result.abstractTypeResolvers[0]?.typeName).toBe("Apple");
      expect(result.abstractTypeResolvers[1]?.typeName).toBe("Zebra");
    });
  });
});
