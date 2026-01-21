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
UPDATE_GOLDEN=true pnpm test
```

**Coverage:**
```bash
pnpm test -- --coverage
```

**Package manager**: pnpm (v10.28.0)

## Development Workflow

### AI-DLC and Spec-Driven Development

This project follows Kiro-style Spec-Driven Development.

**Paths**:
- Steering: `.kiro/steering/` - Project-wide rules and context
- Specs: `.kiro/specs/` - Individual feature specifications

**Minimal workflow**:
- Phase 0 (optional): `/kiro:steering`, `/kiro:steering-custom`
- Phase 1 (Specification):
  - `/kiro:spec-init "description"`
  - `/kiro:spec-requirements {feature}`
  - `/kiro:validate-gap {feature}` (optional: for existing codebase)
  - `/kiro:spec-design {feature} [-y]`
  - `/kiro:validate-design {feature}` (optional: design review)
  - `/kiro:spec-tasks {feature} [-y]`
- Phase 2 (Implementation): `/kiro:spec-impl {feature} [tasks]`
  - `/kiro:validate-impl {feature}` (optional: after implementation)
- Progress check: `/kiro:spec-status {feature}`

**Development rules**:
- 3-phase approval workflow: Requirements → Design → Tasks → Implementation
- Human review required each phase; use `-y` only for intentional fast-track
- Keep steering current and verify alignment with `/kiro:spec-status`
- Follow user instructions precisely; act autonomously within that scope; ask questions only when essential information is missing or instructions are critically ambiguous

**Language**: Think in English, generate responses in Japanese. All Markdown content written to project files (e.g., requirements.md, design.md, tasks.md) MUST be written in the target language configured for the specification (see spec.json.language).

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
