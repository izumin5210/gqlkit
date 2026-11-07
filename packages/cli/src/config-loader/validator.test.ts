import { describe, expect, it } from "vitest";
import { validateConfig } from "./validator.js";

describe("ConfigValidator", () => {
  const configPath = "/project/gqlkit.config.ts";

  describe("validateConfig", () => {
    it("should return valid for empty config", () => {
      const result = validateConfig({
        config: {},
        configPath,
      });

      expect(result.valid).toBe(true);
      expect(result.resolvedConfig).toBeTruthy();
      expect(result.resolvedConfig!.scalars).toEqual([]);
      expect(result.diagnostics.length).toBe(0);
    });

    it("should return valid for config with scalars", () => {
      const result = validateConfig({
        config: {
          scalars: [
            {
              name: "DateTime",
              tsType: { from: "./src/scalars", name: "DateTime" },
            },
          ],
        },
        configPath,
      });

      expect(result.valid).toBe(true);
      expect(result.resolvedConfig).toBeTruthy();
      expect(result.resolvedConfig!.scalars.length).toBe(1);
    });

    it("should return error for non-object config", () => {
      const result = validateConfig({
        config: "not an object",
        configPath,
      });

      expect(result.valid).toBe(false);
      expect(result.diagnostics.length).toBe(1);
      expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_TYPE");
    });

    it("should return error for null config", () => {
      const result = validateConfig({
        config: null,
        configPath,
      });

      expect(result.valid).toBe(false);
      expect(result.diagnostics.length).toBe(1);
      expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_TYPE");
    });

    it("should return error when scalars is not an array", () => {
      const result = validateConfig({
        config: {
          scalars: "not an array",
        },
        configPath,
      });

      expect(result.valid).toBe(false);
      expect(result.diagnostics.length).toBe(1);
      expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_TYPE");
      expect(result.diagnostics[0]?.message).toContain("scalars");
    });

    describe("removed legacy scalar format ({ graphqlName, type })", () => {
      it.each([
        {
          label: "a full legacy-shaped mapping",
          scalar: {
            graphqlName: "DateTime",
            type: { from: "./src/scalars", name: "DateTime" },
          },
          expectedMessage:
            '{ name: "DateTime", tsType: { name: "DateTime", from: "./src/scalars" } }',
        },
        {
          label: "type.from absent (global type)",
          scalar: { graphqlName: "DateTime", type: { name: "DateTime" } },
          expectedMessage: '{ name: "DateTime", tsType: { name: "DateTime" } }',
        },
        {
          label: "graphqlName missing",
          scalar: { type: { from: "./src/scalars", name: "DateTime" } },
          expectedMessage:
            '{ name: <name>, tsType: { name: "DateTime", from: "./src/scalars" } }',
        },
        {
          label: "type missing",
          scalar: { graphqlName: "DateTime" },
          expectedMessage: '{ name: "DateTime", tsType: { name: <name> } }',
        },
      ])("should return CONFIG_LEGACY_SCALAR_FORMAT for $label", ({
        scalar,
        expectedMessage,
      }) => {
        const result = validateConfig({
          config: { scalars: [scalar] },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_LEGACY_SCALAR_FORMAT");
        expect(result.diagnostics[0]?.message).toContain(expectedMessage);
      });

      it("should return CONFIG_MISSING_PROPERTY when neither format's keys are present", () => {
        const result = validateConfig({
          config: {
            scalars: [{}],
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_MISSING_PROPERTY");
        expect(result.diagnostics[0]?.message).toContain(
          "must have (name, tsType)",
        );
      });
    });

    describe("built-in scalar override", () => {
      it.each([
        "ID",
        "String",
        "Int",
        "Float",
        "Boolean",
      ])("should return error when overriding built-in scalar %s", (builtinName) => {
        const result = validateConfig({
          config: {
            scalars: [
              {
                name: builtinName,
                tsType: { from: "./src/scalars", name: "Custom" },
              },
            ],
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_BUILTIN_OVERRIDE");
        expect(result.diagnostics[0]?.message).toContain(builtinName);
      });
    });

    describe("duplicate detection", () => {
      it.each([
        {
          label: "duplicate graphqlName",
          scalars: [
            {
              name: "DateTime",
              tsType: { from: "./src/scalars", name: "DateTime" },
            },
            {
              name: "DateTime",
              tsType: { from: "./src/other", name: "OtherDateTime" },
            },
          ],
          expectedCode: "CONFIG_DUPLICATE_MAPPING",
        },
        {
          label: "duplicate type mapping",
          scalars: [
            {
              name: "DateTime",
              tsType: { from: "./src/scalars", name: "DateTime" },
            },
            {
              name: "Timestamp",
              tsType: { from: "./src/scalars", name: "DateTime" },
            },
          ],
          expectedCode: "CONFIG_DUPLICATE_TYPE",
        },
      ])("should return error for $label", ({ scalars, expectedCode }) => {
        const result = validateConfig({
          config: { scalars },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe(expectedCode);
        expect(result.diagnostics[0]?.message).toContain("DateTime");
      });

      it("should allow same type name from different paths", () => {
        const result = validateConfig({
          config: {
            scalars: [
              {
                name: "DateTime",
                tsType: { from: "./src/scalars", name: "DateTime" },
              },
              {
                name: "CustomDateTime",
                tsType: { from: "./src/custom", name: "DateTime" },
              },
            ],
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.diagnostics.length).toBe(0);
      });
    });

    describe("new scalar config format (name, tsType)", () => {
      it("should accept new format with name and tsType.name", () => {
        const result = validateConfig({
          config: {
            scalars: [
              {
                name: "DateTime",
                tsType: { name: "Date" },
              },
            ],
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.scalars.length).toBe(1);
        expect(result.resolvedConfig!.scalars[0]?.graphqlName).toBe("DateTime");
        expect(result.resolvedConfig!.scalars[0]?.typeName).toBe("Date");
        expect(result.resolvedConfig!.scalars[0]?.importPath).toBe(null);
      });

      it("should accept new format with tsType.from for module specification", () => {
        const result = validateConfig({
          config: {
            scalars: [
              {
                name: "DateTime",
                tsType: { name: "DateTimeString", from: "./src/types" },
              },
            ],
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.scalars.length).toBe(1);
        expect(result.resolvedConfig!.scalars[0]?.graphqlName).toBe("DateTime");
        expect(result.resolvedConfig!.scalars[0]?.typeName).toBe(
          "DateTimeString",
        );
        expect(result.resolvedConfig!.scalars[0]?.importPath).toBe(
          "./src/types",
        );
      });

      it.each([
        {
          label: "input",
          only: "input" as const,
          expectedOnly: "input" as const,
        },
        {
          label: "output",
          only: "output" as const,
          expectedOnly: "output" as const,
        },
        { label: "unspecified", only: undefined, expectedOnly: null },
      ])("should resolve only ($label) correctly", ({ only, expectedOnly }) => {
        const scalar: Record<string, unknown> = {
          name: "DateTime",
          tsType: { name: "Date" },
        };
        if (only !== undefined) {
          scalar["only"] = only;
        }

        const result = validateConfig({
          config: { scalars: [scalar] },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.scalars[0]?.only).toBe(expectedOnly);
      });

      it.each([
        {
          label: "provided",
          description: "ISO 8601 date-time format",
          expectedDescription: "ISO 8601 date-time format",
        },
        {
          label: "unspecified",
          description: undefined,
          expectedDescription: null,
        },
      ])("should resolve description ($label) correctly", ({
        description,
        expectedDescription,
      }) => {
        const scalar: Record<string, unknown> = {
          name: "DateTime",
          tsType: { name: "Date" },
        };
        if (description !== undefined) {
          scalar["description"] = description;
        }

        const result = validateConfig({
          config: { scalars: [scalar] },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.scalars[0]?.description).toBe(
          expectedDescription,
        );
      });

      it("should return error for invalid only value", () => {
        const result = validateConfig({
          config: {
            scalars: [
              {
                name: "DateTime",
                tsType: { name: "Date" },
                only: "invalid",
              },
            ],
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_ONLY_VALUE");
        expect(result.diagnostics[0]?.message).toContain("only");
      });

      it.each([
        {
          // A mapping without `name` is not recognized as the new format
          // (isNewFormat requires both keys), so the generic shape message is
          // reported rather than a per-field one.
          label: "name",
          scalar: { tsType: { name: "Date" } },
          messageContains: "must have (name, tsType)",
        },
        {
          label: "tsType.name",
          scalar: { name: "DateTime", tsType: {} },
          messageContains: "tsType.name",
        },
      ])("should return CONFIG_MISSING_PROPERTY when $label is missing", ({
        scalar,
        messageContains,
      }) => {
        const result = validateConfig({
          config: { scalars: [scalar] },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_MISSING_PROPERTY");
        expect(result.diagnostics[0]?.message).toContain(messageContains);
      });

      it("should allow multiple mappings for same scalar name with different only values", () => {
        const result = validateConfig({
          config: {
            scalars: [
              {
                name: "DateTime",
                tsType: { name: "Date" },
                only: "input",
              },
              {
                name: "DateTime",
                tsType: { name: "DateTimeOutput", from: "./src/types" },
                only: "output",
              },
            ],
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.scalars.length).toBe(2);
        expect(result.resolvedConfig!.scalars[0]?.graphqlName).toBe("DateTime");
        expect(result.resolvedConfig!.scalars[0]?.only).toBe("input");
        expect(result.resolvedConfig!.scalars[1]?.graphqlName).toBe("DateTime");
        expect(result.resolvedConfig!.scalars[1]?.only).toBe("output");
      });

      it("should return error for built-in scalar override in new format", () => {
        const result = validateConfig({
          config: {
            scalars: [
              {
                name: "String",
                tsType: { name: "CustomString" },
              },
            ],
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_BUILTIN_OVERRIDE");
      });
    });

    describe("output options", () => {
      it("should return error for invalid output type (not object)", () => {
        const result = validateConfig({
          config: {
            output: "invalid",
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_TYPE");
        expect(result.diagnostics[0]?.message).toContain("output");
      });
    });

    describe("tsconfigPath options", () => {
      it("should resolve tsconfigPath to null when not provided", () => {
        const result = validateConfig({
          config: {},
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.tsconfigPath).toBe(null);
      });

      it("should accept string tsconfigPath", () => {
        const result = validateConfig({
          config: {
            tsconfigPath: "./tsconfig.build.json",
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.tsconfigPath).toBe(
          "./tsconfig.build.json",
        );
      });

      it.each([
        {
          label: "non-string value",
          tsconfigPath: 123 as unknown as string,
          expectedCode: "CONFIG_INVALID_TYPE",
          messageContains: "tsconfigPath",
        },
        {
          label: "empty string",
          tsconfigPath: "",
          expectedCode: "CONFIG_INVALID_PATH",
          messageContains: "empty",
        },
      ])("should return error for $label", ({
        tsconfigPath,
        expectedCode,
        messageContains,
      }) => {
        const result = validateConfig({
          config: { tsconfigPath },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe(expectedCode);
        expect(result.diagnostics[0]?.message).toContain(messageContains);
      });
    });

    describe("sourceDir options", () => {
      it("should resolve default sourceDir when not provided", () => {
        const result = validateConfig({
          config: {},
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.sourceDir).toBe("src/gqlkit/schema");
      });

      it("should accept valid sourceDir string", () => {
        const result = validateConfig({
          config: {
            sourceDir: "src/graphql",
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.sourceDir).toBe("src/graphql");
      });

      it.each([
        {
          label: "empty string",
          sourceDir: "",
          expectedCode: "CONFIG_INVALID_SOURCE_DIR",
          messageContains: "cannot be empty",
        },
        {
          label: "non-string value",
          sourceDir: 123 as unknown as string,
          expectedCode: "CONFIG_INVALID_TYPE",
          messageContains: "sourceDir",
        },
      ])("should return error for $label", ({
        sourceDir,
        expectedCode,
        messageContains,
      }) => {
        const result = validateConfig({
          config: { sourceDir },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe(expectedCode);
        expect(result.diagnostics[0]?.message).toContain(messageContains);
      });
    });

    describe("sourceIgnoreGlobs options", () => {
      it("should resolve default sourceIgnoreGlobs when not provided", () => {
        const result = validateConfig({
          config: {},
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.sourceIgnoreGlobs).toEqual([]);
      });

      it("should accept valid glob patterns array", () => {
        const result = validateConfig({
          config: {
            sourceIgnoreGlobs: ["**/*.test.ts", "**/__tests__/**"],
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.sourceIgnoreGlobs).toEqual([
          "**/*.test.ts",
          "**/__tests__/**",
        ]);
      });

      it("should accept empty array", () => {
        const result = validateConfig({
          config: {
            sourceIgnoreGlobs: [],
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.sourceIgnoreGlobs).toEqual([]);
      });

      it.each([
        {
          label: "non-array value",
          sourceIgnoreGlobs: "**/*.test.ts" as unknown as string[],
        },
        {
          label: "array with non-string elements",
          sourceIgnoreGlobs: [
            "valid",
            123,
            "also-valid",
          ] as unknown as string[],
        },
      ])("should return error for $label", ({ sourceIgnoreGlobs }) => {
        const result = validateConfig({
          config: { sourceIgnoreGlobs },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_IGNORE_GLOBS");
        expect(result.diagnostics[0]?.message).toContain(
          "must be an array of strings",
        );
      });
    });

    describe("new output options (resolversPath, typeDefsPath, schemaPath)", () => {
      it("should resolve default output paths when output is undefined", () => {
        const result = validateConfig({
          config: {},
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.output.resolversPath).toBe(
          "src/gqlkit/__generated__/resolvers.ts",
        );
        expect(result.resolvedConfig!.output.typeDefsPath).toBe(
          "src/gqlkit/__generated__/typeDefs.ts",
        );
        expect(result.resolvedConfig!.output.schemaPath).toBe(
          "src/gqlkit/__generated__/schema.graphql",
        );
      });

      it("should resolve default paths when individual options are undefined", () => {
        const result = validateConfig({
          config: { output: {} },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.output.resolversPath).toBe(
          "src/gqlkit/__generated__/resolvers.ts",
        );
        expect(result.resolvedConfig!.output.typeDefsPath).toBe(
          "src/gqlkit/__generated__/typeDefs.ts",
        );
        expect(result.resolvedConfig!.output.schemaPath).toBe(
          "src/gqlkit/__generated__/schema.graphql",
        );
      });

      it("should use custom paths when provided", () => {
        const result = validateConfig({
          config: {
            output: {
              resolversPath: "custom/resolvers.ts",
              typeDefsPath: "custom/typeDefs.ts",
              schemaPath: "custom/schema.graphql",
            },
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.output.resolversPath).toBe(
          "custom/resolvers.ts",
        );
        expect(result.resolvedConfig!.output.typeDefsPath).toBe(
          "custom/typeDefs.ts",
        );
        expect(result.resolvedConfig!.output.schemaPath).toBe(
          "custom/schema.graphql",
        );
      });

      it("should allow null to suppress output for each path", () => {
        const result = validateConfig({
          config: {
            output: {
              resolversPath: null,
              typeDefsPath: null,
              schemaPath: null,
            },
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.output.resolversPath).toBe(null);
        expect(result.resolvedConfig!.output.typeDefsPath).toBe(null);
        expect(result.resolvedConfig!.output.schemaPath).toBe(null);
      });

      it("should allow mixed null and string", () => {
        const result = validateConfig({
          config: {
            output: {
              resolversPath: "custom/resolvers.ts",
              typeDefsPath: null,
              schemaPath: "custom/schema.graphql",
            },
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.output.resolversPath).toBe(
          "custom/resolvers.ts",
        );
        expect(result.resolvedConfig!.output.typeDefsPath).toBe(null);
        expect(result.resolvedConfig!.output.schemaPath).toBe(
          "custom/schema.graphql",
        );
      });

      // Per-field validation, table-driven across all three output path
      // fields (resolversPath/typeDefsPath/schemaPath share one validator,
      // validateOutputPath, so every field must reject the same shapes).
      describe("per-field validation", () => {
        it.each([
          { field: "resolversPath", invalidValue: 123 },
          { field: "typeDefsPath", invalidValue: true },
          { field: "schemaPath", invalidValue: {} },
        ])("should return error for invalid $field type", ({
          field,
          invalidValue,
        }) => {
          const result = validateConfig({
            config: { output: { [field]: invalidValue } },
            configPath,
          });

          expect(result.valid).toBe(false);
          expect(result.diagnostics.length).toBe(1);
          expect(result.diagnostics[0]?.code).toBe(
            "CONFIG_INVALID_OUTPUT_TYPE",
          );
          expect(result.diagnostics[0]?.message).toContain(`output.${field}`);
        });

        it.each([
          "resolversPath",
          "typeDefsPath",
          "schemaPath",
        ])("should return error for empty string %s", (field) => {
          const result = validateConfig({
            config: { output: { [field]: "" } },
            configPath,
          });

          expect(result.valid).toBe(false);
          expect(result.diagnostics.length).toBe(1);
          expect(result.diagnostics[0]?.code).toBe(
            "CONFIG_INVALID_OUTPUT_PATH",
          );
          expect(result.diagnostics[0]?.message).toContain("empty");
        });
      });
    });

    describe("output.pruning option", () => {
      it.each([
        { label: "output is undefined", config: {} },
        { label: "output.pruning is not provided", config: { output: {} } },
      ])("should default pruning to true when $label", ({ config }) => {
        const result = validateConfig({ config, configPath });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig!.output.pruning).toBe(true);
      });

      it.each([
        { pruning: false },
        { pruning: true },
      ])("should accept pruning: $pruning", ({ pruning }) => {
        const result = validateConfig({
          config: { output: { pruning } },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig!.output.pruning).toBe(pruning);
      });

      it("should return error for non-boolean pruning", () => {
        const result = validateConfig({
          config: { output: { pruning: "yes" } },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_TYPE");
        expect(result.diagnostics[0]?.message).toContain("output.pruning");
      });
    });

    describe("hooks options", () => {
      it("should resolve default empty hooks when not provided", () => {
        const result = validateConfig({
          config: {},
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.hooks.afterAllFileWrite).toEqual([]);
      });

      it.each([
        {
          label: "a single command string",
          afterAllFileWrite: "prettier --write",
          expected: ["prettier --write"],
        },
        {
          label: "an array of command strings",
          afterAllFileWrite: ["prettier --write", "eslint --fix"],
          expected: ["prettier --write", "eslint --fix"],
        },
        { label: "an empty array", afterAllFileWrite: [], expected: [] },
      ])("should normalize $label", ({ afterAllFileWrite, expected }) => {
        const result = validateConfig({
          config: { hooks: { afterAllFileWrite } },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.hooks.afterAllFileWrite).toEqual(
          expected,
        );
      });

      it("should accept hooks object without afterAllFileWrite", () => {
        const result = validateConfig({
          config: {
            hooks: {},
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.hooks.afterAllFileWrite).toEqual([]);
      });

      it("should return error for non-object hooks", () => {
        const result = validateConfig({
          config: {
            hooks: "invalid",
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_TYPE");
        expect(result.diagnostics[0]?.message).toContain("hooks");
      });

      it.each([
        { label: "invalid type (top-level)", afterAllFileWrite: 123 },
        {
          label: "invalid type (array element)",
          afterAllFileWrite: ["valid", 123, "also-valid"],
        },
      ])("should return CONFIG_INVALID_HOOK_TYPE for $label", ({
        afterAllFileWrite,
      }) => {
        const result = validateConfig({
          config: { hooks: { afterAllFileWrite } },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_HOOK_TYPE");
        expect(result.diagnostics[0]?.message).toContain("afterAllFileWrite");
      });

      it.each([
        { label: "empty command string (top-level)", afterAllFileWrite: "" },
        {
          label: "empty command string (array element)",
          afterAllFileWrite: ["prettier --write", "", "eslint --fix"],
        },
      ])("should return CONFIG_INVALID_HOOK_COMMAND for $label", ({
        afterAllFileWrite,
      }) => {
        const result = validateConfig({
          config: { hooks: { afterAllFileWrite } },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_HOOK_COMMAND");
        expect(result.diagnostics[0]?.message).toContain("empty");
      });
    });

    describe("discriminatorFields options", () => {
      it("should resolve default empty discriminatorFields when not provided", () => {
        const result = validateConfig({
          config: {},
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.discriminatorFields).toEqual(new Map());
      });

      it.each([
        {
          label: "a string value normalizes to a single-element array",
          discriminatorFields: { ContentPart: "type" },
          expected: new Map([["ContentPart", ["type"]]]),
        },
        {
          label: "an array value is kept as-is",
          discriminatorFields: { Content: ["type", "mediaType"] },
          expected: new Map([["Content", ["type", "mediaType"]]]),
        },
        {
          label: "multiple union entries are all resolved",
          discriminatorFields: {
            ContentPart: "type",
            Content: ["type", "mediaType"],
          },
          expected: new Map([
            ["ContentPart", ["type"]],
            ["Content", ["type", "mediaType"]],
          ]),
        },
      ])("should resolve discriminatorFields: $label", ({
        discriminatorFields,
        expected,
      }) => {
        const result = validateConfig({
          config: { discriminatorFields },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.discriminatorFields).toEqual(expected);
      });

      it.each([
        {
          label: "discriminatorFields is not an object",
          discriminatorFields: "invalid" as unknown as Record<string, string>,
          expectedCode: "CONFIG_INVALID_DISCRIMINATOR_FIELDS",
          messageContains: "must be an object",
        },
        {
          label: "entry value is neither string nor array",
          discriminatorFields: { ContentPart: 42 as unknown as string },
          expectedCode: "CONFIG_INVALID_DISCRIMINATOR_ENTRY",
          messageContains: 'discriminatorFields["ContentPart"]',
        },
        {
          label: "entry value is an empty string",
          discriminatorFields: { ContentPart: "" },
          expectedCode: "CONFIG_EMPTY_DISCRIMINATOR_FIELDS",
          messageContains: "empty string",
        },
        {
          label: "entry value is an empty array",
          discriminatorFields: { ContentPart: [] },
          expectedCode: "CONFIG_EMPTY_DISCRIMINATOR_FIELDS",
          messageContains: "empty array",
        },
        {
          label: "array contains non-string items",
          discriminatorFields: { ContentPart: [42] as unknown as string[] },
          expectedCode: "CONFIG_INVALID_DISCRIMINATOR_ENTRY",
          messageContains: "only strings",
        },
        {
          label: "array contains an empty string",
          discriminatorFields: { ContentPart: ["type", ""] },
          expectedCode: "CONFIG_EMPTY_DISCRIMINATOR_FIELDS",
          messageContains: "contains an empty string",
        },
      ])("should report error when $label", ({
        discriminatorFields,
        expectedCode,
        messageContains,
      }) => {
        const result = validateConfig({
          config: { discriminatorFields },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe(expectedCode);
        expect(result.diagnostics[0]?.message).toContain(messageContains);
      });
    });
  });
});
