import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildSchema,
  type GraphQLObjectType,
  type GraphQLSchema,
} from "graphql";
import { describe, expect, test } from "vitest";

function loadSchema(): GraphQLSchema {
  try {
    execFileSync("pnpm", ["exec", "gqlkit", "gen"], { stdio: "pipe" });
  } catch {
    // Tolerated — let SDL collection report the missing schema.
  }
  const sdl = collectSdl("src");
  if (sdl.length === 0) {
    throw new Error(
      "No *.graphql files found under src/ — did `gqlkit gen` run?",
    );
  }
  return buildSchema(sdl);
}

function collectSdl(dir: string): string {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      const inner = collectSdl(p);
      if (inner) out.push(inner);
    } else if (entry.isFile() && entry.name.endsWith(".graphql")) {
      out.push(readFileSync(p, "utf8"));
    }
  }
  return out.join("\n");
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

describe("02-relation · gqlkit-plain", () => {
  test("(C) typecheck passes", () => {
    expect(() =>
      execFileSync("npm", ["run", "typecheck"], { stdio: "pipe" }),
    ).not.toThrow();
  });

  test("(D-1) schema builds", () => {
    expect(() => loadSchema()).not.toThrow();
  });

  test("(D-2) relations declared on User and Post", () => {
    const schema = loadSchema();
    const User = schema.getType("User") as GraphQLObjectType | null;
    const Post = schema.getType("Post") as GraphQLObjectType | null;
    expect(User, "User type").not.toBeNull();
    expect(Post, "Post type").not.toBeNull();
    expect(Object.keys(User!.getFields())).toContain("posts");
    expect(Object.keys(Post!.getFields())).toContain("author");
  });

  test("(F) User.email is not exposed", () => {
    const schema = loadSchema();
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
