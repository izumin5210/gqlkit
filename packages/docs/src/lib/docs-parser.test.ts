import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildSections, extractPageInfo } from "./docs-parser.js";

describe("docs-parser", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "docs-parser-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
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
      expect(info.content).toContain("# Page Title");
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
});
