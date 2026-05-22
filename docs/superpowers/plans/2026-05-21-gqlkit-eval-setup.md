# gqlkit eval setup Implementation Plan

> **For agentic workers:** This plan describes a setup task (scaffold + author eval fixtures). It is not TDD — agent-eval ships its own Vitest harness that runs the `EVAL.ts` files inside sandboxes. Verification is via `agent-eval --dry`, not unit tests.

**Goal:** Stand up a `@vercel/agent-eval` project under `eval/` in the gqlkit repo that compares 4 setups (graphql-codegen / Pothos / gqlkit-plain / gqlkit+skill) on 2 tasks (CRUD / relation+N+1), runnable end-to-end once API keys are supplied.

**Source spec:** `../../../slides/slides/2026-05-22-tskaigi2026/notes/09-eval-design.md`

**Architecture:**
- `eval/` lives at the repo root, **outside** pnpm-workspace (which globs `packages/*` and `examples/*`). The agent-eval sandbox installs its own deps inside ephemeral environments with `npm install`, so the project must be a standalone Node project. Outside the sandbox we still install with pnpm for the local TS surface.
- Each `eval/evals/<name>/` is a self-contained mini-project (`PROMPT.md`, `EVAL.ts`, `package.json`, `src/`). agent-eval does not provide a shared-fixture convention, so each eval copies the backing `src/db/schema.ts`. Drift is mitigated by generating fixtures from one source via a small script.
- Setup D ("gqlkit + skill") reuses gqlkit's existing `gqlkit docs` command output (`.claude/skills/gqlkit-guide/`). We do not write a bespoke SKILL.md.

**Tech Stack:** @vercel/agent-eval, vitest, graphql, @graphql-codegen/cli + server preset, @pothos/core, @izumin5210/gqlkit (local link), TypeScript, pnpm (host).

---

## Directory layout

```
gqlkit/
  eval/                                     # standalone, not in pnpm-workspace
    .env.example
    .gitignore                              # node_modules, results, .env
    package.json                            # pnpm-managed; deps: @vercel/agent-eval, vitest
    tsconfig.json
    shared/
      fixtures/
        db-schema.ts                        # source-of-truth backing schema
        loaders.ts                          # DataLoader stubs (signature only)
      skill/
        .claude/skills/gqlkit-guide/        # copied from `pnpm gqlkit docs` output
      sync-fixtures.ts                      # script: copy shared/fixtures into each eval/src/db/
    evals/
      01-crud-codegen/      { PROMPT.md, EVAL.ts, package.json, src/db/schema.ts }
      01-crud-pothos/       { same shape }
      01-crud-gqlkit-plain/ { same shape }
      01-crud-gqlkit-skill/ { same shape + .claude/skills/gqlkit-guide/ }
      02-relation-codegen/  { same }
      02-relation-pothos/   { same }
      02-relation-gqlkit-plain/
      02-relation-gqlkit-skill/
    experiments/
      sonnet.ts                             # claude-code × claude-sonnet-4-6 × runs:5
```

## Eval matrix (task × setup)

| | codegen | pothos | gqlkit-plain | gqlkit-skill |
|---|---|---|---|---|
| 01-crud | required | required | required | required |
| 02-relation | required | required | required | required |

8 eval directories total. Per `experiments/sonnet.ts` with `runs: 5`, that's 40 sandbox runs for Sonnet alone (Sonnet first, additional agents added later).

## Eval contract (uniform across setups)

Every eval has the agent produce:
- `src/schema/index.ts` (gqlkit-plain / gqlkit-skill) **or** `src/schema/index.graphql` + resolvers (codegen) **or** `src/schema/index.ts` builder (pothos) — varies by setup
- `dist/schema.graphql` — printed SDL of the final schema (written by an agent-built `print-schema.ts`, run by EVAL.ts via a helper)

EVAL.ts asserts uniformly on the printed SDL + tool-call transcript:
- (C) Type integrity: `npx tsc --noEmit` exits 0 (via `execFileSync` in EVAL.ts)
- (D) Schema sanity: `dist/schema.graphql` parses with `buildSchema`; enums are SCREAMING_SNAKE_CASE; `User` has no `email` field
- (B) N+1 avoidance (task 02 only): grep modified files for `Loader.load` / `Loader.loadMany`; bail on a forbidden pattern (`Promise.all(.*\.find`)
- (F) Sensitive fields hidden: SDL parsed `User` type has no `email`; task-3 (if added later) checks `internalNotes`

