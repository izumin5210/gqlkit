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
    it("should extract title and description from frontmatter", async () => {
      const filePath = path.join(tempDir, "test.md");
      await fs.writeFile(
        filePath,
        `---
title: Page Title
description: This is the description.
---

# Page Title

Body content here.`,
      );

      const info = await extractPageInfo(filePath, "test");

      expect(info.slug).toBe("test");
      expect(info.title).toBe("Page Title");
      expect(info.description).toBe("This is the description.");
      expect(info.content).not.toContain("---");
      expect(info.content).toContain("# Page Title");
    });

    it("should throw error when frontmatter is missing", async () => {
      const filePath = path.join(tempDir, "test.md");
      await fs.writeFile(filePath, "# Title Only\n\nContent.");

      await expect(extractPageInfo(filePath, "test")).rejects.toThrow(
        "Missing frontmatter",
      );
    });

    it("should throw error when title is missing in frontmatter", async () => {
      const filePath = path.join(tempDir, "test.md");
      await fs.writeFile(
        filePath,
        `---
description: Some description.
---

# Title`,
      );

      await expect(extractPageInfo(filePath, "test")).rejects.toThrow(
        "Missing 'title'",
      );
    });

    it("should throw error when description is missing in frontmatter", async () => {
      const filePath = path.join(tempDir, "test.md");
      await fs.writeFile(
        filePath,
        `---
title: Some Title
---

# Title`,
      );

      await expect(extractPageInfo(filePath, "test")).rejects.toThrow(
        "Missing 'description'",
      );
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
        `---
title: Getting Started
description: Intro text.
---

# Getting Started

Body content.`,
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
        `---
title: Schema Overview
description: Schema intro.
---

# Schema Overview`,
      );
      await fs.writeFile(
        path.join(sourceDir, "schema", "objects.md"),
        `---
title: Object Types
description: Object intro.
---

# Object Types`,
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
