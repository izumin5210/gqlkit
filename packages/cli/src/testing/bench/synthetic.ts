import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Generates a project far larger than any golden case, so per-type work
 * (extraction) outweighs per-run fixed costs (process startup, program
 * creation) the way it does in real codebases.
 *
 * Each domain is one schema file with an object type, its owner type, a
 * string-literal enum, an input type, a union, an inline object field,
 * cross-file references, TSDoc and a deprecation, plus a query, a list
 * query with optional arguments, a mutation and a field resolver.
 */
function domainSource(index: number, domains: number): string {
  const next = (index + 1) % domains;
  const nextImport =
    next === index
      ? ""
      : `import type { Item${next} } from "./domain${next}.js";\n`;
  return `import type { IDString, Int } from "@gqlkit-ts/runtime";
import { defineField, defineMutation, defineQuery } from "../gqlkit.js";
${nextImport}
/** Lifecycle of an item in domain ${index}. */
export type Item${index}Status = "draft" | "active" | "archived";

/** An item in domain ${index}. */
export interface Item${index} {
  __typename: "Item${index}";
  id: IDString;
  title: string;
  /** Free-form description. */
  description: string | null;
  count: Int;
  score: number;
  tags: string[];
  status: Item${index}Status;
  owner: Owner${index};
  related: Item${next} | null;
  meta: { source: string; version: Int; flags: string[] };
  /** @deprecated Use \`title\` instead. */
  name: string;
}

/** Owner of items in domain ${index}. */
export interface Owner${index} {
  id: IDString;
  displayName: string;
  email: string | null;
}

/** Returned when an item in domain ${index} does not exist. */
export interface Item${index}NotFound {
  __typename: "Item${index}NotFound";
  message: string;
}

export type Item${index}Result = Item${index} | Item${index}NotFound;

export interface CreateItem${index}Input {
  title: string;
  description: string | null;
  tags: string[];
  status: Item${index}Status;
}

/** Looks up an item in domain ${index}. */
export const item${index} = defineQuery<{ id: IDString }, Item${index}Result>(
  (_root, args) => ({ __typename: "Item${index}NotFound", message: args.id }),
);

export const items${index} = defineQuery<
  { first: Int; status: Item${index}Status | null },
  Item${index}[]
>(() => []);

export const createItem${index} = defineMutation<
  { input: CreateItem${index}Input },
  Item${index}Result
>((_root, args) => ({
  __typename: "Item${index}NotFound",
  message: args.input.title,
}));

export const items${index}OfOwner = defineField<
  Owner${index},
  { limit: Int },
  Item${index}[]
>(() => []);
`;
}

const GQLKIT_SOURCE = `import { createGqlkitApis } from "@gqlkit-ts/runtime";
import type { Context } from "./context.js";

export const { defineQuery, defineMutation, defineField } =
  createGqlkitApis<Context>();
`;

const CONTEXT_SOURCE = "export type Context = unknown;\n";

// Golden cases share this base config; reusing it keeps module resolution
// and compiler options identical to theirs.
const TSCONFIG_SOURCE = `${JSON.stringify({ extends: "../tsconfig.base.json" }, null, 2)}\n`;

interface WriteSyntheticProjectParams {
  readonly dir: string;
  readonly domains: number;
}

/** (Re)writes the synthetic project; the output depends only on `domains`. */
export async function writeSyntheticProject(
  params: WriteSyntheticProjectParams,
): Promise<void> {
  const { dir, domains } = params;
  await rm(dir, { recursive: true, force: true });
  const schemaDir = join(dir, "src/gqlkit/schema");
  await mkdir(schemaDir, { recursive: true });
  await writeFile(join(dir, "tsconfig.json"), TSCONFIG_SOURCE);
  await writeFile(join(dir, "src/gqlkit/gqlkit.ts"), GQLKIT_SOURCE);
  await writeFile(join(dir, "src/gqlkit/context.ts"), CONTEXT_SOURCE);
  for (let i = 0; i < domains; i++) {
    await writeFile(join(schemaDir, `domain${i}.ts`), domainSource(i, domains));
  }
}
