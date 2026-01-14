import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearDocsDir,
  copyMarkdownFiles,
  formatLink,
  generateIndex,
  validateSourceDir,
} from "./bundle-docs.js";

describe("bundle-docs", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bundle-docs-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("validateSourceDir", () => {
    it("should succeed when source directory exists", async () => {
      const sourceDir = path.join(tempDir, "source");
      await fs.mkdir(sourceDir, { recursive: true });

      await expect(validateSourceDir(sourceDir)).resolves.toBeUndefined();
    });

    it("should throw error when source directory does not exist", async () => {
      const sourceDir = path.join(tempDir, "nonexistent");

      await expect(validateSourceDir(sourceDir)).rejects.toThrow(
        /Source directory not found/,
      );
    });
  });

  describe("clearDocsDir", () => {
    it("should clear existing directory contents", async () => {
      const targetDir = path.join(tempDir, "docs");
      await fs.mkdir(targetDir, { recursive: true });
      await fs.writeFile(path.join(targetDir, "existing.md"), "content");
      await fs.mkdir(path.join(targetDir, "subdir"));
      await fs.writeFile(
        path.join(targetDir, "subdir", "nested.md"),
        "nested content",
      );

      await clearDocsDir(targetDir);

      const entries = await fs.readdir(targetDir);
      expect(entries).toHaveLength(0);
    });

    it("should create directory if it does not exist", async () => {
      const targetDir = path.join(tempDir, "new-docs");

      await clearDocsDir(targetDir);

      const stat = await fs.stat(targetDir);
      expect(stat.isDirectory()).toBe(true);
    });
  });

  describe("copyMarkdownFiles", () => {
    it("should copy only markdown files preserving directory structure", async () => {
      const sourceDir = path.join(tempDir, "source");
      const targetDir = path.join(tempDir, "target");
      await fs.mkdir(sourceDir, { recursive: true });
      await fs.mkdir(path.join(sourceDir, "subdir"), { recursive: true });
      await fs.writeFile(path.join(sourceDir, "root.md"), "# Root");
      await fs.writeFile(
        path.join(sourceDir, "subdir", "nested.md"),
        "# Nested",
      );
      await fs.writeFile(path.join(sourceDir, "_meta.js"), "export default {}");
      await fs.writeFile(
        path.join(sourceDir, "subdir", "_meta.js"),
        "export default {}",
      );
      await fs.writeFile(path.join(sourceDir, "other.txt"), "text file");
      await fs.mkdir(targetDir, { recursive: true });

      await copyMarkdownFiles(sourceDir, targetDir);

      expect(await fs.readFile(path.join(targetDir, "root.md"), "utf-8")).toBe(
        "# Root",
      );
      expect(
        await fs.readFile(path.join(targetDir, "subdir", "nested.md"), "utf-8"),
      ).toBe("# Nested");

      await expect(
        fs.access(path.join(targetDir, "_meta.js")),
      ).rejects.toThrow();
      await expect(
        fs.access(path.join(targetDir, "subdir", "_meta.js")),
      ).rejects.toThrow();
      await expect(
        fs.access(path.join(targetDir, "other.txt")),
      ).rejects.toThrow();
    });
  });

  describe("formatLink", () => {
    it("should format page info as relative markdown link", () => {
      const link = formatLink({
        slug: "getting-started",
        title: "Getting Started",
        description: "How to get started",
        content: "",
      });

      expect(link).toBe(
        "- [Getting Started](./getting-started.md): How to get started",
      );
    });

    it("should handle nested paths", () => {
      const link = formatLink({
        slug: "schema/objects",
        title: "Object Types",
        description: "Define object types",
        content: "",
      });

      expect(link).toBe(
        "- [Object Types](./schema/objects.md): Define object types",
      );
    });
  });

  describe("generateIndex", () => {
    it("should generate index.md content from sections", () => {
      const sections = [
        {
          title: "Documentation",
          pages: [
            {
              slug: "getting-started",
              title: "Getting Started",
              description: "Setup guide",
              content: "",
            },
          ],
        },
        {
          title: "Schema Definition",
          pages: [
            {
              slug: "schema",
              title: "Overview",
              description: "Schema overview",
              content: "",
            },
            {
              slug: "schema/objects",
              title: "Object Types",
              description: "Object types guide",
              content: "",
            },
          ],
        },
      ];

      const content = generateIndex(sections);

      expect(content).toContain("# gqlkit");
      expect(content).toContain("## Documentation");
      expect(content).toContain(
        "- [Getting Started](./getting-started.md): Setup guide",
      );
      expect(content).toContain("## Schema Definition");
      expect(content).toContain("- [Overview](./schema.md): Schema overview");
      expect(content).toContain(
        "- [Object Types](./schema/objects.md): Object types guide",
      );
    });
  });
});
