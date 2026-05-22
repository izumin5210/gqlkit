import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { GraphQLObjectType, GraphQLSchema } from "graphql";
import { describe, expect, test } from "vitest";

async function loadSchema(): Promise<GraphQLSchema> {
  const candidates = [
    "./src/schema/index.ts",
    "./src/schema.ts",
    "./src/index.ts",
    "./src/schema/builder.ts",
    "./src/builder.ts",
  ];
  const isSchema = (v: unknown): v is GraphQLSchema =>
    !!v && typeof (v as { getQueryType?: unknown }).getQueryType === "function";

  const tried: string[] = [];
  for (const path of candidates) {
    try {
      const mod: Record<string, unknown> = await import(path);
      if (isSchema(mod.schema)) return mod.schema;
      if (isSchema(mod.default)) return mod.default;
      const builder = mod.builder as
        | { toSchema?: () => GraphQLSchema }
        | undefined;
      if (builder && typeof builder.toSchema === "function") {
        return builder.toSchema();
      }
      tried.push(`${path} (no schema/default/builder export)`);
    } catch (e) {
      tried.push(`${path} (${(e as Error).message})`);
    }
  }
  throw new Error(
    `Could not load a GraphQL schema. Tried:\n  - ${tried.join("\n  - ")}`,
  );
}

function readAllAgentSource(): string {
  const skip = new Set([
    "node_modules",
    "dist",
    "__generated__",
    "__agent_eval__",
  ]);
  const buf: string[] = [];
  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      if (entry.name.startsWith(".")) continue;
      if (entry.name === "EVAL.ts" || entry.name === "EVAL.tsx") continue;
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile() && /\.(ts|tsx|graphql)$/.test(entry.name)) {
        buf.push(readFileSync(p, "utf8"));
      }
    }
  }
  walk("src");
  return buf.join("\n");
}

describe("02-relation · pothos", () => {
  test("(C) typecheck passes", () => {
    expect(() =>
      execFileSync("npm", ["run", "typecheck"], { stdio: "pipe" }),
    ).not.toThrow();
  });

  test("(D-1) schema builds", async () => {
    await loadSchema();
  });

  test("(D-2) relations declared on User and Post", async () => {
    const schema = await loadSchema();
    const User = schema.getType("User") as GraphQLObjectType | null;
    const Post = schema.getType("Post") as GraphQLObjectType | null;
    expect(User, "User type").not.toBeNull();
    expect(Post, "Post type").not.toBeNull();
    expect(Object.keys(User!.getFields())).toContain("posts");
    expect(Object.keys(Post!.getFields())).toContain("author");
  });

  test("(F) User.email is not exposed", async () => {
    const schema = await loadSchema();
    const User = schema.getType("User") as GraphQLObjectType | null;
    expect(Object.keys(User!.getFields())).not.toContain("email");
  });

  test("(B) relation resolvers use DataLoader", () => {
    const code = readAllAgentSource();
    expect(
      /postsByUserId(Loader)?\.load(Many)?\(/.test(code),
      "User.posts resolver should call ctx.loaders.postsByUserId.load(...) or .loadMany(...)",
    ).toBe(true);
    expect(
      /userById(Loader)?\.load(Many)?\(/.test(code),
      "Post.author resolver should call ctx.loaders.userById.load(...)",
    ).toBe(true);
  });

  test("(B) no obvious N+1 fanout pattern", () => {
    const code = readAllAgentSource();
    expect(
      /Promise\.all\([\s\S]{0,200}\.find(ById)?\(/.test(code),
      "Found a `Promise.all(... .find(...))` shape — likely N+1",
    ).toBe(false);
  });
});
