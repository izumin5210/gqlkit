/**
 * dependency-cruiser configuration enforcing the target dependency direction for
 * packages/cli/src described in .kiro/specs/refactor-plan.md:
 *   - §3.1 "Target Architecture / Module layout": core ← shared ← stages ← gen-orchestrator ← commands,
 *     a strict DAG where no stage may import another stage's internals.
 *   - §3.4 "Enforcement": dependency-cruiser is the mechanism chosen (Decision D7) to make the
 *     dependency rule machine-checked instead of only documented.
 *
 * Mode: fully enforcing. Phase 0 shipped this in baselined report-only mode via
 * `.dependency-cruiser-known-violations.json` and the `--ignore-known` CLI flag, so pre-existing
 * violations (see §1.2 "Architecture-level findings") wouldn't fail the build while later phases
 * paid the baseline down. Phases 1-9 closed every baselined entry (the last one, the config-loader
 * `loader.ts ↔ validator.ts` cycle, in Phase 9); the baseline file and `--ignore-known` flag have
 * been removed, so any new violation now fails the build immediately.
 */

/** Pipeline stages that must only be imported through their own `index.ts` facade (§3.2). */
const PIPELINE_STAGES = [
  "type-extractor",
  "resolver-extractor",
  "auto-type-generator",
  "schema-generator",
];

const path = require("node:path");

module.exports = {
  forbidden: [
    {
      name: "no-circular",
      comment:
        "Circular dependencies are incompatible with the target strict-DAG dependency rule " +
        "(refactor-plan.md §3.1). §1.2-B documents the cycles this rule baselines today " +
        "(type-extractor ↔ auto-type-generator, resolver-extractor ↔ schema-generator, shared ↔ type-extractor).",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    ...PIPELINE_STAGES.map((stage) => ({
      name: `stage-boundary-${stage}`,
      comment:
        `Each pipeline stage is a facade: only its index.ts is a valid import target from outside ` +
        `the stage (refactor-plan.md §3.1/§3.2). Deep imports into "${stage}" internals bypass the ` +
        `facade and are the root cause tracked in §1.2-A (e.g. gen-orchestrator/orchestrator.ts deep` +
        `-importing 9+ internal modules; schema-generator deep-importing auto-type-generator internals; ` +
        `resolver-extractor deep-importing schema-generator internals) — all baselined here for now.`,
      severity: "error",
      from: { pathNot: `^packages/cli/src/${stage}/` },
      to: { path: `^packages/cli/src/${stage}/(?!index\\.ts$).+` },
    })),
    {
      name: "core-no-internal-dependencies",
      comment:
        "core/ is the innermost layer of the target dependency direction " +
        "(refactor-plan.md §3.1: core ← shared ← stages ← gen-orchestrator ← commands; enforced per " +
        "§3.4). It owns the pipeline-wide IR and vocabulary and must depend on nothing else in this " +
        "package — external packages (e.g. typescript) are unaffected by this rule. Unlike the other " +
        "boundary rules above, this one starts unbaselined: core/ is clean by construction.",
      severity: "error",
      from: { path: "^packages/cli/src/core/" },
      to: { path: "^packages/cli/src/(?!core/)" },
    },
    {
      name: "shared-no-upward-imports",
      comment:
        "shared/ is meant to be a leaf utility layer that stages depend on, never the reverse " +
        "(refactor-plan.md §3.1: core ← shared ← stages ← gen-orchestrator ← commands). §1.2-B/§1.2-G " +
        "document today's 9 shared/ files importing type-extractor/types/*, baselined here.",
      severity: "error",
      from: { path: "^packages/cli/src/shared/" },
      to: {
        path: "^packages/cli/src/(type-extractor|resolver-extractor|auto-type-generator|schema-generator|gen-orchestrator|commands)/",
      },
    },
    {
      name: "gen-orchestrator-consumers",
      comment:
        "gen-orchestrator sits above the stages in the dependency rule (refactor-plan.md §3.1); only " +
        "commands/ (its caller) and the top-level cli.ts entrypoint may depend on it.",
      severity: "error",
      from: {
        pathNot: [
          "^packages/cli/src/gen-orchestrator/",
          "^packages/cli/src/commands/",
          "^packages/cli/src/cli\\.ts$",
        ],
      },
      to: { path: "^packages/cli/src/gen-orchestrator/" },
    },
  ],
  options: {
    // Scope: production code under packages/cli/src only.
    includeOnly: "^packages/cli/src",
    exclude: {
      path: [
        "\\.test\\.ts$",
        "^packages/cli/src/gen-orchestrator/testdata/",
        "^packages/cli/src/testing/",
      ],
    },
    doNotFollow: {
      path: "node_modules",
    },
    // This codebase uses `import type` pervasively (verbatimModuleSyntax). Those imports
    // disappear after compilation, but they are exactly the kind of stage-boundary/shared-layer
    // violation refactor-plan.md §1.2 calls out (e.g. shared/diagnostics.ts importing
    // `type Diagnostic` from type-extractor/types). Without this, dependency-cruiser would
    // silently ignore them.
    tsPreCompilationDeps: true,
    tsConfig: {
      // Absolute path so ts-config's `extends: "../../tsconfig.base.json"` resolves
      // correctly regardless of the cwd this check is invoked from.
      fileName: path.join(__dirname, "packages/cli/tsconfig.json"),
    },
  },
};
