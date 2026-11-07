# Golden testdata

Each subdirectory here is one golden-file test case for `gen-orchestrator/golden.test.ts`. The harness (`readdir` over this directory) treats every non-`_`-prefixed subdirectory as a case; a leading underscore is the documented way to keep a fixture directory here without it being collected as a test (none currently exist, but the harness supports it).

## Family taxonomy

Case names are `<feature>-<scenario>`, grouped by feature-area prefix. The largest families (grep the directory listing for the full set):

| Prefix | Covers |
|---|---|
| `inline-payload-*` | Anonymous object/union/enum literals in resolver return types |
| `inline-union-*` | Inline unions (reference-type unions, discovered/discriminated members) |
| `inline-object-*`, `inline-enum-*`, `inline-oneof-*` | Inline object/enum/`@oneOf` generation in other contexts (fields, resolver args) |
| `string-enum-*`, `numeric-enum-*`, `ts-enum-*` | String-literal-union enums, TS numeric enums, external TS enum consumption |
| `discriminator-field-*` | `discriminatorFields` config — union member resolution via a discriminator property |
| `union-typename-*`, `union-type*` | `__typename`/`$typeName`-based union member resolution |
| `abstract-resolver-*` | Manual `defineResolveType`/`defineIsTypeOf` |
| `ignore-fields-*` | `$gqlkitIgnore`-style field exclusion |
| `auto-object-*` | Auto-generated Object types from nested inline shapes |
| `type-alias-*`, `utility-type-*` | Type-alias expansion, `Pick`/`Omit`/intersection handling |
| `default-value-*` | Argument/field default values |
| `duplicate-*` | Duplicate type/enum/field-name detection (export collisions) |
| `export-declaration-*` | `export type { X } from "..."` / `export * from "..."` handling |
| `branded-type-*`, `scalar-*` | Custom scalar detection and config |
| `subscription-*` | `defineSubscription` |
| `directive*` | Custom directive definitions and usage |
| `pruning-*`, `output-*`, `source-ignore-globs-*` | Config-level generation behavior (see below) |

Everything else is a smaller, self-contained scenario named after the specific behavior it pins (e.g. `self-referential-type`, `template-literal-type`, `schema-typename-conflict`).

## Naming rules

- **Feature families** share a common prefix (`inline-union-*`, `string-enum-*`, ...); the scenario suffix should be specific enough to read as a one-line description of what's different about this case (`-nested-objects`, `-shared-inline-object`, `-typename-priority`).
- **`-basic`** is reserved for the single canonical/minimal case in a family — the one a newcomer to that feature should read first. Don't add a second `-basic` to an existing family; extend the family with a scenario-specific name instead.
- **Error cases** (generation fails, or succeeds with diagnostics) are named so the failure is legible from the directory name alone. Two patterns are both in active use — pick whichever reads more naturally:
  - An explicit `-error`/`-errors` suffix (`abstract-resolver-error-duplicate`, `default-value-errors`), for cases where the base feature name alone wouldn't imply failure.
  - A self-describing scenario name with no `-error` suffix, when the scenario itself names the problem (`duplicate-type-export`, `inline-enum-collision-user`, `schema-typename-conflict`). Check `diagnostics.json` if a name's error/success status isn't obvious.
- **Negative "this is allowed" cases** — where the interesting assertion is the *absence* of an error for something that looks like it should conflict — use an explicit **`-allowed`** suffix (Decision D8), e.g. `duplicate-field-export-allowed` (same export name in two files is fine when the fields target different parent types). Don't reuse a bare feature name for this; `-allowed` keeps it distinguishable from both the plain feature case and any `-error` sibling that tests the actual conflicting scenario.
- Config-driven scenarios are named after the config key under test, not the feature it happens to exercise (`pruning-disabled`, `source-ignore-globs-basic`, `output-custom-paths`), since the point of the case is the config wiring, not the schema content.

MECE reminder (see root `CLAUDE.md`): before adding a case, check whether an existing case already exercises the scenario from a different angle — extend it (or its `-basic` sibling) rather than adding a near-duplicate.

## Per-case anatomy

