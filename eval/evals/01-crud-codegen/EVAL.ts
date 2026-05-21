import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildSchema,
  type GraphQLObjectType,
  type GraphQLSchema,
} from "graphql";
import { describe, expect, test } from "vitest";

/**
 * `graphql-codegen` typically generates resolver TS that the agent's resolvers
 * depend on. Run it before typecheck so the agent doesn't need to keep build
 * artifacts checked in. The SDL itself is whatever `.graphql` the agent wrote
 * under `src/`.
 */
function loadSchema(): GraphQLSchema {
  try {
    execFileSync("pnpm", ["exec", "graphql-codegen"], { stdio: "pipe" });
  } catch {
    // No codegen.yml or codegen failure → still try to read SDL files.
  }
  const sdl = collectSdl("src");
  if (sdl.length === 0) {
    throw new Error(
      "No *.graphql files found under src/ — agent did not produce SDL",
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

describe("01-crud · codegen", () => {
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
});
