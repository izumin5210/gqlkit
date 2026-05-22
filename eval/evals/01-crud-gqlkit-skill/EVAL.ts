import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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
    // Tolerated — let the SDL collection step report the missing schema.
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

function loadAgentEvalResults(): { o11y?: { filesRead?: string[] } } | null {
  const path = "__agent_eval__/results.json";
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("01-crud · gqlkit-skill", () => {
  test("(C) typecheck passes", () => {
    expect(() =>
      execFileSync("npm", ["run", "typecheck"], { stdio: "pipe" }),
    ).not.toThrow();
  });

  test("(D-1) schema builds", () => {
    expect(() => loadSchema()).not.toThrow();
  });

  test("(D-2) declared operations exist", () => {
    const schema = loadSchema();
    const queryFields = schema.getQueryType()?.getFields() ?? {};
    const mutationFields = schema.getMutationType()?.getFields() ?? {};
    for (const name of ["users", "user", "posts"]) {
      expect(Object.keys(queryFields)).toContain(name);
    }
    for (const name of [
      "createUser",
      "createPost",
      "updatePost",
      "deletePost",
    ]) {
      expect(Object.keys(mutationFields)).toContain(name);
    }
  });

  test("(F) User.email is not exposed", () => {
    const schema = loadSchema();
    const User = schema.getType("User") as GraphQLObjectType | null;
    expect(User, "User type must exist").not.toBeNull();
    expect(Object.keys(User!.getFields())).not.toContain("email");
  });

  test("(A) agent consulted the gqlkit-guide skill", () => {
    const results = loadAgentEvalResults();
    if (results === null) return;
    const filesRead = results.o11y?.filesRead ?? [];
    expect(
      filesRead.some((f) => f.includes(".claude/skills/gqlkit-guide")),
      "agent should Read at least one file under .claude/skills/gqlkit-guide/ before coding",
    ).toBe(true);
  });
});
