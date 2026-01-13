import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

export interface BundlerConfig {
  sourceDir: string;
  targetDir: string;
}

export interface PageInfo {
  slug: string;
  title: string;
  description: string;
}

export interface Section {
  title: string;
  pages: PageInfo[];
}

type MetaValue =
  | string
  | { type: "separator"; title: string }
  | { title: string; theme?: unknown };

type Meta = Record<string, MetaValue>;

const SECTION_TITLES: Record<string, string> = {
  schema: "Schema Definition",
  integration: "Integration",
};

const HEADER_LINES = [
  "# gqlkit",
  "",
  "> gqlkit is a convention-driven code generator for GraphQL servers in TypeScript. Define GraphQL types and resolver signatures in TypeScript, then `gqlkit gen` generates GraphQL schema AST and a resolver map from your codebase.",
  "",
];

export async function validateSourceDir(sourceDir: string): Promise<void> {
  try {
    const stat = await fs.stat(sourceDir);
    if (!stat.isDirectory()) {
      throw new Error(`Source directory not found: ${sourceDir}`);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Source directory not found: ${sourceDir}`);
    }
    throw err;
  }
}

export async function clearDocsDir(targetDir: string): Promise<void> {
  try {
    await fs.rm(targetDir, { recursive: true, force: true });
  } catch {
    // Directory might not exist, that's fine
  }
  await fs.mkdir(targetDir, { recursive: true });
}

async function findMarkdownFiles(
  dir: string,
  baseDir: string,
): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await findMarkdownFiles(fullPath, baseDir);
      files.push(...subFiles);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(path.relative(baseDir, fullPath));
    }
  }

  return files;
}

export async function copyMarkdownFiles(config: BundlerConfig): Promise<void> {
  const mdFiles = await findMarkdownFiles(config.sourceDir, config.sourceDir);

  for (const relPath of mdFiles) {
    const sourcePath = path.join(config.sourceDir, relPath);
    const targetPath = path.join(config.targetDir, relPath);

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
  }
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
        !trimmed.startsWith("!");

      if (isContentLine) {
        description = trimmed;
        break;
      }
    }
  }

  return { slug, title, description };
}

function isSeparator(
  value: MetaValue,
): value is { type: "separator"; title: string } {
  return (
    typeof value === "object" && "type" in value && value.type === "separator"
  );
}

async function loadMeta(dir: string): Promise<Meta> {
  const metaPath = path.join(dir, "_meta.js");
  const content = await fs.readFile(metaPath, "utf-8");
  const code = content.replace("export default", "module.exports =");
  const context = { module: { exports: {} } };
  vm.runInNewContext(code, context);
  return context.module.exports as Meta;
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

export function formatLink(page: PageInfo): string {
  const filePath = page.slug.includes("/")
    ? `./${page.slug}.md`
    : `./${page.slug}.md`;
  return `- [${page.title}](${filePath}): ${page.description}`;
}

export function generateIndex(sections: Section[]): string {
  const lines: string[] = [...HEADER_LINES];

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

export async function run(config: BundlerConfig): Promise<void> {
  await validateSourceDir(config.sourceDir);
  await clearDocsDir(config.targetDir);
  await copyMarkdownFiles(config);

  const sections = await buildSections(config.sourceDir);
  const indexContent = generateIndex(sections);
  await fs.writeFile(path.join(config.targetDir, "index.md"), indexContent);
}