(A) and (G) — manual review only, via `results.json` transcripts archived under `eval/results/.../run-N/`.

## File responsibilities

| File | Responsibility |
|---|---|
| `eval/package.json` | Pulls in `@vercel/agent-eval`, `vitest`, `graphql`, `tsx`. Defines `sync-fixtures` script. |
| `eval/shared/fixtures/db-schema.ts` | One Drizzle-style backing schema. Source of truth, no business logic. |
| `eval/shared/fixtures/loaders.ts` | DataLoader stub signatures (`postsByUserIdLoader`, `userByIdLoader`). Body throws to force agent to wire it through Context. |
| `eval/shared/sync-fixtures.ts` | Copies `db-schema.ts` + `loaders.ts` into each `evals/*/src/db/`. Run via `pnpm sync` before commits. |
| `eval/evals/<task>-<setup>/PROMPT.md` | Plain-text task brief. Setup-specific lib instructions. No EVAL hints. |
| `eval/evals/<task>-<setup>/EVAL.ts` | Vitest assertions. Imports `__agent_eval__/results.json` for transcript checks. |
| `eval/evals/<task>-<setup>/package.json` | Sandbox-side deps. Setup-specific (codegen / pothos / gqlkit). |
| `eval/evals/01-crud-gqlkit-skill/.claude/skills/gqlkit-guide/` | Output of `pnpm gqlkit docs` copied here. |
| `eval/experiments/sonnet.ts` | `ExperimentConfig` exporting `agent: 'claude-code'`, `model: 'claude-sonnet-4-6'`, `runs: 5`, `copyFiles: 'changed'`. |

## Risks and what we accept

- **Sandbox uses npm**, not pnpm. Means `package.json` in each eval lists `@izumin5210/gqlkit` from npm registry. If we need a local linked build, we'd have to publish a tarball into the sandbox via `setup()` — defer until the registry version proves insufficient.
- **agent-eval has no shared-fixture convention**. Mitigated by `sync-fixtures.ts`; drift is detectable because each eval has the same file (`git diff` will flag).
- **Setup D is "fair" only to the extent gqlkit's published skill is loaded by claude-code.** The agent must `Read` the SKILL.md without instruction. We verify this in (A) by inspecting `results.json.filesRead`.

---

### Task 1: Initialize `eval/` project

**Files:**
- Create: `eval/package.json`, `eval/.env.example`, `eval/.gitignore`, `eval/tsconfig.json`
- Modify: repo-root `.gitignore` (add `eval/node_modules`, `eval/results`, `eval/.env`)

- [ ] `npx -y @vercel/agent-eval init eval` from gqlkit root
- [ ] Replace generated package manager calls so README and scripts are pnpm-friendly (the package.json's `packageManager` field may be left empty since the sandbox doesn't honor it)
- [ ] Add `eval/results/`, `eval/.env`, `eval/node_modules/` to `eval/.gitignore`
- [ ] Run `pnpm i` inside `eval/`
- [ ] Sanity check: `cd eval && npx @vercel/agent-eval --help` works

### Task 2: Author shared fixtures and copy gqlkit skill

**Files:**
- Create: `eval/shared/fixtures/db-schema.ts`, `eval/shared/fixtures/loaders.ts`, `eval/shared/sync-fixtures.ts`
- Create: `eval/shared/skill/.claude/skills/gqlkit-guide/SKILL.md` (+ references)

- [ ] Write `shared/fixtures/db-schema.ts`:
  - `usersTable` (id text PK, name text, email text, createdAt timestamp)
  - `postsTable` (id text PK, title text, body text, authorId fk, priority enum-as-text, internalNotes text, createdAt timestamp)
  - `export type DbUser = InferSelectModel<typeof usersTable>` (and `DbPost`)
- [ ] Write `shared/fixtures/loaders.ts`:
  - `createUserByIdLoader(): DataLoader<string, DbUser>` (body: `throw new Error("wire me via Context")`)
  - `createPostsByUserIdLoader(): DataLoader<string, DbPost[]>`
