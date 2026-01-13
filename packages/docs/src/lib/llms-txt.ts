import path from "node:path";
import {
  HEADER_LINES,
  type PageInfo,
  type Section,
  buildSections,
} from "./docs-parser.js";

const BASE_URL = "https://gqlkit.izumin.dev";
const CONTENT_DIR = path.join(process.cwd(), "src/content");

const DESCRIPTION_OVERRIDES: Record<string, string> = {
  "getting-started":
    "Installation, project structure, first type and query definition.",
};

function applyDescriptionOverrides(sections: Section[]): Section[] {
  return sections.map((section) => ({
    ...section,
    pages: section.pages.map((page) => ({
      ...page,
      description: DESCRIPTION_OVERRIDES[page.slug] ?? page.description,
    })),
  }));
}

function formatLink(page: PageInfo): string {
  return `- [${page.title}](${BASE_URL}/${page.slug}): ${page.description}`;
}

export async function generateLlmsTxt(): Promise<string> {
  const rawSections = await buildSections(CONTENT_DIR);
  const sections = applyDescriptionOverrides(rawSections);

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

export async function generateLlmsFullTxt(): Promise<string> {
  const rawSections = await buildSections(CONTENT_DIR);
  const sections = applyDescriptionOverrides(rawSections);

  const lines: string[] = [...HEADER_LINES, "---", ""];

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

export function createTextResponse(content: string): Response {
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
