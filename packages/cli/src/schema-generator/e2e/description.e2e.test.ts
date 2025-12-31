import assert from "node:assert";
import { describe, it } from "node:test";
import { print } from "graphql";
import type { ExtractResolversResult } from "../../resolver-extractor/index.js";
import { convertToGraphQL } from "../../type-extractor/converter/graphql-converter.js";
import type { ExtractedTypeInfo } from "../../type-extractor/extractor/type-extractor.js";
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
          },
          fields: [
            {
              name: "id",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
              description: "The unique identifier",
            },
            {
              name: "name",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
              description: "The display name",
            },
          ],
        },
      ];

      const conversionResult = convertToGraphQL(extractedTypes);

      assert.strictEqual(conversionResult.diagnostics.length, 0);

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
      );

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      assert.ok(sdl.includes('"A user in the system"'));
      assert.ok(sdl.includes('"The unique identifier"'));
      assert.ok(sdl.includes('"The display name"'));
    });

    it("should propagate resolver descriptions to schema", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "User",
            kind: "interface",
            sourceFile: "/src/gql/types/user.ts",
            exportKind: "named",
          },
          fields: [
            {
              name: "id",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
            },
          ],
        },
      ];

      const conversionResult = convertToGraphQL(extractedTypes);

      const resolversResult: ExtractResolversResult = {
        queryFields: {
          fields: [
            {
              name: "me",
              type: { typeName: "User", nullable: false, list: false },
              sourceLocation: {
                file: "/src/gql/resolvers/queries.ts",
                line: 1,
                column: 1,
              },
              description: "Get the currently authenticated user",
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
      );

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      assert.ok(sdl.includes('"Get the currently authenticated user"'));
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
          },
          fields: [],
          enumMembers: [
            {
              name: "ACTIVE",
              value: "active",
              description: "The item is active",
            },
            {
              name: "INACTIVE",
              value: "inactive",
              description: "The item is not active",
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
      );

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      assert.ok(sdl.includes('"The status of an item"'));
      assert.ok(sdl.includes('"The item is active"'));
      assert.ok(sdl.includes('"The item is not active"'));
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
          },
          fields: [
            {
              name: "id",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
              deprecated: { isDeprecated: true, reason: "Use uuid instead" },
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
      );

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      assert.ok(sdl.includes('@deprecated(reason: "Use uuid instead")'));
    });

    it("should propagate resolver deprecated to schema", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "User",
            kind: "interface",
            sourceFile: "/src/gql/types/user.ts",
            exportKind: "named",
          },
          fields: [
            {
              name: "id",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
            },
          ],
        },
      ];

      const conversionResult = convertToGraphQL(extractedTypes);

      const resolversResult: ExtractResolversResult = {
        queryFields: {
          fields: [
            {
              name: "me",
              type: { typeName: "User", nullable: false, list: false },
              sourceLocation: {
                file: "/src/gql/resolvers/queries.ts",
                line: 1,
                column: 1,
              },
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
      );

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      assert.ok(sdl.includes('@deprecated(reason: "Use currentUser")'));
    });

    it("should propagate enum value deprecated to schema", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "Status",
            kind: "enum",
            sourceFile: "/src/gql/types/status.ts",
            exportKind: "named",
          },
          fields: [],
          enumMembers: [
            { name: "ACTIVE", value: "active" },
            {
              name: "INACTIVE",
              value: "inactive",
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
      );

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      assert.ok(sdl.includes('@deprecated(reason: "Use SUSPENDED")'));
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
          },
          fields: [
            {
              name: "id",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
              description: "The unique identifier",
              deprecated: { isDeprecated: true, reason: "Use uuid instead" },
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
      );

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      assert.ok(sdl.includes('"A user in the system"'));
      assert.ok(sdl.includes('"The unique identifier"'));
      assert.ok(sdl.includes('@deprecated(reason: "Use uuid instead")'));
    });

    it("should include both description and deprecated on resolver", () => {
      const extractedTypes: ExtractedTypeInfo[] = [
        {
          metadata: {
            name: "User",
            kind: "interface",
            sourceFile: "/src/gql/types/user.ts",
            exportKind: "named",
          },
          fields: [
            {
              name: "id",
              tsType: { kind: "primitive", name: "string", nullable: false },
              optional: false,
            },
          ],
        },
      ];

      const conversionResult = convertToGraphQL(extractedTypes);

      const resolversResult: ExtractResolversResult = {
        queryFields: {
          fields: [
            {
              name: "me",
              type: { typeName: "User", nullable: false, list: false },
              sourceLocation: {
                file: "/src/gql/resolvers/queries.ts",
                line: 1,
                column: 1,
              },
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
      );

      const doc = buildDocumentNode(integratedResult);
      const sdl = print(doc);

      assert.ok(sdl.includes('"Get the currently authenticated user"'));
      assert.ok(sdl.includes('@deprecated(reason: "Use currentUser")'));
    });
  });
});
