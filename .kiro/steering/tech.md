# Technology Stack

## Architecture

Static code generation tool that analyzes TypeScript source files and produces GraphQL schema AST (DocumentNode) and resolver map objects. No runtime dependencies on the generated output beyond graphql-js types.

## Core Technologies

- **Language**: TypeScript 5.9+ (strict mode)
- **Runtime**: Node.js with ES Modules
- **CLI Framework**: gunshi for command-line interface

## Key Libraries

- **gunshi**: Type-safe CLI framework for building commands and subcommands

## Development Standards

### Type Safety

- TypeScript strict mode enabled
- `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` enforced
- `noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters` required
- `verbatimModuleSyntax` for explicit type imports

### Code Quality

- **Biome**: Linting and formatting (replaces ESLint + Prettier)
  - Double quotes for strings
  - Space indentation
  - Auto organize imports on save

### Testing

- **Test Runner**: Vitest (workspace projects configuration)
- **Pattern**: Colocated tests (`*.test.ts` alongside source files)
- **Command**: `pnpm test` (runs tests across all packages via `vitest run`)

## Development Environment

### Required Tools

- Node.js (ES2022+ target)
- pnpm 10.26.1+ (package manager)

### Common Commands

```bash
# Build: pnpm build
# Lint/Format: pnpm check
```

## Key Technical Decisions

1. **ESM-only**: Using `"type": "module"` with `moduleResolution: "node16"` for modern Node.js compatibility
2. **Biome over ESLint/Prettier**: Single tool for linting and formatting with better performance
3. **gunshi for CLI**: Provides type-safe command definitions with built-in help generation
4. **No decorators**: Design decision to keep schema generation based purely on type analysis
5. **graphql-tools compatible output**: Generated resolvers work directly with `makeExecutableSchema`
6. **Define API**: Factory-based resolver definition via `createGqlkitApis<TContext>()` from `@gqlkit-ts/runtime`, returning typed `defineQuery`, `defineMutation`, `defineField` functions with custom context support
7. **TSDoc to GraphQL descriptions**: TSDoc comments are automatically extracted and converted to GraphQL schema descriptions, supporting `@deprecated` directives
8. **Input Object convention**: Types with `*Input` suffix are recognized as GraphQL Input Object types for resolver arguments
9. **Branded scalar types**: `@gqlkit-ts/runtime` provides `IDString`, `IDNumber`, `Int`, `Float` for explicit GraphQL scalar mapping. Plain `number` defaults to `Float`; use `Int` branded type for integer fields

---
_Document standards and patterns, not every dependency_
_Updated: 2026-01-02 - Migrated to Vitest_
