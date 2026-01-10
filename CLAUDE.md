# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

gqlkit is a convention-driven code generator for GraphQL servers in TypeScript.

**Core concept**: Define GraphQL types and resolver signatures in TypeScript → `gqlkit gen` generates GraphQL schema AST and a resolver map from your codebase.

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

**Package manager**: pnpm (v10.26.2)

## Project Architecture

### Convention-Driven Design

gqlkit relies on strict conventions to enable deterministic schema generation without configuration:

1. **Source directory**: `src/gqlkit/schema/`
   - Types and resolvers co-located in the same files
   - Each file can contain type definitions and related resolvers together

2. **Type definitions**:
   - Plain TypeScript type exports (object/interface/union/enum)
   - Field nullability and list-ness inferred from TypeScript types
   - All exports from `src/gqlkit/schema/` are considered
   - TSDoc/JSDoc comments become GraphQL descriptions (`@deprecated` supported)
   - Utility types for advanced features:
     - `GqlInterface<T, Meta?>` - GraphQL interface types
     - `GqlObject<T, Meta>` - Type-level metadata (implements, directives)
     - `GqlField<T, Meta>` - Field-level metadata (defaultValue, directives)
     - `GqlDirective<Name, Args, Location>` - Custom directive definitions
     - `GqlScalar<Name, Base, Only?>` - Custom scalar type definition

3. **Define API for resolvers** (using `@gqlkit-ts/runtime`):
   - `createGqlkitApis<TContext>()` factory returns typed resolver definition functions
   - `defineQuery<Args, Return, Directives?>(resolver)` - Define Query field resolvers
   - `defineMutation<Args, Return, Directives?>(resolver)` - Define Mutation field resolvers
   - `defineField<Parent, Args, Return, Directives?>(resolver)` - Define type field resolvers
   - Export name becomes the GraphQL field name
   - Optional third type parameter for attaching directives to resolver fields

4. **Resolver function signatures**:
   - Query/Mutation: `(root, args, ctx, info) => Return`
   - Field: `(parent, args, ctx, info) => Return`
   - Use `NoArgs` type for fields without arguments

### Monorepo Structure

```
packages/
  cli/       - @gqlkit-ts/cli: Code generation CLI (gqlkit gen)
  runtime/   - @gqlkit-ts/runtime: Define API, utility types, and branded scalars
examples/    - Example projects demonstrating usage
```

**Runtime package exports** (`@gqlkit-ts/runtime`):
- `createGqlkitApis<TContext>()` - Factory for resolver definition functions
- Branded scalar types: `IDString`, `IDNumber`, `Int`, `Float`
- `GqlScalar<Name, Base, Only?>` - Custom scalar type definition
- `GqlInterface<T, Meta?>` - GraphQL interface type definition
- `GqlObject<T, Meta>` - Type metadata (implements, directives)
- `GqlField<T, Meta>` - Field metadata (defaultValue, directives)
- `GqlDirective<Name, Args, Location>` - Custom directive definition
- `NoArgs` - Helper type for fields without arguments

**CLI Pipeline** (`packages/cli/src/`):
- `commands/` - CLI command definitions using gunshi's `define()`
- `config/` - Configuration type definitions and `defineConfig()` helper
- `config-loader/` - Configuration file loading and validation
- `type-extractor/` - Scans and analyzes TypeScript types from `src/gqlkit/schema/`
- `resolver-extractor/` - Scans and analyzes resolver definitions from `src/gqlkit/schema/`
- `auto-type-generator/` - Converts inline object types to named GraphQL types
- `schema-generator/` - Builds GraphQL AST and resolver maps
- `gen-orchestrator/` - Coordinates pipeline stages (reporter, writer)
- `shared/` - Cross-cutting utilities (e.g., TSDoc parsing)

### Code Generation Flow

`gqlkit gen`:
1. Scans `src/gqlkit/schema/`
2. Builds internal type graph from TypeScript types
3. Validates resolver signatures (parent/return types exist, resolver groups match)
4. Generates:
   - `typeDefs`: GraphQL schema AST (DocumentNode) representing type definitions
   - `resolvers`: Resolver map object aggregating all resolver implementations
5. Outputs to `src/gqlkit/__generated__/` (schema.ts, resolvers.ts)

### Design Principles

- **Fail fast with actionable errors**: Invalid resolver references, type mismatches, etc.
- **No decorators, no runtime schema mutation**: Pure static analysis of TypeScript code
- **HTTP server integration is out of scope**: Focus on TS → schema AST + resolver map transformation
- **Deterministic**: Same code → same outputs, always
- **GraphQL-tools compatible**: Generated outputs work seamlessly with makeExecutableSchema

### TypeScript to GraphQL Type Mapping

| TypeScript | GraphQL |
|------------|---------|
| `string` | `String!` |
| `number` | `Float!` |
| `boolean` | `Boolean!` |
| `IDString`, `IDNumber` | `ID!` |
| `Int` (branded) | `Int!` |
| `Float` (branded) | `Float!` |
| `T \| null` | `T` (nullable) |
| `T[]` | `[T!]!` |
| String literal union | Enum type |
| TypeScript `enum` | Enum type |
| Union of object types | Union type |
| `*Input` suffix types | Input Object type |
| Union with `*Input` suffix | `@oneOf` input object |
| `GqlInterface<T>` | Interface type |
| `GqlScalar<Name, Base>` | Custom scalar |

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
