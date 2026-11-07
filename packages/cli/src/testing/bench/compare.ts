/**
 * Prints a Markdown comparison of two `pnpm bench --out` results:
 * `pnpm bench:compare <base.json> <head.json> [--top <n>]`.
 */

import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { renderComparison } from "./comparison.js";
import { resolveUserPath } from "./paths.js";
import type { BenchResult } from "./result.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { top: { type: "string", default: "10" } },
});
const [basePath, headPath] = positionals;
if (basePath === undefined || headPath === undefined) {
  throw new Error("usage: bench:compare <base.json> <head.json> [--top <n>]");
}

const readResult = async (path: string) =>
  JSON.parse(await readFile(resolveUserPath(path), "utf-8")) as BenchResult;

process.stdout.write(
  renderComparison({
    base: await readResult(basePath),
    head: await readResult(headPath),
    top: Number(values.top),
  }),
);
