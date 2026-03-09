---
title: Configuration
description: Configure gqlkit via gqlkit.config.ts in your project root.
---

# Configuration

gqlkit can be configured via `gqlkit.config.ts` in your project root.

## CLI Options

The `gqlkit gen` command accepts the following options:

| Option | Short | Description |
|--------|-------|-------------|
| `--config <path>` | `-c` | Path to config file (default: `gqlkit.config.ts`) |
| `--cwd <path>` | | Working directory for code generation |

### Using Multiple Config Files

You can use different config files for different GraphQL schemas:

```sh
# Generate with default config (gqlkit.config.ts)
gqlkit gen

# Generate with a specific config file
gqlkit gen --config gqlkit.public.config.ts
gqlkit gen -c gqlkit.admin.config.ts
```

This is useful when you need to generate multiple GraphQL schemas from the same project, such as separate public and internal APIs.

## Basic Configuration

```ts
// gqlkit.config.ts
import { defineConfig } from "@gqlkit-ts/cli";

export default defineConfig({
  // Source directory (default: "src/gqlkit/schema")
  sourceDir: "src/gqlkit/schema",

  // Glob patterns to exclude from scanning
  sourceIgnoreGlobs: ["**/*.test.ts"],

  // Custom scalar mappings (config-based approach)
  scalars: [
    {
      name: "DateTime",
      tsType: { from: "./src/gqlkit/schema/scalars", name: "DateTime" },
      description: "ISO 8601 datetime",
    },
    {
      name: "UUID",
      tsType: { name: "string" }, // Global type
    },
  ],

  // Output paths
  output: {
    typeDefsPath: "src/gqlkit/__generated__/typeDefs.ts",
    resolversPath: "src/gqlkit/__generated__/resolvers.ts",
    schemaPath: "src/gqlkit/__generated__/schema.graphql",
    // Set to null to disable output:
    // schemaPath: null,
    // Import extension in generated files (default: "js")
    // importExtension: "none", // for bundlers
  },

  // Hooks
  hooks: {
    // Run after all files are written (e.g., formatting)
    afterAllFileWrite: "prettier --write",
    // Or multiple commands:
    // afterAllFileWrite: ["prettier --write", "eslint --fix"],
  },
});
```

## Custom Scalar Types

Map TypeScript types to GraphQL custom scalars via config. See [Scalars](./schema/scalars) for complete documentation including the `GqlScalar` approach.

```ts
export default defineConfig({
  scalars: [
    {
      name: "DateTime",
      tsType: { from: "./src/gqlkit/schema/scalars", name: "DateTime" },
      description: "ISO 8601 datetime string",
    },
  ],
});
```

## Output Paths

Customize output file locations or disable specific outputs:

```ts
export default defineConfig({
  output: {
    typeDefsPath: "generated/schema.ts", // Custom path
    resolversPath: "generated/resolvers.ts",
    schemaPath: null, // Disable SDL output
  },
});
```

### Output Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `typeDefsPath` | `string` \| `null` | `"src/gqlkit/__generated__/typeDefs.ts"` | Path for the TypeDefs output |
| `resolversPath` | `string` \| `null` | `"src/gqlkit/__generated__/resolvers.ts"` | Path for the resolvers output |
| `schemaPath` | `string` \| `null` | `"src/gqlkit/__generated__/schema.graphql"` | Path for the SDL output |
| `importExtension` | `"js"` \| `"none"` \| `"ts"` | `"js"` | File extension for import statements |

Set any path to `null` to disable that output.

The `importExtension` option controls file extensions in generated import statements:

- `"js"` (default): Converts `.ts` to `.js` (compatible with ESM + Node16)
- `"none"`: No extension (for bundlers like webpack, vite)
- `"ts"`: Keeps `.ts` extension (for Deno)

## Hooks

Execute commands after file generation:

```ts
export default defineConfig({
  hooks: {
    // Single command
    afterAllFileWrite: "prettier --write",
  },
});
```

You can also specify multiple commands to run sequentially:

```ts
export default defineConfig({
  hooks: {
    // Multiple commands (executed sequentially)
    afterAllFileWrite: ["prettier --write", "eslint --fix"],
  },
});
```

### Available Hooks

| Hook | Description |
|------|-------------|
| `afterAllFileWrite` | Runs after all generated files are written. Receives the list of written file paths. |

## Custom Discriminator Fields

Specify custom TypeScript fields for union type resolution. This is useful when union members use a discriminator field other than `__typename` or `$typeName` (e.g., external library types).

```ts
export default defineConfig({
  discriminatorFields: {
    // Single field
    ContentPart: "type",
    // Multiple fields for tuple-based discrimination
    Content: ["type", "mediaType"],
  },
});
```

Keys are GraphQL union type names, and values are either a single field name or an array of field names. gqlkit automatically generates `__resolveType` functions based on these fields.

See [Union Types - Custom Discriminator Fields](./schema/unions.md#custom-discriminator-fields) for detailed usage and validation rules.

## Source Directory

By default, gqlkit scans `src/gqlkit/schema` for types and resolvers.

```ts
export default defineConfig({
  sourceDir: "src/graphql/schema", // Custom source directory
});
```

All TypeScript files (`.ts`, `.cts`, `.mts`) under this directory are scanned.

## Ignore Patterns

Exclude files from scanning using glob patterns:

```ts
export default defineConfig({
  sourceIgnoreGlobs: [
    "**/*.test.ts",
    "**/*.spec.ts",
    "**/testdata/**",
  ],
});
```