```
<case-name>/
  tsconfig.json              # required
  config.json                 # optional — see below
  src/gqlkit/
    context.ts                 # `export type Context = ...`
    gqlkit.ts                   # `createGqlkitApis<Context>()` re-exports
    schema/**/*.ts               # the fixture source under test
    __generated__/
      diagnostics.json            # always compared (harness-only artifact, fixed path)
      typeDefs.ts, schema.graphql, resolvers.ts   # compared only on success (see below)
```

`config.json` is a `Partial<GqlkitConfig>` (same shape as `gqlkit.config.ts`'s default export, serialized to JSON) read directly by the harness — it does **not** go through `config-loader`'s TS-file loading/validation, so it can't exercise config *syntax* errors. Recognized keys, all optional (omit entirely if the case just needs defaults):

| Key | Default when omitted |
|---|---|
| `sourceDir` | `src/gqlkit/schema` |
| `sourceIgnoreGlobs` | `[]` |
| `scalars` | none |
| `discriminatorFields` | none |
| `output.resolversPath` / `.typeDefsPath` / `.schemaPath` | `src/gqlkit/__generated__/{resolvers.ts,typeDefs.ts,schema.graphql}` |
| `output.importExtension` | `"js"` |
| `output.pruning` | `true` |

When `output.*Path` is set, the corresponding golden file lives at that path (relative to the case directory) instead of the default `src/gqlkit/__generated__/` location — `diagnostics.json` is the one exception, always at the fixed default-`__generated__` path regardless of `output` config, since it's a test-only artifact with no config-driven equivalent.

On a failed generation (`result.success === false`), the harness asserts `typeDefs.ts`/`schema.graphql`/`resolvers.ts` do **not** exist at their configured (or default) path, instead of comparing content.

## Updating goldens (`-u`)

```sh
pnpm test -- packages/cli/src/gen-orchestrator/golden.test.ts -u
```

`toMatchFileSnapshot` creates a missing golden file and overwrites a mismatched existing one for the ordinary "content changed" case. It has been unreliable, though, at the two *presence* transitions a case can go through:

- success → failure (or vice versa) — the previously-written `typeDefs.ts`/`schema.graphql`/`resolvers.ts` can survive stale even though the case now fails (the harness's `assertFileNotExists` unlinks these automatically under `-u`, but only for that exact default/configured path — a leftover file at an *old* path from a since-changed `config.json` will not be cleaned up this way).
- a case's `output.*Path` changes — the golden at the *old* path is orphaned, not moved.

**When in doubt, delete the stale golden file(s) under `src/gqlkit/__generated__/` (or the case's configured output paths) before running `-u`**, then re-run and review the diff like any other generated change — don't trust `-u` alone to converge to the right state.

## Division of labor with `commands/gen.test.ts`

`golden.test.ts` and `packages/cli/src/commands/gen.test.ts` deliberately test different layers; a change should usually only need one of them:

- **`golden.test.ts`** (this directory) owns generation *content* correctness: everything downstream of "a resolved config and a `ts.Program`" — type/resolver extraction, auto-type generation, schema building, pruning, emitted SDL/TS/resolver-map bytes. Config is supplied as a pre-parsed `config.json`, bypassing `config-loader` entirely.
- **`commands/gen.test.ts`** owns the CLI-command integration `golden.test.ts` cannot reach: real `gqlkit.config.ts` file discovery and loading (via `jiti`), `--config` path resolution, config *validation* errors (syntax errors, invalid values), hook execution (`hooks.afterAllFileWrite`) after files are written, and actual filesystem writes (including failure paths like `EISDIR`). Its own custom-output-path test exists to prove the config-file → `ResolvedConfig` → writer path works end-to-end; it intentionally only spot-checks content (`content.includes("CustomType")`) rather than full golden comparison, since byte-exact output comparison is `golden.test.ts`'s job now that `output-custom-paths` covers it there too.

If you're adding a case to prove a config *value* produces the right generated output, it belongs here. If you're adding a case to prove the config *file* is discovered/loaded/validated correctly, or that hooks run, it belongs in `commands/gen.test.ts`.
