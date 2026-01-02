import { describe, expect, it } from "vitest";
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

        expect(result.types[0]?.name).toBe("Apple");
        expect(result.types[1]?.name).toBe("Mango");
        expect(result.types[2]?.name).toBe("Zebra");
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
        expect(fields).toBeTruthy();
        expect(fields![0]?.name).toBe("age");
        expect(fields![1]?.name).toBe("name");
        expect(fields![2]?.name).toBe("zipCode");
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
        expect(members).toBeTruthy();
        expect(members![0]).toBe("Apple");
        expect(members![1]).toBe("Mango");
        expect(members![2]).toBe("Zebra");
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

        expect(result1).toEqual(result2);
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

        expect(result.diagnostics.errors.length).toBe(2);
        expect(result.diagnostics.warnings.length).toBe(1);
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

        expect(result.diagnostics.errors.length).toBe(1);
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
        expect(error).toBeTruthy();
        expect(error!.code).toBe("PARSE_ERROR");
        expect(error!.message).toBe("Failed to parse");
        expect(error!.location).toEqual({
          file: "/path/to/file.ts",
          line: 10,
          column: 5,
        });
      });
    });
  });
});
