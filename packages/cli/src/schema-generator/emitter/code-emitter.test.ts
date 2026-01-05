import { describe, expect, it } from "vitest";
import type { CollectedScalarType } from "../../type-extractor/collector/scalar-collector.js";
import type { ResolverInfo } from "../resolver-collector/resolver-collector.js";
import { emitResolversCode } from "./code-emitter.js";

describe("emitResolversCode", () => {
  const baseResolverInfo: ResolverInfo = {
    types: [
      {
        typeName: "Query",
        fields: [
          {
            fieldName: "user",
            sourceFile: "/src/gqlkit/query.ts",
            resolverValueName: "user",
            isDirectExport: true,
          },
        ],
      },
    ],
    sourceFiles: ["/src/gqlkit/query.ts"],
  };

  describe("without custom scalars", () => {
    it("generates createResolvers function without arguments", () => {
      const result = emitResolversCode(
        baseResolverInfo,
        "/src/gqlkit/__generated__",
        [],
      );

      expect(result).toContain("export function createResolvers()");
      expect(result).toContain("return {");
      expect(result).toContain("Query: {");
      expect(result).not.toContain("scalars");
      expect(result).not.toContain("GraphQLScalarType");
    });

    it("returns Resolvers object with only Query and Mutation", () => {
      const resolverInfo: ResolverInfo = {
        types: [
          {
            typeName: "Query",
            fields: [
              {
                fieldName: "user",
                sourceFile: "/src/gqlkit/query.ts",
                resolverValueName: "user",
                isDirectExport: true,
              },
            ],
          },
          {
            typeName: "Mutation",
            fields: [
              {
                fieldName: "createUser",
                sourceFile: "/src/gqlkit/mutation.ts",
                resolverValueName: "createUser",
                isDirectExport: true,
              },
            ],
          },
        ],
        sourceFiles: ["/src/gqlkit/query.ts", "/src/gqlkit/mutation.ts"],
      };

      const result = emitResolversCode(
        resolverInfo,
        "/src/gqlkit/__generated__",
        [],
      );

      expect(result).toContain("Query: {");
      expect(result).toContain("Mutation: {");
      expect(result).toContain("user: user,");
      expect(result).toContain("createUser: createUser,");
    });
  });

  describe("with custom scalars", () => {
    const customScalars: CollectedScalarType[] = [
      {
        scalarName: "DateTime",
        inputType: {
          typeName: "DateTimeInput",
          sourceFile: "/src/gql/types/scalars.ts",
          line: 5,
        },
        outputTypes: [
          {
            typeName: "DateTimeOutput",
            sourceFile: "/src/gql/types/scalars.ts",
            line: 8,
          },
        ],
        descriptions: [],
        isCustom: true,
      },
    ];

    it("generates createResolvers function with scalars argument", () => {
      const result = emitResolversCode(
        baseResolverInfo,
        "/src/gqlkit/__generated__",
        customScalars,
      );

      expect(result).toContain("export function createResolvers(");
      expect(result).toContain("{ scalars }");
      expect(result).toContain("scalars: {");
    });

    it("requires GraphQLScalarType with correct type parameters", () => {
      const result = emitResolversCode(
        baseResolverInfo,
        "/src/gqlkit/__generated__",
        customScalars,
      );

      expect(result).toContain('import { GraphQLScalarType } from "graphql"');
      expect(result).toContain(
        "DateTime: GraphQLScalarType<DateTimeInput, DateTimeOutput>",
      );
    });

    it("includes scalar resolver in returned Resolvers object", () => {
      const result = emitResolversCode(
        baseResolverInfo,
        "/src/gqlkit/__generated__",
        customScalars,
      );

      expect(result).toContain("DateTime: scalars.DateTime,");
      expect(result).toContain("Query: {");
    });

    it("handles multiple output types as union", () => {
      const multiOutputScalars: CollectedScalarType[] = [
        {
          scalarName: "DateTime",
          inputType: {
            typeName: "DateTimeInput",
            sourceFile: "/src/gql/types/scalars.ts",
            line: 5,
          },
          outputTypes: [
            {
              typeName: "DateTimeOutput1",
              sourceFile: "/src/gql/types/scalars.ts",
              line: 8,
            },
            {
              typeName: "DateTimeOutput2",
              sourceFile: "/src/gql/types/scalars.ts",
              line: 11,
            },
          ],
          descriptions: [],
          isCustom: true,
        },
      ];

      const result = emitResolversCode(
        baseResolverInfo,
        "/src/gqlkit/__generated__",
        multiOutputScalars,
      );

      expect(result).toContain(
        "DateTime: GraphQLScalarType<DateTimeInput, DateTimeOutput1 | DateTimeOutput2>",
      );
    });

    it("imports scalar type definitions from correct paths", () => {
      const result = emitResolversCode(
        baseResolverInfo,
        "/src/gqlkit/__generated__",
        customScalars,
      );

      expect(result).toContain("DateTimeInput");
      expect(result).toContain("DateTimeOutput");
      // Import path should be relative to output directory
      expect(result).toMatch(/import.*DateTimeInput.*from/);
    });

    it("handles multiple custom scalars", () => {
      const multiScalars: CollectedScalarType[] = [
        {
          scalarName: "DateTime",
          inputType: {
            typeName: "DateTimeInput",
            sourceFile: "/src/gql/types/scalars.ts",
            line: 5,
          },
          outputTypes: [
            {
              typeName: "DateTimeOutput",
              sourceFile: "/src/gql/types/scalars.ts",
              line: 8,
            },
          ],
          descriptions: [],
          isCustom: true,
        },
        {
          scalarName: "JSON",
          inputType: {
            typeName: "JSONInput",
            sourceFile: "/src/gql/types/json.ts",
            line: 3,
          },
          outputTypes: [
            {
              typeName: "JSONOutput",
              sourceFile: "/src/gql/types/json.ts",
              line: 6,
            },
          ],
          descriptions: [],
          isCustom: true,
        },
      ];

      const result = emitResolversCode(
        baseResolverInfo,
        "/src/gqlkit/__generated__",
        multiScalars,
      );

      expect(result).toContain(
        "DateTime: GraphQLScalarType<DateTimeInput, DateTimeOutput>",
      );
      expect(result).toContain(
        "JSON: GraphQLScalarType<JSONInput, JSONOutput>",
      );
      expect(result).toContain("DateTime: scalars.DateTime,");
      expect(result).toContain("JSON: scalars.JSON,");
    });
  });
});
