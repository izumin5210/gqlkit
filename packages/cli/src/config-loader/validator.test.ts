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
              tsType: { name: "DateTime", from: "./src/scalars" },
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

    it("should return error when scalar mapping is missing name", () => {
      const result = validateConfig({
        config: {
          scalars: [
            {
              tsType: { name: "DateTime", from: "./src/scalars" },
            },
          ],
        },
        configPath,
      });

      expect(result.valid).toBe(false);
      expect(result.diagnostics.length).toBe(1);
      expect(result.diagnostics[0]?.code).toBe("CONFIG_MISSING_PROPERTY");
      expect(result.diagnostics[0]?.message).toContain("name");
    });

    it("should return error when scalar mapping is missing tsType", () => {
      const result = validateConfig({
        config: {
          scalars: [
            {
              name: "DateTime",
            },
          ],
        },
        configPath,
      });

      expect(result.valid).toBe(false);
      expect(result.diagnostics.length).toBe(1);
      expect(result.diagnostics[0]?.code).toBe("CONFIG_MISSING_PROPERTY");
      expect(result.diagnostics[0]?.message).toContain("tsType");
    });

    it("should return error when tsType.name is missing", () => {
      const result = validateConfig({
        config: {
          scalars: [
            {
              name: "DateTime",
              tsType: { from: "./src/scalars" },
            },
          ],
        },
        configPath,
      });

      expect(result.valid).toBe(false);
      expect(result.diagnostics.length).toBe(1);
      expect(result.diagnostics[0]?.code).toBe("CONFIG_MISSING_PROPERTY");
      expect(result.diagnostics[0]?.message).toContain("tsType.name");
    });

    describe("built-in scalar override", () => {
      for (const builtinName of ["ID", "String", "Int", "Float", "Boolean"]) {
        it(`should return error when overriding built-in scalar ${builtinName}`, () => {
          const result = validateConfig({
            config: {
              scalars: [
                {
                  name: builtinName,
                  tsType: { name: "Custom", from: "./src/scalars" },
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
      }
    });

    describe("duplicate detection", () => {
      it("should return error for duplicate scalar name without only", () => {
        const result = validateConfig({
          config: {
            scalars: [
              {
                name: "DateTime",
                tsType: { name: "DateTime", from: "./src/scalars" },
              },
              {
                name: "DateTime",
                tsType: { name: "OtherDateTime", from: "./src/other" },
              },
            ],
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_DUPLICATE_MAPPING");
        expect(result.diagnostics[0]?.message).toContain("DateTime");
      });

      it("should return error for duplicate type mapping", () => {
        const result = validateConfig({
          config: {
            scalars: [
              {
                name: "DateTime",
                tsType: { name: "DateTime", from: "./src/scalars" },
              },
              {
                name: "Timestamp",
                tsType: { name: "DateTime", from: "./src/scalars" },
              },
            ],
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_DUPLICATE_TYPE");
        expect(result.diagnostics[0]?.message).toContain("DateTime");
      });

      it("should allow same type name from different paths", () => {
        const result = validateConfig({
          config: {
            scalars: [
              {
                name: "DateTime",
                tsType: { name: "DateTime", from: "./src/scalars" },
              },
              {
                name: "CustomDateTime",
                tsType: { name: "DateTime", from: "./src/custom" },
              },
            ],
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.diagnostics.length).toBe(0);
      });

      it("should allow same scalar name with different only values", () => {
        const result = validateConfig({
          config: {
            scalars: [
              {
                name: "DateTime",
                tsType: { name: "DateTimeInput" },
                only: "input",
              },
              {
                name: "DateTime",
                tsType: { name: "DateTimeOutput" },
                only: "output",
              },
            ],
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.diagnostics.length).toBe(0);
        expect(result.resolvedConfig!.scalars.length).toBe(2);
      });
    });

    describe("output options (legacy tests - updated to new format)", () => {
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

      it("should return error for invalid tsconfigPath type", () => {
        const result = validateConfig({
          config: {
            tsconfigPath: 123,
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_TYPE");
        expect(result.diagnostics[0]?.message).toContain("tsconfigPath");
      });

      it("should return error for empty tsconfigPath", () => {
        const result = validateConfig({
          config: {
            tsconfigPath: "",
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_PATH");
        expect(result.diagnostics[0]?.message).toContain("empty");
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
        expect(result.resolvedConfig!.sourceDir).toBe("src/gqlkit");
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

      it("should return error for empty sourceDir", () => {
        const result = validateConfig({
          config: {
            sourceDir: "",
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_SOURCE_DIR");
        expect(result.diagnostics[0]?.message).toContain("cannot be empty");
      });

      it("should return error for non-string sourceDir", () => {
        const result = validateConfig({
          config: {
            sourceDir: 123,
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_TYPE");
        expect(result.diagnostics[0]?.message).toContain("sourceDir");
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

      it("should return error for non-array sourceIgnoreGlobs", () => {
        const result = validateConfig({
          config: {
            sourceIgnoreGlobs: "**/*.test.ts",
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_IGNORE_GLOBS");
        expect(result.diagnostics[0]?.message).toContain(
          "must be an array of strings",
        );
      });

      it("should return error for array with non-string elements", () => {
        const result = validateConfig({
          config: {
            sourceIgnoreGlobs: ["valid", 123, "also-valid"],
          },
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

    describe("new scalars format (metadata-based)", () => {
      it("should accept new scalar format with name and tsType", () => {
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
        expect(result.resolvedConfig!.scalars[0]?.only).toBe(null);
        expect(result.resolvedConfig!.scalars[0]?.description).toBe(null);
      });

      it("should accept scalar with tsType.from for module import", () => {
        const result = validateConfig({
          config: {
            scalars: [
              {
                name: "DateTime",
                tsType: { name: "DateTimeType", from: "./src/types" },
              },
            ],
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.scalars[0]?.typeName).toBe(
          "DateTimeType",
        );
        expect(result.resolvedConfig!.scalars[0]?.importPath).toBe(
          "./src/types",
        );
      });

      it("should accept scalar with only: input option", () => {
        const result = validateConfig({
          config: {
            scalars: [
              {
                name: "DateTime",
                tsType: { name: "Date" },
                only: "input",
              },
            ],
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.scalars[0]?.only).toBe("input");
      });

      it("should accept scalar with only: output option", () => {
        const result = validateConfig({
          config: {
            scalars: [
              {
                name: "DateTime",
                tsType: { name: "Date" },
                only: "output",
              },
            ],
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.scalars[0]?.only).toBe("output");
      });

      it("should accept scalar with description option", () => {
        const result = validateConfig({
          config: {
            scalars: [
              {
                name: "DateTime",
                tsType: { name: "Date" },
                description: "ISO 8601 formatted date-time",
              },
            ],
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.scalars[0]?.description).toBe(
          "ISO 8601 formatted date-time",
        );
      });

      it("should accept scalar with all options", () => {
        const result = validateConfig({
          config: {
            scalars: [
              {
                name: "DateTime",
                tsType: { name: "DateTimeInput", from: "./src/types" },
                only: "input",
                description: "Input date-time format",
              },
            ],
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        const scalar = result.resolvedConfig!.scalars[0]!;
        expect(scalar.graphqlName).toBe("DateTime");
        expect(scalar.typeName).toBe("DateTimeInput");
        expect(scalar.importPath).toBe("./src/types");
        expect(scalar.only).toBe("input");
        expect(scalar.description).toBe("Input date-time format");
      });

      it("should accept multiple scalars with same name but different only", () => {
        const result = validateConfig({
          config: {
            scalars: [
              {
                name: "DateTime",
                tsType: { name: "DateTimeInput" },
                only: "input",
              },
              {
                name: "DateTime",
                tsType: { name: "DateTimeOutput" },
                only: "output",
              },
            ],
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.scalars.length).toBe(2);
      });

      it("should return error when name is missing", () => {
        const result = validateConfig({
          config: {
            scalars: [
              {
                tsType: { name: "Date" },
              },
            ],
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBeGreaterThan(0);
        expect(result.diagnostics[0]?.message).toContain("name");
      });

      it("should return error when tsType is missing", () => {
        const result = validateConfig({
          config: {
            scalars: [
              {
                name: "DateTime",
              },
            ],
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBeGreaterThan(0);
        expect(result.diagnostics[0]?.message).toContain("tsType");
      });

      it("should return error when tsType.name is missing", () => {
        const result = validateConfig({
          config: {
            scalars: [
              {
                name: "DateTime",
                tsType: { from: "./src/types" },
              },
            ],
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBeGreaterThan(0);
        expect(result.diagnostics[0]?.message).toContain("tsType.name");
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
        expect(result.diagnostics.length).toBeGreaterThan(0);
        expect(result.diagnostics[0]?.message).toContain("only");
      });

      it("should return error for non-string description", () => {
        const result = validateConfig({
          config: {
            scalars: [
              {
                name: "DateTime",
                tsType: { name: "Date" },
                description: 123,
              },
            ],
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBeGreaterThan(0);
        expect(result.diagnostics[0]?.message).toContain("description");
      });

      it("should still reject built-in scalar names", () => {
        const result = validateConfig({
          config: {
            scalars: [
              {
                name: "String",
                tsType: { name: "MyString" },
              },
            ],
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_BUILTIN_OVERRIDE");
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

      it("should return error for invalid resolversPath type", () => {
        const result = validateConfig({
          config: {
            output: {
              resolversPath: 123,
            },
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_OUTPUT_TYPE");
        expect(result.diagnostics[0]?.message).toContain(
          "output.resolversPath",
        );
      });

      it("should return error for invalid typeDefsPath type", () => {
        const result = validateConfig({
          config: {
            output: {
              typeDefsPath: true,
            },
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_OUTPUT_TYPE");
        expect(result.diagnostics[0]?.message).toContain("output.typeDefsPath");
      });

      it("should return error for empty string resolversPath", () => {
        const result = validateConfig({
          config: {
            output: {
              resolversPath: "",
            },
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_OUTPUT_PATH");
        expect(result.diagnostics[0]?.message).toContain("empty");
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

      it("should accept single command string for afterAllFileWrite", () => {
        const result = validateConfig({
          config: {
            hooks: {
              afterAllFileWrite: "prettier --write",
            },
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.hooks.afterAllFileWrite).toEqual([
          "prettier --write",
        ]);
      });

      it("should accept array of command strings for afterAllFileWrite", () => {
        const result = validateConfig({
          config: {
            hooks: {
              afterAllFileWrite: ["prettier --write", "eslint --fix"],
            },
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.hooks.afterAllFileWrite).toEqual([
          "prettier --write",
          "eslint --fix",
        ]);
      });

      it("should accept empty array for afterAllFileWrite", () => {
        const result = validateConfig({
          config: {
            hooks: {
              afterAllFileWrite: [],
            },
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.hooks.afterAllFileWrite).toEqual([]);
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

      it("should return error for invalid afterAllFileWrite type", () => {
        const result = validateConfig({
          config: {
            hooks: {
              afterAllFileWrite: 123,
            },
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_HOOK_TYPE");
        expect(result.diagnostics[0]?.message).toContain("afterAllFileWrite");
      });

      it("should return error for array with non-string elements", () => {
        const result = validateConfig({
          config: {
            hooks: {
              afterAllFileWrite: ["valid", 123, "also-valid"],
            },
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_HOOK_TYPE");
        expect(result.diagnostics[0]?.message).toContain("afterAllFileWrite");
      });

      it("should return error for empty command string", () => {
        const result = validateConfig({
          config: {
            hooks: {
              afterAllFileWrite: "",
            },
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_HOOK_COMMAND");
        expect(result.diagnostics[0]?.message).toContain("empty");
      });

      it("should return error for array containing empty string", () => {
        const result = validateConfig({
          config: {
            hooks: {
              afterAllFileWrite: ["prettier --write", "", "eslint --fix"],
            },
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_HOOK_COMMAND");
        expect(result.diagnostics[0]?.message).toContain("empty");
      });
    });
  });
});