- [ ] Generate skill: `cd /tmp && pnpm dlx @izumin5210/gqlkit docs --claude --output ./gqlkit-skill-src` (or run from a scratch dir with package.json); copy `.claude/skills/gqlkit-guide/` into `eval/shared/skill/`
  - Fallback: invoke `pnpm --filter @izumin5210/gqlkit gqlkit docs` from the workspace if global install is unavailable
- [ ] `shared/sync-fixtures.ts`: glob `eval/evals/*/src/db/`, write `db-schema.ts` and `loaders.ts` into each
- [ ] `eval/package.json` scripts: `"sync": "tsx shared/sync-fixtures.ts"`

### Task 3: 01-crud — codegen variant

**Files:**
- Create: `eval/evals/01-crud-codegen/{PROMPT.md, EVAL.ts, package.json, src/db/schema.ts, src/db/loaders.ts, codegen.yml}`

- [ ] `package.json`: `graphql`, `@graphql-codegen/cli`, `@graphql-codegen/typescript`, `@graphql-codegen/typescript-resolvers`, `@eddeee888/gcg-typescript-resolver-files`, `tsx`, `typescript`
- [ ] `codegen.yml`: blank template skeleton — agent fills it in (mappers / preset selection)
- [ ] `PROMPT.md`:

```markdown
You are implementing a GraphQL API in TypeScript using **graphql-codegen with the
server preset and mappers** (eddeee888/gcg-typescript-resolver-files).

## Domain
`User { id, name, email, createdAt }` — `email` MUST NOT be exposed via GraphQL.
`Post { id, title, body, authorId, createdAt }`.

Operations:
- Query: `users`, `user(id: ID!)`, `posts`
- Mutation: `createUser(input)`, `createPost(input)`, `updatePost(input)`, `deletePost(id: ID!)`

## Fixtures
- `src/db/schema.ts` exports `DbUser`, `DbPost` (Drizzle InferSelectModel).
- `src/db/loaders.ts` exports loader factories (you do not need to call DB; treat
  loader/Repository calls as opaque).

## Output
- SDL under `src/schema/*.graphql`
- Resolver mappers configured so resolver `parent` is `DbUser` / `DbPost`
- A script `print-schema.ts` (npm script `print-schema`) that writes the merged
  SDL to `dist/schema.graphql`
- `npx tsc --noEmit` must succeed.
```

- [ ] `EVAL.ts`:

```ts
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { buildSchema, type GraphQLObjectType } from "graphql";
import { describe, expect, test } from "vitest";

const sdl = () => {
  execFileSync("npm", ["run", "print-schema"], { stdio: "pipe" });
  return readFileSync("dist/schema.graphql", "utf8");
};

describe("01-crud-codegen", () => {
  test("(C) tsc --noEmit passes", () => {
    expect(() => execFileSync("npx", ["tsc", "--noEmit"], { stdio: "pipe" })).not.toThrow();
  });
  test("(D-1) schema builds", () => {
    expect(() => buildSchema(sdl())).not.toThrow();
  });
  test("(F) User.email is not exposed", () => {
    const schema = buildSchema(sdl());
    const User = schema.getType("User") as GraphQLObjectType;
    expect(Object.keys(User.getFields())).not.toContain("email");
  });
});
```

### Task 4: 01-crud — pothos variant

**Files:**
- Create: `eval/evals/01-crud-pothos/{PROMPT.md, EVAL.ts, package.json, src/db/{schema,loaders}.ts}`

- [ ] `package.json`: `graphql`, `@pothos/core`, `tsx`, `typescript`, `@types/node`
- [ ] PROMPT.md identical to task 3 but instruction says "Pothos `SchemaBuilder`. Use `objectRef` for backing types. Print the schema via `printSchema(schema)` to `dist/schema.graphql`."
- [ ] EVAL.ts: identical assertions; `print-schema` script does `import { printSchema } from "graphql"; ...` (agent writes this)

### Task 5: 01-crud — gqlkit-plain variant

**Files:**
- Create: `eval/evals/01-crud-gqlkit-plain/{PROMPT.md, EVAL.ts, package.json, src/db/...}`

- [ ] `package.json`: `graphql`, `@izumin5210/gqlkit`, `tsx`, `typescript`
- [ ] PROMPT.md: "Use **@izumin5210/gqlkit**, a TS-first GraphQL library. See its npm page for docs." **No skill, no inline API reference.**
- [ ] EVAL.ts: identical to task 3 but the schema-print script will call `gqlkit gen` then read the generated SDL

### Task 6: 01-crud — gqlkit-skill variant

**Files:**
- Create: `eval/evals/01-crud-gqlkit-skill/{...same as task 5...}`
- Create: `eval/evals/01-crud-gqlkit-skill/.claude/skills/gqlkit-guide/` (copied from `eval/shared/skill/`)
- Create: `eval/evals/01-crud-gqlkit-skill/AGENTS.md` (referencing the skill, generated by `gqlkit docs --codex` if/when codex is added)

- [ ] Same scaffold as task 5
- [ ] After `sync-fixtures.ts`, also copy `eval/shared/skill/.claude/` into this dir
- [ ] PROMPT.md: "Use **@izumin5210/gqlkit**. A skill is bundled under `.claude/skills/gqlkit-guide/`; **read it before coding**."

### Task 7: 02-relation — codegen variant

**Files:** `eval/evals/02-relation-codegen/`

- [ ] PROMPT.md adds: "Add `User.posts: [Post!]!` and `Post.author: User!`. The reference query is `{ users { id name posts { id title } } }`. Treat DB access as `ctx.loaders.postsByUserId.load(userId)` / `ctx.loaders.userById.load(id)`. Do not use raw joins."
- [ ] EVAL.ts adds:

```ts
test("(B) User.posts resolver uses a DataLoader", () => {
  const files = ["src/resolvers/User.ts", "src/resolvers/user.ts"].filter(existsSync);
  expect(files.length).toBeGreaterThan(0);
  const code = files.map((f) => readFileSync(f, "utf8")).join("\n");
  expect(code).toMatch(/postsByUserId(Loader)?\.load(Many)?\(/);
});

test("(B) No N+1 fanout in Post.author", () => {
  const code = readFileSync("src/resolvers/Post.ts", "utf8");
  expect(code).not.toMatch(/Promise\.all\([\s\S]*?\.find\(/);
});
```

(Resolver path varies; assertion globs candidates.)

### Task 8: 02-relation — pothos / gqlkit-plain / gqlkit-skill variants

- [ ] Mirror task 7 PROMPT changes for each
- [ ] Same EVAL.ts shape — the DataLoader-call regex covers Pothos's `t.field({ resolve: (parent, _, ctx) => ctx.loaders.postsByUserId.load(parent.id) })` and gqlkit's `defineField<DbUser, NoArgs, Post[]>(({ parent, ctx }) => ctx.loaders.postsByUserId.load(parent.id))` equally

### Task 9: Experiment config

**Files:** `eval/experiments/sonnet.ts`

- [ ] Author:

```ts
import type { ExperimentConfig } from "@vercel/agent-eval";

export default {
  agent: "claude-code",
  model: "claude-sonnet-4-6",
  runs: 5,
  copyFiles: "changed",
  validation: "vitest",
  timeout: 900,
} satisfies ExperimentConfig;
```

- [ ] Add to `eval/package.json` scripts: `"sonnet:dry": "agent-eval sonnet --dry"`, `"sonnet": "agent-eval sonnet"`

### Task 10: Verify

- [ ] `cd eval && pnpm sync` — populates each `evals/*/src/db/` and the skill copy
- [ ] `cd eval && pnpm sonnet:dry` — must exit 0; resolves to "would run 8 evals × 5 runs"
- [ ] Commit. Real run waits on user supplying `.env`.

## Self-review

- Spec coverage: tasks 1+2 from notes/09-eval-design.md §1; setups A/B/C/D from §3; rubric (B)(C)(D)(F) automated via EVAL.ts; (A)(G) deferred to manual transcript review per §4. Tasks 3 and (G) explicitly out of scope per user-driven scope choice (Sonnet-only first pass).
- Placeholder scan: no `TBD` / `add later` / `similar to Task N` — every EVAL.ts and PROMPT.md is fully written above or generated from a uniform template.
- Type consistency: `DbUser` / `DbPost` names match across fixtures, prompts, and assertions; loader names (`postsByUserIdLoader`, `userByIdLoader`) consistent.
