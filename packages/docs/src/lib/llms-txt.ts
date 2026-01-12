import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const BASE_URL = "https://gqlkit.izumin.dev";
const CONTENT_DIR = path.join(process.cwd(), "src/content");

type PageInfo = {
  slug: string;
  title: string;
  description: string;
  content: string;
};

type Section = {
  title: string;
  pages: PageInfo[];
};

type MetaValue =
  | string
  | { type: "separator"; title: string }
  | { title: string; theme?: unknown };

type Meta = Record<string, MetaValue>;

const SECTION_CONFIG: Record<string, { title: string; optional?: boolean }> = {
  schema: { title: "Schema Definition" },
  integration: { title: "Integration", optional: true },
};

const DESCRIPTION_OVERRIDES: Record<string, string> = {
  "getting-started":
    "Installation, project structure, first type and query definition.",
};

async function loadMeta(dir: string): Promise<Meta> {
  const metaPath = path.join(dir, "_meta.js");
  const content = await fs.readFile(metaPath, "utf-8");
  const code = content.replace("export default", "module.exports =");
  const context = { module: { exports: {} } };
  vm.runInNewContext(code, context);
  return context.module.exports as Meta;
}

async function extractPageInfo(
  filePath: string,
  slug: string,
): Promise<PageInfo> {
  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split("\n");

  let title = slug;
  let description = "";
  let titleFound = false;
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) continue;

    if (!titleFound && line.startsWith("# ")) {
      title = line.slice(2).trim();
      titleFound = true;
      continue;
    }

    if (titleFound && !description) {
      const trimmed = line.trim();
      if (
        trimmed &&
        !trimmed.startsWith("#") &&
        !trimmed.startsWith("-") &&
        !trimmed.startsWith("|") &&
        !trimmed.startsWith("!")
      ) {
        description = trimmed;
        break;
      }
    }
  }

  if (DESCRIPTION_OVERRIDES[slug]) {
    description = DESCRIPTION_OVERRIDES[slug];
  }

  return { slug, title, description, content };
}

function isDirectory(key: string): boolean {
  return key in SECTION_CONFIG;
}

function isSeparator(value: MetaValue): value is { type: "separator"; title: string } {
  return typeof value === "object" && "type" in value && value.type === "separator";
}

function isSkippedPage(key: string): boolean {
  return key === "index";
}

async function loadSubdirectoryPages(
  subdir: string,
): Promise<PageInfo[]> {
  const dir = path.join(CONTENT_DIR, subdir);
  const meta = await loadMeta(dir);
  const pages: PageInfo[] = [];

  for (const [key, value] of Object.entries(meta)) {
    if (key.startsWith("--") || isSeparator(value)) continue;

    const slug = key === "index" ? subdir : `${subdir}/${key}`;
    const fileName = key === "index" ? "index.md" : `${key}.md`;
    const filePath = path.join(dir, fileName);

    try {
      const pageInfo = await extractPageInfo(filePath, slug);
      pages.push(pageInfo);
    } catch {
      // File doesn't exist, skip
    }
  }

  return pages;
}

async function buildSections(): Promise<Section[]> {
  const rootMeta = await loadMeta(CONTENT_DIR);
  const sections: Section[] = [];

  let currentSection: Section = { title: "Documentation", pages: [] };

  for (const [key, value] of Object.entries(rootMeta)) {
    if (key.startsWith("--") || isSeparator(value)) {
      if (currentSection.pages.length > 0) {
        sections.push(currentSection);
      }
      const sectionTitle = isSeparator(value) ? value.title : key.slice(3);
      currentSection = { title: sectionTitle, pages: [] };
      continue;
    }

    if (isSkippedPage(key)) continue;

    if (isDirectory(key)) {
      const config = SECTION_CONFIG[key];
      const subdirPages = await loadSubdirectoryPages(key);
      if (subdirPages.length > 0) {
        sections.push({
          title: config.optional ? "Optional" : config.title,
          pages: subdirPages,
        });
      }
    } else {
      const filePath = path.join(CONTENT_DIR, `${key}.md`);
      try {
        const pageInfo = await extractPageInfo(filePath, key);
        currentSection.pages.push(pageInfo);
      } catch {
        // File doesn't exist, skip
      }
    }
  }

  if (currentSection.pages.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

function formatLink(page: PageInfo): string {
  return `- [${page.title}](${BASE_URL}/${page.slug}): ${page.description}`;
}

export async function generateLlmsTxt(): Promise<string> {
  const sections = await buildSections();

  const lines: string[] = [
    "# gqlkit",
    "",
    "> gqlkit is a convention-driven code generator for GraphQL servers in TypeScript. Define GraphQL types and resolver signatures in TypeScript, then `gqlkit gen` generates GraphQL schema AST and a resolver map from your codebase.",
    "",
  ];

  for (const section of sections) {
    lines.push(`## ${section.title}`);
    lines.push("");
    for (const page of section.pages) {
      lines.push(formatLink(page));
    }
    lines.push("");
  }

  return lines.join("\n");
}

export async function generateLlmsFullTxt(): Promise<string> {
  const sections = await buildSections();

  const lines: string[] = [
    "# gqlkit",
    "",
    "> gqlkit is a convention-driven code generator for GraphQL servers in TypeScript. Define GraphQL types and resolver signatures in TypeScript, then `gqlkit gen` generates GraphQL schema AST and a resolver map from your codebase.",
    "",
    "---",
    "",
  ];

  for (const section of sections) {
    for (const page of section.pages) {
      lines.push(page.content.trim());
      lines.push("");
      lines.push("---");
      lines.push("");
    }
  }

  return lines.join("\n");
}
