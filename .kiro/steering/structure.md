# Project Structure

## Organization Philosophy

Feature-by-purpose organization where code is grouped by its role in the generation pipeline. The project itself follows the same conventions it enforces on user codebases.

## Directory Patterns

### CLI Entry Point
**Location**: `src/cli.ts`
**Purpose**: Application entry point, wires commands to gunshi CLI
**Pattern**: Single file that imports and registers all commands

### Commands
**Location**: `src/commands/`
**Purpose**: CLI command definitions using gunshi
**Pattern**: One file per command, exports `xyzCommand` using `define()`

```typescript
// src/commands/gen.ts
import { define } from "gunshi";

export const genCommand = define({
  name: "gen",
  run: (ctx) => { /* implementation */ },
});
```

### User Convention Directories (gqlkit-managed)
**Types Location**: `src/gql/types/`
**Resolvers Location**: `src/gql/resolvers/`
**Purpose**: User-defined GraphQL types and resolver implementations
**Pattern**: gqlkit scans these directories for schema generation

### Generated Output (gqlkit-managed)
**Location**: `src/gqlkit/generated/`
**Purpose**: Generated schema AST and resolver maps
**Pattern**: Auto-generated, may or may not be committed

## Naming Conventions

- **Files**: kebab-case for commands (e.g., `gen.ts`, `main.ts`)
- **Exports**: camelCase for values (e.g., `genCommand`, `mainCommand`)
- **Type exports**: PascalCase (e.g., `QueryResolver`, `UserResolver`)
- **Resolver values**: camelCase matching type (e.g., `queryResolver` for `QueryResolver`)

## Import Organization

```typescript
// External packages first
import { cli, define } from "gunshi";

// Internal imports with .js extension (ESM requirement)
import { genCommand } from "./commands/gen.js";
```

**Path Aliases**: None configured; use relative imports with `.js` extension

## Code Organization Principles

1. **Command pattern**: Each CLI command is a self-contained module using gunshi's `define()`
2. **Explicit extensions**: All relative imports must include `.js` extension for ESM compatibility
3. **Single responsibility**: One command per file, one type per file in user conventions
4. **Convention over configuration**: Directory structure determines behavior (e.g., `src/gql/types/` is scanned automatically)

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_
