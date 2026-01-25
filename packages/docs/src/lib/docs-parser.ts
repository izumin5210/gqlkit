import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

export interface PageInfo {
  slug: string;
  title: string;
  description: string;
  content: string;
}

export interface Section {
  title: string;
  pages: PageInfo[];
}

export type MetaValue =
  | string
  | { type: "separator"; title: string }
  | { title: string; theme?: unknown };

export type Meta = Record<string, MetaValue>;

export const HEADER_LINES = [
  "# gqlkit",
  "",
  "gqlkit generates GraphQL schema and resolver maps from TypeScript types and functions.",
  "",
  "## How it works",
  "",
  "1. Write TypeScript types in `src/gqlkit/schema/` → become GraphQL types",
  "2. Write resolver functions using `defineQuery`, `defineMutation`, `defineField` → become GraphQL resolvers",
  "3. Run `gqlkit gen` → outputs `typeDefs` and `resolvers` to `src/gqlkit/__generated__/`",
  "",
  "## Design principles",
  "",
  "- **Implement first**: Write types and resolvers, generate schema when ready. No edit-regenerate-implement loops.",
  "- **Just types and functions**: Plain TypeScript with a thin API. No decorators, no complex generics.",
  "- **Type-safe**: TypeScript types become GraphQL types. Resolver signatures checked at compile time.",
  "",
];

export const SECTION_TITLES: Record<string, string> = {
  schema: "Schema Definition",
  integration: "Integration",
};

export async function loadMeta(dir: string): Promise<Meta> {
  const metaPath = path.join(dir, "_meta.js");
  const content = await fs.readFile(metaPath, "utf-8");
  const code = content.replace("export default", "module.exports =");
  const context = { module: { exports: {} } };
  vm.runInNewContext(code, context);
  return context.module.exports as Meta;
}

export function isSeparator(
  value: MetaValue,
): value is { type: "separator"; title: string } {
  return (
    typeof value === "object" && "type" in value && value.type === "separator"
  );
}

export async function extractPageInfo(
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
      const isContentLine =
        trimmed &&
        !trimmed.startsWith("#") &&
        !trimmed.startsWith("-") &&
        !trimmed.startsWith("|") &&
        !trimmed.startsWith("!") &&
        !trimmed.startsWith(">");

      if (isContentLine) {
        description = trimmed;
        break;
      }
    }
  }

  return { slug, title, description, content };
}

async function loadSubdirectoryPages(
  sourceDir: string,
  subdir: string,
): Promise<PageInfo[]> {
  const dir = path.join(sourceDir, subdir);
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

export async function buildSections(sourceDir: string): Promise<Section[]> {
  const rootMeta = await loadMeta(sourceDir);
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

    if (key === "index") continue;

    if (key in SECTION_TITLES) {
      const sectionTitle = SECTION_TITLES[key] as string;
      const subdirPages = await loadSubdirectoryPages(sourceDir, key);
      if (subdirPages.length > 0) {
        sections.push({
          title: sectionTitle,
          pages: subdirPages,
        });
      }
    } else {
      const filePath = path.join(sourceDir, `${key}.md`);
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
