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
  });
});
