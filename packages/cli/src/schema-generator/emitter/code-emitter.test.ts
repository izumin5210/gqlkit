import { describe, expect, test } from "vitest";
import type { ResolverInfo } from "../resolver-collector/resolver-collector.js";
import { emitResolversCode } from "./code-emitter.js";

describe("emitResolversCode", () => {
  describe("abstract type resolvers", () => {
    test("should emit __resolveType for union types", () => {
      const resolverInfo: ResolverInfo = {
        types: [],
        sourceFiles: ["/project/src/gqlkit/schema/search.ts"],
        abstractTypeResolvers: [
          {
            typeName: "SearchResult",
            resolverKey: "__resolveType",
            sourceFile: "/project/src/gqlkit/schema/search.ts",
            exportName: "searchResultResolveType",
          },
        ],
      };

      const result = emitResolversCode(
        resolverInfo,
        "/project/src/gqlkit/__generated__",
      );

      expect(result).toContain(
        'import { searchResultResolveType } from "../schema/search.js";',
      );
      expect(result).toContain("SearchResult: {");
      expect(result).toContain("__resolveType: searchResultResolveType,");
    });

    test("should emit __resolveType for interface types", () => {
      const resolverInfo: ResolverInfo = {
        types: [],
        sourceFiles: ["/project/src/gqlkit/schema/node.ts"],
        abstractTypeResolvers: [
          {
            typeName: "Node",
            resolverKey: "__resolveType",
            sourceFile: "/project/src/gqlkit/schema/node.ts",
            exportName: "nodeResolveType",
          },
        ],
      };

      const result = emitResolversCode(
        resolverInfo,
        "/project/src/gqlkit/__generated__",
      );

      expect(result).toContain(
        'import { nodeResolveType } from "../schema/node.js";',
      );
      expect(result).toContain("Node: {");
      expect(result).toContain("__resolveType: nodeResolveType,");
    });

    test("should emit __isTypeOf for object types without field resolvers", () => {
      const resolverInfo: ResolverInfo = {
        types: [],
        sourceFiles: ["/project/src/gqlkit/schema/user.ts"],
        abstractTypeResolvers: [
          {
            typeName: "User",
            resolverKey: "__isTypeOf",
            sourceFile: "/project/src/gqlkit/schema/user.ts",
            exportName: "userIsTypeOf",
          },
        ],
      };

      const result = emitResolversCode(
        resolverInfo,
        "/project/src/gqlkit/__generated__",
      );

      expect(result).toContain(
        'import { userIsTypeOf } from "../schema/user.js";',
      );
      expect(result).toContain("User: {");
      expect(result).toContain("__isTypeOf: userIsTypeOf,");
    });

    test("should merge __isTypeOf with existing field resolvers for object types", () => {
      const resolverInfo: ResolverInfo = {
        types: [
          {
            typeName: "User",
            fields: [
              {
                fieldName: "posts",
                sourceFile: "/project/src/gqlkit/schema/user.ts",
                resolverValueName: "posts",
                isDirectExport: true,
              },
            ],
          },
        ],
        sourceFiles: ["/project/src/gqlkit/schema/user.ts"],
        abstractTypeResolvers: [
          {
            typeName: "User",
            resolverKey: "__isTypeOf",
            sourceFile: "/project/src/gqlkit/schema/user.ts",
            exportName: "userIsTypeOf",
          },
        ],
      };

      const result = emitResolversCode(
        resolverInfo,
        "/project/src/gqlkit/__generated__",
      );

      expect(result).toContain("User: {");
      expect(result).toContain("posts: posts,");
      expect(result).toContain("__isTypeOf: userIsTypeOf,");
    });

    test("should generate imports for abstract resolvers from multiple source files", () => {
      const resolverInfo: ResolverInfo = {
        types: [],
        sourceFiles: [
          "/project/src/gqlkit/schema/node.ts",
          "/project/src/gqlkit/schema/search.ts",
        ],
        abstractTypeResolvers: [
          {
            typeName: "Node",
            resolverKey: "__resolveType",
            sourceFile: "/project/src/gqlkit/schema/node.ts",
            exportName: "nodeResolveType",
          },
          {
            typeName: "SearchResult",
            resolverKey: "__resolveType",
            sourceFile: "/project/src/gqlkit/schema/search.ts",
            exportName: "searchResultResolveType",
          },
        ],
      };

      const result = emitResolversCode(
        resolverInfo,
        "/project/src/gqlkit/__generated__",
      );

      expect(result).toContain(
        'import { nodeResolveType } from "../schema/node.js";',
      );
      expect(result).toContain(
        'import { searchResultResolveType } from "../schema/search.js";',
      );
    });

    test("should combine field resolver and abstract resolver imports from same file", () => {
      const resolverInfo: ResolverInfo = {
        types: [
          {
            typeName: "Query",
            fields: [
              {
                fieldName: "search",
                sourceFile: "/project/src/gqlkit/schema/search.ts",
                resolverValueName: "search",
                isDirectExport: true,
              },
            ],
          },
        ],
        sourceFiles: ["/project/src/gqlkit/schema/search.ts"],
        abstractTypeResolvers: [
          {
            typeName: "SearchResult",
            resolverKey: "__resolveType",
            sourceFile: "/project/src/gqlkit/schema/search.ts",
            exportName: "searchResultResolveType",
          },
        ],
      };

      const result = emitResolversCode(
        resolverInfo,
        "/project/src/gqlkit/__generated__",
      );

      expect(result).toContain(
        'import { search, searchResultResolveType } from "../schema/search.js";',
      );
    });

    test("should handle multiple abstract resolvers of different types", () => {
      const resolverInfo: ResolverInfo = {
        types: [],
        sourceFiles: [
          "/project/src/gqlkit/schema/animal.ts",
          "/project/src/gqlkit/schema/dog.ts",
        ],
        abstractTypeResolvers: [
          {
            typeName: "Animal",
            resolverKey: "__resolveType",
            sourceFile: "/project/src/gqlkit/schema/animal.ts",
            exportName: "animalResolveType",
          },
          {
            typeName: "Dog",
            resolverKey: "__isTypeOf",
            sourceFile: "/project/src/gqlkit/schema/dog.ts",
            exportName: "dogIsTypeOf",
          },
        ],
      };

      const result = emitResolversCode(
        resolverInfo,
        "/project/src/gqlkit/__generated__",
      );

      expect(result).toContain("Animal: {");
      expect(result).toContain("__resolveType: animalResolveType,");
      expect(result).toContain("Dog: {");
      expect(result).toContain("__isTypeOf: dogIsTypeOf,");
    });

    test("should maintain alphabetical order for type entries", () => {
      const resolverInfo: ResolverInfo = {
        types: [],
        sourceFiles: ["/project/src/gqlkit/schema/types.ts"],
        abstractTypeResolvers: [
          {
            typeName: "Zebra",
            resolverKey: "__resolveType",
            sourceFile: "/project/src/gqlkit/schema/types.ts",
            exportName: "zebraResolveType",
          },
          {
            typeName: "Apple",
            resolverKey: "__resolveType",
            sourceFile: "/project/src/gqlkit/schema/types.ts",
            exportName: "appleResolveType",
          },
        ],
      };

      const result = emitResolversCode(
        resolverInfo,
        "/project/src/gqlkit/__generated__",
      );

      const appleIndex = result.indexOf("Apple:");
      const zebraIndex = result.indexOf("Zebra:");
      expect(appleIndex).toBeLessThan(zebraIndex);
    });
  });
});
