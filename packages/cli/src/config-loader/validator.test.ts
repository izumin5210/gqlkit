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
              graphqlName: "DateTime",
              type: { from: "./src/scalars", name: "DateTime" },
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

    it("should return error when scalar mapping is missing graphqlName", () => {
      const result = validateConfig({
        config: {
          scalars: [
            {
              type: { from: "./src/scalars", name: "DateTime" },
            },
          ],
        },
        configPath,
      });

      expect(result.valid).toBe(false);
      expect(result.diagnostics.length).toBe(1);
      expect(result.diagnostics[0]?.code).toBe("CONFIG_MISSING_PROPERTY");
      expect(result.diagnostics[0]?.message).toContain("graphqlName");
    });

    it("should return error when scalar mapping is missing type", () => {
      const result = validateConfig({
        config: {
          scalars: [
            {
              graphqlName: "DateTime",
            },
          ],
        },
        configPath,
      });

      expect(result.valid).toBe(false);
      expect(result.diagnostics.length).toBe(1);
      expect(result.diagnostics[0]?.code).toBe("CONFIG_MISSING_PROPERTY");
      expect(result.diagnostics[0]?.message).toContain("type");
    });

    it("should return error when type.from is missing", () => {
      const result = validateConfig({
        config: {
          scalars: [
            {
              graphqlName: "DateTime",
              type: { name: "DateTime" },
            },
          ],
        },
        configPath,
      });

      expect(result.valid).toBe(false);
      expect(result.diagnostics.length).toBe(1);
      expect(result.diagnostics[0]?.code).toBe("CONFIG_MISSING_PROPERTY");
      expect(result.diagnostics[0]?.message).toContain("type.from");
    });

    it("should return error when type.name is missing", () => {
      const result = validateConfig({
        config: {
          scalars: [
            {
              graphqlName: "DateTime",
              type: { from: "./src/scalars" },
            },
          ],
        },
        configPath,
      });

      expect(result.valid).toBe(false);
      expect(result.diagnostics.length).toBe(1);
      expect(result.diagnostics[0]?.code).toBe("CONFIG_MISSING_PROPERTY");
      expect(result.diagnostics[0]?.message).toContain("type.name");
    });

    describe("built-in scalar override", () => {
      for (const builtinName of ["ID", "String", "Int", "Float", "Boolean"]) {
        it(`should return error when overriding built-in scalar ${builtinName}`, () => {
          const result = validateConfig({
            config: {
              scalars: [
                {
                  graphqlName: builtinName,
                  type: { from: "./src/scalars", name: "Custom" },
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
      it("should return error for duplicate graphqlName", () => {
        const result = validateConfig({
          config: {
            scalars: [
              {
                graphqlName: "DateTime",
                type: { from: "./src/scalars", name: "DateTime" },
              },
              {
                graphqlName: "DateTime",
                type: { from: "./src/other", name: "OtherDateTime" },
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
                graphqlName: "DateTime",
                type: { from: "./src/scalars", name: "DateTime" },
              },
              {
                graphqlName: "Timestamp",
                type: { from: "./src/scalars", name: "DateTime" },
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
                graphqlName: "DateTime",
                type: { from: "./src/scalars", name: "DateTime" },
              },
              {
                graphqlName: "CustomDateTime",
                type: { from: "./src/custom", name: "DateTime" },
              },
            ],
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.diagnostics.length).toBe(0);
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
  });
});
