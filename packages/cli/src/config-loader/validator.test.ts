import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateConfig } from "./validator.js";

describe("ConfigValidator", () => {
  const configPath = "/project/gqlkit.config.ts";

  describe("validateConfig", () => {
    it("should return valid for empty config", () => {
      const result = validateConfig({
        config: {},
        configPath,
      });

      assert.equal(result.valid, true);
      assert.ok(result.resolvedConfig);
      assert.deepEqual(result.resolvedConfig.scalars, []);
      assert.equal(result.diagnostics.length, 0);
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

      assert.equal(result.valid, true);
      assert.ok(result.resolvedConfig);
      assert.equal(result.resolvedConfig.scalars.length, 1);
    });

    it("should return error for non-object config", () => {
      const result = validateConfig({
        config: "not an object",
        configPath,
      });

      assert.equal(result.valid, false);
      assert.equal(result.diagnostics.length, 1);
      assert.equal(result.diagnostics[0]?.code, "CONFIG_INVALID_TYPE");
    });

    it("should return error for null config", () => {
      const result = validateConfig({
        config: null,
        configPath,
      });

      assert.equal(result.valid, false);
      assert.equal(result.diagnostics.length, 1);
      assert.equal(result.diagnostics[0]?.code, "CONFIG_INVALID_TYPE");
    });

    it("should return error when scalars is not an array", () => {
      const result = validateConfig({
        config: {
          scalars: "not an array",
        },
        configPath,
      });

      assert.equal(result.valid, false);
      assert.equal(result.diagnostics.length, 1);
      assert.equal(result.diagnostics[0]?.code, "CONFIG_INVALID_TYPE");
      assert.ok(result.diagnostics[0]?.message.includes("scalars"));
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

      assert.equal(result.valid, false);
      assert.equal(result.diagnostics.length, 1);
      assert.equal(result.diagnostics[0]?.code, "CONFIG_MISSING_PROPERTY");
      assert.ok(result.diagnostics[0]?.message.includes("graphqlName"));
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

      assert.equal(result.valid, false);
      assert.equal(result.diagnostics.length, 1);
      assert.equal(result.diagnostics[0]?.code, "CONFIG_MISSING_PROPERTY");
      assert.ok(result.diagnostics[0]?.message.includes("type"));
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

      assert.equal(result.valid, false);
      assert.equal(result.diagnostics.length, 1);
      assert.equal(result.diagnostics[0]?.code, "CONFIG_MISSING_PROPERTY");
      assert.ok(result.diagnostics[0]?.message.includes("type.from"));
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

      assert.equal(result.valid, false);
      assert.equal(result.diagnostics.length, 1);
      assert.equal(result.diagnostics[0]?.code, "CONFIG_MISSING_PROPERTY");
      assert.ok(result.diagnostics[0]?.message.includes("type.name"));
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

          assert.equal(result.valid, false);
          assert.equal(result.diagnostics.length, 1);
          assert.equal(result.diagnostics[0]?.code, "CONFIG_BUILTIN_OVERRIDE");
          assert.ok(result.diagnostics[0]?.message.includes(builtinName));
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

        assert.equal(result.valid, false);
        assert.equal(result.diagnostics.length, 1);
        assert.equal(result.diagnostics[0]?.code, "CONFIG_DUPLICATE_MAPPING");
        assert.ok(result.diagnostics[0]?.message.includes("DateTime"));
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

        assert.equal(result.valid, false);
        assert.equal(result.diagnostics.length, 1);
        assert.equal(result.diagnostics[0]?.code, "CONFIG_DUPLICATE_TYPE");
        assert.ok(result.diagnostics[0]?.message.includes("DateTime"));
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

        assert.equal(result.valid, true);
        assert.equal(result.diagnostics.length, 0);
      });
    });

    describe("output options", () => {
      it("should resolve default output paths when output is undefined", () => {
        const result = validateConfig({
          config: {},
          configPath,
        });

        assert.equal(result.valid, true);
        assert.ok(result.resolvedConfig);
        assert.equal(
          result.resolvedConfig.output.ast,
          "src/gqlkit/generated/schema.ts",
        );
        assert.equal(
          result.resolvedConfig.output.sdl,
          "src/gqlkit/generated/schema.graphql",
        );
      });

      it("should resolve default paths when individual options are undefined", () => {
        const result = validateConfig({
          config: { output: {} },
          configPath,
        });

        assert.equal(result.valid, true);
        assert.ok(result.resolvedConfig);
        assert.equal(
          result.resolvedConfig.output.ast,
          "src/gqlkit/generated/schema.ts",
        );
        assert.equal(
          result.resolvedConfig.output.sdl,
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

        assert.equal(result.valid, true);
        assert.ok(result.resolvedConfig);
        assert.equal(result.resolvedConfig.output.ast, "custom/schema.ts");
        assert.equal(result.resolvedConfig.output.sdl, "custom/schema.graphql");
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

        assert.equal(result.valid, true);
        assert.ok(result.resolvedConfig);
        assert.equal(result.resolvedConfig.output.ast, null);
        assert.equal(result.resolvedConfig.output.sdl, null);
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

        assert.equal(result.valid, true);
        assert.ok(result.resolvedConfig);
        assert.equal(result.resolvedConfig.output.ast, "schema.ts");
        assert.equal(result.resolvedConfig.output.sdl, null);
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

        assert.equal(result.valid, false);
        assert.equal(result.diagnostics.length, 1);
        assert.equal(result.diagnostics[0]?.code, "CONFIG_INVALID_OUTPUT_TYPE");
        assert.ok(result.diagnostics[0]?.message.includes("output.ast"));
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

        assert.equal(result.valid, false);
        assert.equal(result.diagnostics.length, 1);
        assert.equal(result.diagnostics[0]?.code, "CONFIG_INVALID_OUTPUT_TYPE");
        assert.ok(result.diagnostics[0]?.message.includes("output.sdl"));
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

        assert.equal(result.valid, false);
        assert.equal(result.diagnostics.length, 1);
        assert.equal(result.diagnostics[0]?.code, "CONFIG_INVALID_OUTPUT_PATH");
        assert.ok(result.diagnostics[0]?.message.includes("empty"));
      });

      it("should return error for invalid output type (not object)", () => {
        const result = validateConfig({
          config: {
            output: "invalid",
          },
          configPath,
        });

        assert.equal(result.valid, false);
        assert.equal(result.diagnostics.length, 1);
        assert.equal(result.diagnostics[0]?.code, "CONFIG_INVALID_TYPE");
        assert.ok(result.diagnostics[0]?.message.includes("output"));
      });
    });
  });
});
