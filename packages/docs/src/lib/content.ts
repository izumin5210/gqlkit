import fs from "node:fs/promises";
import path from "node:path";
import { contentDir, loadMeta, type Meta } from "@gqlkit-ts/docs-content";
import type { DynamicMeta, PageMapItem } from "nextra";
import {
  convertToPageMap,
  mergeMetaWithPageMap,
  normalizePageMap,
} from "nextra/page-map";
import { parse as parseYaml } from "yaml";

export { contentDir };

interface Content {
  /** Route (without leading slash) to the page's path relative to `contentDir`. */
  readonly mdxPages: Record<string, string>;
  readonly pageMap: PageMapItem[];
}

/**
 * Loads `_meta.js` of `dir` and its subdirectories into the nested shape
 * `mergeMetaWithPageMap()` expects, where a folder's own `_meta.js` goes under
 * `items` of its entry in the parent.
 */
async function loadMetaTree(dir: string): Promise<DynamicMeta> {
  const meta: Meta = await loadMeta(dir).catch((err: unknown) => {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw err;
  });
  const tree: DynamicMeta = { ...meta };
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const value = meta[entry.name];
    tree[entry.name] = {
      ...(typeof value === "string" ? { title: value } : value),
      items: await loadMetaTree(path.join(dir, entry.name)),
    };
  }
  return tree;
}

// convertToPageMap() only knows file paths, while the content-directory loader
// also attaches each page's front matter, which normalizePageMap() reads for
// sidebar titles and `asIndexPage`. Attach it the same way here.
async function attachFrontMatter(items: unknown[]): Promise<void> {
  for (const item of items as Record<string, unknown>[]) {
    if (Array.isArray(item.children)) {
      await attachFrontMatter(item.children);
    }
    if (typeof item.__pagePath === "string") {
      const source = await fs.readFile(
        path.join(contentDir, item.__pagePath),
        "utf8",
      );
      const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
      item.frontMatter = match ? parseYaml(match[1] ?? "") : {};
    }
  }
}

async function scanContent(): Promise<Content> {
  const filePaths = (await fs.readdir(contentDir, { recursive: true }))
    .filter((p) => /\.mdx?$/.test(p))
    .map((p) => p.split(path.sep).join("/"))
    .sort();
  const converted = convertToPageMap({ filePaths });
  await attachFrontMatter(converted.pageMap);
  return {
    mdxPages: converted.mdxPages,
    pageMap: normalizePageMap(
      mergeMetaWithPageMap(
        // convertToPageMap() returns TItem[], which nextra's own types do not
        // accept here although it is the shape this function handles.
        converted.pageMap as PageMapItem[],
        await loadMetaTree(contentDir),
      ),
    ),
  };
}

let cached: Promise<Content> | null = null;

/**
 * Scans the pages in `@gqlkit-ts/docs-content`. Production builds scan once;
 * the dev server rescans on every call so that adding, removing, or retitling
 * pages shows up without a restart, as with Nextra's own content directory.
 */
export function getContent(): Promise<Content> {
  if (process.env.NODE_ENV !== "production") {
    return scanContent();
  }
  cached ??= scanContent();
  return cached;
}
