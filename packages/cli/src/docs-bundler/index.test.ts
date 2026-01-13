import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildSections,
  clearDocsDir,
  copyMarkdownFiles,
  extractPageInfo,
  formatLink,
  generateIndex,
  validateSourceDir,
} from "./index.js";

describe("docs-bundler", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "docs-bundler-test-"));
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

      await copyMarkdownFiles({ sourceDir, targetDir });

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

  describe("extractPageInfo", () => {
    it("should extract title and description from markdown", async () => {
      const filePath = path.join(tempDir, "test.md");
      await fs.writeFile(
        filePath,
        `# Page Title

This is the description paragraph.

## Another section
More content here.`,
      );

      const info = await extractPageInfo(filePath, "test");

      expect(info.slug).toBe("test");
      expect(info.title).toBe("Page Title");
      expect(info.description).toBe("This is the description paragraph.");
    });

    it("should handle markdown without description", async () => {
      const filePath = path.join(tempDir, "test.md");
      await fs.writeFile(
        filePath,
        `# Title Only

## Section`,
      );

      const info = await extractPageInfo(filePath, "test");

      expect(info.title).toBe("Title Only");
      expect(info.description).toBe("");
    });

    it("should skip code blocks when extracting content", async () => {
      const filePath = path.join(tempDir, "test.md");
      await fs.writeFile(
        filePath,
        `# Title

\`\`\`typescript
const code = "not description";
\`\`\`

This is the real description.`,
      );

      const info = await extractPageInfo(filePath, "test");

      expect(info.description).toBe("This is the real description.");
    });
  });

  describe("buildSections", () => {
    it("should build sections from _meta.js structure", async () => {
      const sourceDir = path.join(tempDir, "content");
      await fs.mkdir(sourceDir, { recursive: true });
      await fs.writeFile(
        path.join(sourceDir, "_meta.js"),
        `export default {
  index: { title: "Home" },
  "getting-started": "Getting Started",
  "-- Guides": { type: "separator", title: "Guides" },
  schema: "Schema",
};`,
      );
      await fs.writeFile(
        path.join(sourceDir, "getting-started.md"),
        "# Getting Started\n\nIntro text.",
      );

      await fs.mkdir(path.join(sourceDir, "schema"), { recursive: true });
      await fs.writeFile(
        path.join(sourceDir, "schema", "_meta.js"),
        `export default {
  index: "Overview",
  objects: "Object Types",
};`,
      );
      await fs.writeFile(
        path.join(sourceDir, "schema", "index.md"),
        "# Schema Overview\n\nSchema intro.",
      );
      await fs.writeFile(
        path.join(sourceDir, "schema", "objects.md"),
        "# Object Types\n\nObject intro.",
      );

      const sections = await buildSections(sourceDir);

      expect(sections).toHaveLength(2);
      expect(sections[0]?.title).toBe("Documentation");
      expect(sections[0]?.pages).toHaveLength(1);
      expect(sections[0]?.pages[0]?.slug).toBe("getting-started");

      expect(sections[1]?.title).toBe("Schema Definition");
      expect(sections[1]?.pages).toHaveLength(2);
    });
  });

  describe("formatLink", () => {
    it("should format page info as relative markdown link", () => {
      const link = formatLink({
        slug: "getting-started",
        title: "Getting Started",
        description: "How to get started",
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
            },
            {
              slug: "schema/objects",
              title: "Object Types",
              description: "Object types guide",
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
