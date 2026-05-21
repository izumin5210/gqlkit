import { execFileSync } from "node:child_process";
import type { GraphQLObjectType, GraphQLSchema } from "graphql";
import { describe, expect, test } from "vitest";

/**
 * Pothos agents usually export a `GraphQLSchema` from one of a few common
 * locations. Try them in order; surface the first hit.
 */
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

describe("01-crud · pothos", () => {
  test("(C) typecheck passes", () => {
    expect(() =>
      execFileSync("npm", ["run", "typecheck"], { stdio: "pipe" }),
    ).not.toThrow();
  });

  test("(D-1) schema builds", async () => {
    await loadSchema();
  });

  test("(D-2) declared operations exist", async () => {
    const schema = await loadSchema();
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

  test("(F) User.email is not exposed", async () => {
    const schema = await loadSchema();
    const User = schema.getType("User") as GraphQLObjectType | null;
    expect(User, "User type must exist").not.toBeNull();
    expect(Object.keys(User!.getFields())).not.toContain("email");
  });
});
