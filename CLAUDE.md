# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

gqlkit is a convention-driven code generator for GraphQL servers in TypeScript.

**Core concept**: Define GraphQL types and resolver signatures in TypeScript → `gqlkit gen` generates GraphQL schema AST and a resolver map from your codebase.

**For detailed information**:
- Product vision and capabilities: `.kiro/steering/product.md`
- Architecture and technical decisions: `.kiro/steering/tech.md`
- Project structure and patterns: `.kiro/steering/structure.md`
- User documentation: `packages/docs/src/content/`

## Common Commands

```bash
pnpm check      # Lint/format with Biome (auto-fix)
pnpm test       # Run all tests
pnpm typecheck  # Type check all packages
pnpm knip       # Detect unused exports
pnpm build      # Build all packages
```

**Run single test file:**
```bash
pnpm test -- packages/cli/src/gen-orchestrator/golden.test.ts
```

**Update golden file snapshots:**
```bash
pnpm test -- -u
```

**Coverage:**
```bash
pnpm test -- --coverage
```

**Package manager**: pnpm (v10.28.0)

## Testing

Uses **golden file testing** for CLI validation:
- Test cases in `packages/cli/src/gen-orchestrator/testdata/`
- Golden files (snapshots) are placed in `src/gqlkit/__generated__/` within each test case directory
  - This mirrors the actual output location of `gqlkit gen`, so running CLI in a test case directory produces files in the same location as the golden files
- Tests compare generated output against these snapshot files

### Testing Guidelines

- **Prefer golden file tests over unit tests**: For code analysis, schema generation, and code generation logic, avoid function-level unit tests. Instead, add test cases to `testdata/` to verify correct behavior and increase coverage.
- **Keep testdata MECE**: Ensure test cases are Mutually Exclusive and Collectively Exhaustive—each case should cover a distinct scenario without overlap, and together they should cover all important behaviors.

## Coding Conventions

- **Nullability for internal types**: Use `null` (not `undefined` or optional) to represent "unset" values in types not exported to users
- **No optional parameters or default values**: All function parameters must be required. Do not use `?` optional parameters or `= defaultValue` default values
- **Object arguments for multiple parameters**: When a function has multiple parameters (especially generic types like `Set<string>`), use object arguments (keyword arguments pattern) for better readability
  ```typescript
  // Good
  interface ExtractParams {
    readonly type: ts.Type;
    readonly checker: ts.TypeChecker;
    readonly knownTypeNames: ReadonlySet<string>;
  }
  function extract(params: ExtractParams): Result { ... }

  // Bad
  function extract(
    type: ts.Type,
    checker: ts.TypeChecker,
    knownTypeNames: ReadonlySet<string> = new Set(),
  ): Result { ... }
  ```
- **Test strategy**: Prefer golden file tests for code analysis and generation logic
- **Language**: All code comments and documentation must be written in English

## Code Quality

- **Linter/Formatter**: Biome (configured in biome.jsonc)
  - Double quotes for JS/TS
  - Space indentation
  - Auto organize imports
- **knip**: Unused export detection (`pnpm knip`)

## CLI Development

When creating command-line interfaces, use the `use-gunshi-cli` skill.

## Commit and Pull Request Rules
- Use Conventional Commits for titles: `<type>(<scope>): <description>`.
- Commit bodies and PR descriptions must include:
  - `Why`: reason for the change.
  - `Summary`: short overview of what changed.
- If `Why` is unknown, ask the user before finalizing.

## Changeset Rules
- First, decide whether a changeset is required for the change before writing one.
- Use Conventional Commits style without scope: `<type>: <description>`.
- Keep changesets concise (title line only); add details in the PR.
- If there is a breaking change, add one blank line and then:
  - `**BREAKING CHANGE**: <impact and brief migration guidance if needed>`
