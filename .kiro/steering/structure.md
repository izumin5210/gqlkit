# Project Structure

## Organization Philosophy

Monorepo with feature-by-purpose organization. Each package has a clear responsibility, and code is grouped by its role in the generation pipeline.

## Monorepo Layout

```
packages/
  cli/       - @gqlkit-ts/cli - Code generation CLI
  runtime/   - @gqlkit-ts/runtime - Define API and type utilities
examples/    - Example projects demonstrating usage
```

**Package Manager**: pnpm with workspaces (`pnpm-workspace.yaml`)

## Package Patterns

### @gqlkit-ts/cli (`packages/cli/`)

Pipeline-based architecture for code generation:

- **Entry**: `src/cli.ts` - Wires commands to gunshi CLI
- **Commands**: `src/commands/` - CLI command definitions using gunshi's `define()`
- **Configuration**: `src/config/` - Configuration type definitions and `defineConfig()` helper
- **Config Loading**: `src/config-loader/` - Configuration file loading and validation
- **Type Extraction**: `src/type-extractor/` - Scans and analyzes TypeScript types
- **Resolver Extraction**: `src/resolver-extractor/` - Scans and analyzes resolver definitions
- **Schema Generation**: `src/schema-generator/` - Builds GraphQL AST and resolver maps
- **Orchestration**: `src/gen-orchestrator/` - Coordinates pipeline stages (reporter, writer)
- **Shared Utilities**: `src/shared/` - Cross-cutting utilities used by multiple pipeline stages (e.g., TSDoc parsing)

**Pattern**: Each pipeline stage has internal modules (scanner, extractor, collector, validator, etc.)

### @gqlkit-ts/runtime (`packages/runtime/`)

Minimal runtime utilities for user codebases:
- `createGqlkitApis<TContext>()` factory function
- Type definitions for resolvers (`QueryResolver`, `MutationResolver`, `FieldResolver`)
- Branded scalar types (`IDString`, `IDNumber`, `Int`, `Float`) for explicit GraphQL scalar mapping
- `NoArgs` helper type

### User Convention Directories (gqlkit-managed)
**Types**: `src/gql/types/` - User-defined GraphQL types
**Resolvers**: `src/gql/resolvers/` - Resolver implementations
**Output**: `src/gqlkit/generated/` - Generated schema.ts and resolvers.ts

## Naming Conventions

- **Files**: kebab-case (e.g., `gen.ts`, `file-scanner.ts`, `ast-builder.ts`)
- **Exports**: camelCase for values (e.g., `genCommand`, `extractTypes`)
- **Type exports**: PascalCase (e.g., `User`, `GenerationConfig`)
- **Test files**: Colocated with source (e.g., `foo.ts` + `foo.test.ts`)
- **E2E tests**: In `e2e/` subdirectory within relevant module (e.g., `schema-generator/e2e/`)

## Import Organization

```typescript
// External packages first
import { cli, define } from "gunshi";

// Internal imports with .js extension (ESM requirement)
import { extractTypes } from "../type-extractor/index.js";
```

**Path Aliases**: None configured; use relative imports with `.js` extension

## Code Organization Principles

1. **Pipeline architecture**: Clear separation of concerns (extract -> validate -> generate -> write)
2. **Module boundaries**: Each stage exposes via `index.ts`, internal structure is encapsulated
3. **Explicit extensions**: All relative imports must include `.js` extension for ESM compatibility
4. **Colocated tests**: Test files live alongside source files (`*.test.ts`)
5. **Convention over configuration**: Directory structure determines behavior

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_
_Updated: 2026-01-02 - Added config/config-loader pipeline stages_
