#!/usr/bin/env -S npx tsx
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  HEADER_LINES,
  type PageInfo,
  type Section,
  buildSections,
} from "../lib/docs-parser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(__dirname, "../../src/content");

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
  await fs.rm(targetDir, { recursive: true, force: true });
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

export async function copyMarkdownFiles(
  sourceDir: string,
  targetDir: string,
): Promise<void> {
  const mdFiles = await findMarkdownFiles(sourceDir, sourceDir);

  for (const relPath of mdFiles) {
    const sourcePath = path.join(sourceDir, relPath);
    const targetPath = path.join(targetDir, relPath);

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
  }
}

export function formatLink(page: PageInfo): string {
  return `- [${page.title}](./${page.slug}.md): ${page.description}`;
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

export async function run(targetDir: string): Promise<void> {
  await validateSourceDir(CONTENT_DIR);
  await clearDocsDir(targetDir);
  await copyMarkdownFiles(CONTENT_DIR, targetDir);

  const sections = await buildSections(CONTENT_DIR);
  const indexContent = generateIndex(sections);
  await fs.writeFile(path.join(targetDir, "index.md"), indexContent);
}

async function main() {
  const { values } = parseArgs({
    options: {
      target: {
        type: "string",
        short: "t",
      },
    },
  });

  if (!values.target) {
    console.error("Error: --target is required");
    process.exit(1);
  }

  const targetDir = path.resolve(process.cwd(), values.target);

  console.log("Bundling docs...");
  try {
    await run(targetDir);
    console.log("Docs bundled successfully to:", targetDir);
  } catch (err) {
    console.error("Failed to bundle docs:", (err as Error).message);
    process.exit(1);
  }
}

const isDirectExecution =
  process.argv[1]?.endsWith("bundle-docs.ts") ||
  process.argv[1]?.endsWith("bundle-docs.js");

if (isDirectExecution) {
  main();
}
