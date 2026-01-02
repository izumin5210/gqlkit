import { print } from "graphql";
import { describe, expect, it } from "vitest";
import type { ExtractResolversResult } from "../../resolver-extractor/index.js";
import { convertToGraphQL } from "../../type-extractor/converter/graphql-converter.js";
import type { ExtractedTypeInfo } from "../../type-extractor/types/index.js";
import { buildDocumentNode } from "../builder/ast-builder.js";
import { integrate } from "../integrator/result-integrator.js";

describe("E2E: Description and Deprecated", () => {
  describe("Full pipeline with descriptions", () => {
    it("should propagate type descriptions to schema", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "User",
            kind: "interface",
            sourceFile: "/src/gql/types/user.ts",
            exportKind: "named",
            description: "A user in the system",
            deprecated: null,
          },
          fields: [
            {
              name: "id",
              tsType: {
                kind: "primitive",
                name: "string",
                nullable: false,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: false,
              description: "The unique identifier",
              deprecated: null,
            },
            {
              name: "name",
              tsType: {
                kind: "primitive",
                name: "string",
                nullable: false,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: false,
              description: "The display name",
              deprecated: null,
            },
          ],
          unionMembers: null,
          enumMembers: null,
        },
      ];

      const conversionResult = convertToGraphQL(extractedTypes);

      expect(conversionResult.diagnostics.length).toBe(0);

      const resolversResult: ExtractResolversResult = {
        queryFields: { fields: [] },
        mutationFields: { fields: [] },
        typeExtensions: [],
        diagnostics: { errors: [], warnings: [] },
      };

      const integratedResult = integrate(
        {
          types: conversionResult.types,
          diagnostics: { errors: [], warnings: [] },
        },
        resolversResult,
        null,
      );

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes('"A user in the system"')).toBeTruthy();
      expect(sdl.includes('"The unique identifier"')).toBeTruthy();
      expect(sdl.includes('"The display name"')).toBeTruthy();
    });

    it("should propagate resolver descriptions to schema", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "User",
            kind: "interface",
            sourceFile: "/src/gql/types/user.ts",
            exportKind: "named",
            description: null,
            deprecated: null,
          },
          fields: [
            {
              name: "id",
              tsType: {
                kind: "primitive",
                name: "string",
                nullable: false,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: false,
              description: null,
              deprecated: null,
            },
          ],
          unionMembers: null,
          enumMembers: null,
        },
      ];

      const conversionResult = convertToGraphQL(extractedTypes);

      const resolversResult: ExtractResolversResult = {
        queryFields: {
          fields: [
            {
              name: "me",
              type: {
                typeName: "User",
                nullable: false,
                list: false,
                listItemNullable: null,
              },
              args: null,
              sourceLocation: {
                file: "/src/gql/resolvers/queries.ts",
                line: 1,
                column: 1,
              },
              resolverExportName: null,
              description: "Get the currently authenticated user",
              deprecated: null,
            },
          ],
        },
        mutationFields: { fields: [] },
        typeExtensions: [],
        diagnostics: { errors: [], warnings: [] },
      };

      const integratedResult = integrate(
        {
          types: conversionResult.types,
          diagnostics: { errors: [], warnings: [] },
        },
        resolversResult,
        null,
      );

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(
        sdl.includes('"Get the currently authenticated user"'),
      ).toBeTruthy();
    });

    it("should propagate enum descriptions to schema", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "Status",
            kind: "enum",
            sourceFile: "/src/gql/types/status.ts",
            exportKind: "named",
            description: "The status of an item",
            deprecated: null,
          },
          fields: [],
          unionMembers: null,
          enumMembers: [
            {
              name: "ACTIVE",
              value: "active",
              description: "The item is active",
              deprecated: null,
            },
            {
              name: "INACTIVE",
              value: "inactive",
              description: "The item is not active",
              deprecated: null,
            },
          ],
        },
      ];

      const conversionResult = convertToGraphQL(extractedTypes);

      const resolversResult: ExtractResolversResult = {
        queryFields: { fields: [] },
        mutationFields: { fields: [] },
        typeExtensions: [],
        diagnostics: { errors: [], warnings: [] },
      };

      const integratedResult = integrate(
        {
          types: conversionResult.types,
          diagnostics: { errors: [], warnings: [] },
        },
        resolversResult,
        null,
      );

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes('"The status of an item"')).toBeTruthy();
      expect(sdl.includes('"The item is active"')).toBeTruthy();
      expect(sdl.includes('"The item is not active"')).toBeTruthy();
    });
  });

  describe("Full pipeline with deprecated", () => {
    it("should propagate field deprecated to schema", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "User",
            kind: "interface",
            sourceFile: "/src/gql/types/user.ts",
            exportKind: "named",
            description: null,
            deprecated: null,
          },
          fields: [
            {
              name: "id",
              tsType: {
                kind: "primitive",
                name: "string",
                nullable: false,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: false,
              description: null,
              deprecated: { isDeprecated: true, reason: "Use uuid instead" },
            },
          ],
          unionMembers: null,
          enumMembers: null,
        },
      ];

      const conversionResult = convertToGraphQL(extractedTypes);

      const resolversResult: ExtractResolversResult = {
        queryFields: { fields: [] },
        mutationFields: { fields: [] },
        typeExtensions: [],
        diagnostics: { errors: [], warnings: [] },
      };

      const integratedResult = integrate(
        {
          types: conversionResult.types,
          diagnostics: { errors: [], warnings: [] },
        },
        resolversResult,
        null,
      );

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes('@deprecated(reason: "Use uuid instead")'));
    });

    it("should propagate resolver deprecated to schema", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "User",
            kind: "interface",
            sourceFile: "/src/gql/types/user.ts",
            exportKind: "named",
            description: null,
            deprecated: null,
          },
          fields: [
            {
              name: "id",
              tsType: {
                kind: "primitive",
                name: "string",
                nullable: false,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: false,
              description: null,
              deprecated: null,
            },
          ],
          unionMembers: null,
          enumMembers: null,
        },
      ];

      const conversionResult = convertToGraphQL(extractedTypes);

      const resolversResult: ExtractResolversResult = {
        queryFields: {
          fields: [
            {
              name: "me",
              type: {
                typeName: "User",
                nullable: false,
                list: false,
                listItemNullable: null,
              },
              args: null,
              sourceLocation: {
                file: "/src/gql/resolvers/queries.ts",
                line: 1,
                column: 1,
              },
              resolverExportName: null,
              description: null,
              deprecated: { isDeprecated: true, reason: "Use currentUser" },
            },
          ],
        },
        mutationFields: { fields: [] },
        typeExtensions: [],
        diagnostics: { errors: [], warnings: [] },
      };

      const integratedResult = integrate(
        {
          types: conversionResult.types,
          diagnostics: { errors: [], warnings: [] },
        },
        resolversResult,
        null,
      );

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes('@deprecated(reason: "Use currentUser")'));
    });

    it("should propagate enum value deprecated to schema", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "Status",
            kind: "enum",
            sourceFile: "/src/gql/types/status.ts",
            exportKind: "named",
            description: null,
            deprecated: null,
          },
          fields: [],
          unionMembers: null,
          enumMembers: [
            {
              name: "ACTIVE",
              value: "active",
              description: null,
              deprecated: null,
            },
            {
              name: "INACTIVE",
              value: "inactive",
              description: null,
              deprecated: { isDeprecated: true, reason: "Use SUSPENDED" },
            },
          ],
        },
      ];

      const conversionResult = convertToGraphQL(extractedTypes);

      const resolversResult: ExtractResolversResult = {
        queryFields: { fields: [] },
        mutationFields: { fields: [] },
        typeExtensions: [],
        diagnostics: { errors: [], warnings: [] },
      };

      const integratedResult = integrate(
        {
          types: conversionResult.types,
          diagnostics: { errors: [], warnings: [] },
        },
        resolversResult,
        null,
      );

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes('@deprecated(reason: "Use SUSPENDED")'));
    });
  });

  describe("Combined description and deprecated", () => {
    it("should include both description and deprecated on field", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "User",
            kind: "interface",
            sourceFile: "/src/gql/types/user.ts",
            exportKind: "named",
            description: "A user in the system",
            deprecated: null,
          },
          fields: [
            {
              name: "id",
              tsType: {
                kind: "primitive",
                name: "string",
                nullable: false,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: false,
              description: "The unique identifier",
              deprecated: { isDeprecated: true, reason: "Use uuid instead" },
            },
          ],
          unionMembers: null,
          enumMembers: null,
        },
      ];

      const conversionResult = convertToGraphQL(extractedTypes);

      const resolversResult: ExtractResolversResult = {
        queryFields: { fields: [] },
        mutationFields: { fields: [] },
        typeExtensions: [],
        diagnostics: { errors: [], warnings: [] },
      };

      const integratedResult = integrate(
        {
          types: conversionResult.types,
          diagnostics: { errors: [], warnings: [] },
        },
        resolversResult,
        null,
      );

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(sdl.includes('"A user in the system"')).toBeTruthy();
      expect(sdl.includes('"The unique identifier"')).toBeTruthy();
      expect(sdl.includes('@deprecated(reason: "Use uuid instead")'));
    });

    it("should include both description and deprecated on resolver", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "User",
            kind: "interface",
            sourceFile: "/src/gql/types/user.ts",
            exportKind: "named",
            description: null,
            deprecated: null,
          },
          fields: [
            {
              name: "id",
              tsType: {
                kind: "primitive",
                name: "string",
                nullable: false,
                elementType: null,
                members: null,
                scalarInfo: null,
              },
              optional: false,
              description: null,
              deprecated: null,
            },
          ],
          unionMembers: null,
          enumMembers: null,
        },
      ];

      const conversionResult = convertToGraphQL(extractedTypes);

      const resolversResult: ExtractResolversResult = {
        queryFields: {
          fields: [
            {
              name: "me",
              type: {
                typeName: "User",
                nullable: false,
                list: false,
                listItemNullable: null,
              },
              args: null,
              sourceLocation: {
                file: "/src/gql/resolvers/queries.ts",
                line: 1,
                column: 1,
              },
              resolverExportName: null,
              description: "Get the currently authenticated user",
              deprecated: { isDeprecated: true, reason: "Use currentUser" },
            },
          ],
        },
        mutationFields: { fields: [] },
        typeExtensions: [],
        diagnostics: { errors: [], warnings: [] },
      };

      const integratedResult = integrate(
        {
          types: conversionResult.types,
          diagnostics: { errors: [], warnings: [] },
        },
        resolversResult,
        null,
      );

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      expect(
        sdl.includes('"Get the currently authenticated user"'),
      ).toBeTruthy();
      expect(sdl.includes('@deprecated(reason: "Use currentUser")'));
    });
  });
});
