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
            unionMembers: null,
            enumValues: null,
            sourceFile: "/path/to/zebra.ts",
            description: null,
            deprecated: null,
          },
          {
            name: "Apple",
            kind: "Object",
            fields: [],
            unionMembers: null,
            enumValues: null,
            sourceFile: "/path/to/apple.ts",
            description: null,
            deprecated: null,
          },
          {
            name: "Mango",
            kind: "Object",
            fields: [],
            unionMembers: null,
            enumValues: null,
            sourceFile: "/path/to/mango.ts",
            description: null,
            deprecated: null,
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
                type: {
                  typeName: "String",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
              {
                name: "age",
                type: {
                  typeName: "Int",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
              {
                name: "name",
                type: {
                  typeName: "String",
                  nullable: false,
                  list: false,
                  listItemNullable: null,
                },
                description: null,
                deprecated: null,
              },
            ],
            unionMembers: null,
            enumValues: null,
            sourceFile: "/path/to/user.ts",
            description: null,
            deprecated: null,
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
            fields: null,
            unionMembers: ["Zebra", "Apple", "Mango"],
            enumValues: null,
            sourceFile: "/path/to/result.ts",
            description: null,
            deprecated: null,
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
          {
            name: "B",
            kind: "Object",
            fields: [],
            unionMembers: null,
            enumValues: null,
            sourceFile: "/b.ts",
            description: null,
            deprecated: null,
          },
          {
            name: "A",
            kind: "Object",
            fields: [],
            unionMembers: null,
            enumValues: null,
            sourceFile: "/a.ts",
            description: null,
            deprecated: null,
          },
        ];
        const types2: GraphQLTypeInfo[] = [
          {
            name: "A",
            kind: "Object",
            fields: [],
            unionMembers: null,
            enumValues: null,
            sourceFile: "/a.ts",
            description: null,
            deprecated: null,
          },
          {
            name: "B",
            kind: "Object",
            fields: [],
            unionMembers: null,
            enumValues: null,
            sourceFile: "/b.ts",
            description: null,
            deprecated: null,
          },
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
            location: null,
          },
          {
            code: "UNSUPPORTED_SYNTAX",
            message: "Warning 1",
            severity: "warning",
            location: null,
          },
          {
            code: "PARSE_ERROR",
            message: "Error 2",
            severity: "error",
            location: null,
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
            location: null,
          },
          {
            code: "UNRESOLVED_REFERENCE",
            message: "Error 1",
            severity: "error",
            location: null,
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
