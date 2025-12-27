import assert from "node:assert";
import { describe, it } from "node:test";
import type { Diagnostic, GraphQLTypeInfo } from "../types/index.js";
import { collectResults } from "./result-collector.js";

describe("ResultCollector", () => {
  describe("collectResults", () => {
    describe("deterministic ordering", () => {
      it("should sort types alphabetically by name", () => {
        const types: GraphQLTypeInfo[] = [
          {
            name: "Zebra",
            kind: "Object",
            fields: [],
            sourceFile: "/path/to/zebra.ts",
          },
          {
            name: "Apple",
            kind: "Object",
            fields: [],
            sourceFile: "/path/to/apple.ts",
          },
          {
            name: "Mango",
            kind: "Object",
            fields: [],
            sourceFile: "/path/to/mango.ts",
          },
        ];
        const diagnostics: Diagnostic[] = [];

        const result = collectResults(types, diagnostics);

        assert.strictEqual(result.types[0]?.name, "Apple");
        assert.strictEqual(result.types[1]?.name, "Mango");
        assert.strictEqual(result.types[2]?.name, "Zebra");
      });

      it("should sort fields alphabetically within each type", () => {
        const types: GraphQLTypeInfo[] = [
          {
            name: "User",
            kind: "Object",
            fields: [
              {
                name: "zipCode",
                type: { typeName: "String", nullable: false, list: false },
              },
              {
                name: "age",
                type: { typeName: "Int", nullable: false, list: false },
              },
              {
                name: "name",
                type: { typeName: "String", nullable: false, list: false },
              },
            ],
            sourceFile: "/path/to/user.ts",
          },
        ];
        const diagnostics: Diagnostic[] = [];

        const result = collectResults(types, diagnostics);

        const fields = result.types[0]?.fields;
        assert.ok(fields);
        assert.strictEqual(fields[0]?.name, "age");
        assert.strictEqual(fields[1]?.name, "name");
        assert.strictEqual(fields[2]?.name, "zipCode");
      });

      it("should sort union members alphabetically", () => {
        const types: GraphQLTypeInfo[] = [
          {
            name: "Result",
            kind: "Union",
            unionMembers: ["Zebra", "Apple", "Mango"],
            sourceFile: "/path/to/result.ts",
          },
        ];
        const diagnostics: Diagnostic[] = [];

        const result = collectResults(types, diagnostics);

        const members = result.types[0]?.unionMembers;
        assert.ok(members);
        assert.strictEqual(members[0], "Apple");
        assert.strictEqual(members[1], "Mango");
        assert.strictEqual(members[2], "Zebra");
      });

      it("should produce same output for same input regardless of order", () => {
        const types1: GraphQLTypeInfo[] = [
          { name: "B", kind: "Object", fields: [], sourceFile: "/b.ts" },
          { name: "A", kind: "Object", fields: [], sourceFile: "/a.ts" },
        ];
        const types2: GraphQLTypeInfo[] = [
          { name: "A", kind: "Object", fields: [], sourceFile: "/a.ts" },
          { name: "B", kind: "Object", fields: [], sourceFile: "/b.ts" },
        ];

        const result1 = collectResults(types1, []);
        const result2 = collectResults(types2, []);

        assert.deepStrictEqual(result1, result2);
      });
    });

    describe("diagnostics aggregation", () => {
      it("should separate errors and warnings", () => {
        const types: GraphQLTypeInfo[] = [];
        const diagnostics: Diagnostic[] = [
          {
            code: "UNRESOLVED_REFERENCE",
            message: "Error 1",
            severity: "error",
          },
          {
            code: "UNSUPPORTED_SYNTAX",
            message: "Warning 1",
            severity: "warning",
          },
          {
            code: "PARSE_ERROR",
            message: "Error 2",
            severity: "error",
          },
        ];

        const result = collectResults(types, diagnostics);

        assert.strictEqual(result.diagnostics.errors.length, 2);
        assert.strictEqual(result.diagnostics.warnings.length, 1);
      });

      it("should remove duplicate diagnostics", () => {
        const types: GraphQLTypeInfo[] = [];
        const diagnostics: Diagnostic[] = [
          {
            code: "UNRESOLVED_REFERENCE",
            message: "Error 1",
            severity: "error",
          },
          {
            code: "UNRESOLVED_REFERENCE",
            message: "Error 1",
            severity: "error",
          },
        ];

        const result = collectResults(types, diagnostics);

        assert.strictEqual(result.diagnostics.errors.length, 1);
      });

      it("should preserve diagnostic details", () => {
        const types: GraphQLTypeInfo[] = [];
        const diagnostics: Diagnostic[] = [
          {
            code: "PARSE_ERROR",
            message: "Failed to parse",
            severity: "error",
            location: { file: "/path/to/file.ts", line: 10, column: 5 },
          },
        ];

        const result = collectResults(types, diagnostics);

        const error = result.diagnostics.errors[0];
        assert.ok(error);
        assert.strictEqual(error.code, "PARSE_ERROR");
        assert.strictEqual(error.message, "Failed to parse");
        assert.deepStrictEqual(error.location, {
          file: "/path/to/file.ts",
          line: 10,
          column: 5,
        });
      });
    });
  });
});
