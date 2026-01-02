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

    describe("output options", () => {
      it("should resolve default output paths when output is undefined", () => {
        const result = validateConfig({
          config: {},
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.output.ast).toBe(
          "src/gqlkit/generated/schema.ts",
        );
        expect(result.resolvedConfig!.output.sdl).toBe(
          "src/gqlkit/generated/schema.graphql",
        );
      });

      it("should resolve default paths when individual options are undefined", () => {
        const result = validateConfig({
          config: { output: {} },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.output.ast).toBe(
          "src/gqlkit/generated/schema.ts",
        );
        expect(result.resolvedConfig!.output.sdl).toBe(
          "src/gqlkit/generated/schema.graphql",
        );
      });

      it("should use custom paths when provided", () => {
        const result = validateConfig({
          config: {
            output: {
              ast: "custom/schema.ts",
              sdl: "custom/schema.graphql",
            },
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.output.ast).toBe("custom/schema.ts");
        expect(result.resolvedConfig!.output.sdl).toBe("custom/schema.graphql");
      });

      it("should allow null to suppress output", () => {
        const result = validateConfig({
          config: {
            output: {
              ast: null,
              sdl: null,
            },
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.output.ast).toBe(null);
        expect(result.resolvedConfig!.output.sdl).toBe(null);
      });

      it("should allow mixed null and string", () => {
        const result = validateConfig({
          config: {
            output: {
              ast: "schema.ts",
              sdl: null,
            },
          },
          configPath,
        });

        expect(result.valid).toBe(true);
        expect(result.resolvedConfig).toBeTruthy();
        expect(result.resolvedConfig!.output.ast).toBe("schema.ts");
        expect(result.resolvedConfig!.output.sdl).toBe(null);
      });

      it("should return error for invalid ast type (number)", () => {
        const result = validateConfig({
          config: {
            output: {
              ast: 123,
            },
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_OUTPUT_TYPE");
        expect(result.diagnostics[0]?.message).toContain("output.ast");
      });

      it("should return error for invalid sdl type (boolean)", () => {
        const result = validateConfig({
          config: {
            output: {
              sdl: true,
            },
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_OUTPUT_TYPE");
        expect(result.diagnostics[0]?.message).toContain("output.sdl");
      });

      it("should return error for empty string path", () => {
        const result = validateConfig({
          config: {
            output: {
              ast: "",
            },
          },
          configPath,
        });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.length).toBe(1);
        expect(result.diagnostics[0]?.code).toBe("CONFIG_INVALID_OUTPUT_PATH");
        expect(result.diagnostics[0]?.message).toContain("empty");
      });

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
  });
});
