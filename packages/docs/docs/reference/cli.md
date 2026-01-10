# CLI Reference

## gqlkit gen

Generate GraphQL schema AST and resolver map from your TypeScript code.

```sh
npx gqlkit gen
```

### What It Does

1. Scans `src/gqlkit/schema/` directory
2. Builds internal type graph from TypeScript types
3. Validates resolver signatures
4. Generates output files:
   - `src/gqlkit/__generated__/schema.ts` - GraphQL schema AST (DocumentNode)
   - `src/gqlkit/__generated__/resolvers.ts` - Resolver map

### Options

```sh
gqlkit gen [options]
```

| Option | Description |
|--------|-------------|
| `--help` | Show help |
| `--version` | Show version |

## Configuration

Create `gqlkit.config.ts` in your project root:

```typescript
import { defineConfig } from "@gqlkit-ts/cli";

export default defineConfig({
  // configuration options
});
```
